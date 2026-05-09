#!/usr/bin/env bash
set -euo pipefail
# One-time Azure provisioning script for CAT FTX-1
# Run this once locally with: bash infra/setup.sh
#
# Prerequisites:
#   az login && az account set --subscription <your-sub>
#   jq (brew install jq / apt install jq)
#
# Customise these variables or export them before running:

# ── Default parameters (edit these for your deployment) ──────────────────────
DEFAULT_APP_NAME="catftx1"
DEFAULT_LOCATION="westeurope"
DEFAULT_GITHUB_REPO="mapoby/cat-ftx1v2"
DEFAULT_SKU="B1"

# ── Interactive / non-interactive mode ────────────────────────────────────────
# If env vars APP_NAME, LOCATION, GITHUB_REPO, SKU are already set, they take precedence.
if [[ -n "${APP_NAME:-}" && -n "${LOCATION:-}" && -n "${GITHUB_REPO:-}" ]]; then
  # All core vars pre-set via environment — skip interactive prompt
  SKU="${SKU:-$DEFAULT_SKU}"
else
  echo "Use default values? [y/N]"
  read -r _USE_DEFAULTS || true
  _USE_DEFAULTS="${_USE_DEFAULTS:-n}"

  if [[ "$_USE_DEFAULTS" =~ ^[Yy]$ ]]; then
    APP_NAME="${APP_NAME:-$DEFAULT_APP_NAME}"
    LOCATION="${LOCATION:-$DEFAULT_LOCATION}"
    GITHUB_REPO="${GITHUB_REPO:-$DEFAULT_GITHUB_REPO}"
    SKU="${SKU:-$DEFAULT_SKU}"
  else
    read -rp "App name [$DEFAULT_APP_NAME]: " _INPUT_APP_NAME || true
    APP_NAME="${APP_NAME:-${_INPUT_APP_NAME:-$DEFAULT_APP_NAME}}"

    read -rp "Location [$DEFAULT_LOCATION]: " _INPUT_LOCATION || true
    LOCATION="${LOCATION:-${_INPUT_LOCATION:-$DEFAULT_LOCATION}}"

    read -rp "GitHub repo [$DEFAULT_GITHUB_REPO]: " _INPUT_GITHUB_REPO || true
    GITHUB_REPO="${GITHUB_REPO:-${_INPUT_GITHUB_REPO:-$DEFAULT_GITHUB_REPO}}"

    read -rp "App Service SKU [$DEFAULT_SKU]: " _INPUT_SKU || true
    SKU="${SKU:-${_INPUT_SKU:-$DEFAULT_SKU}}"
  fi
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RG="${RG:-${APP_NAME}-rg}"

echo "================================================================"
echo " CAT FTX-1 — Azure Provisioning"
echo " App name : $APP_NAME"
echo " Location : $LOCATION"
echo " Repo     : $GITHUB_REPO"
echo "================================================================"

# ── 1. Resource group ────────────────────────────────────────────────────────
echo ""
echo "[1/5] Creating resource group: $RG"
az group create --name "$RG" --location "$LOCATION" -o table

# ── 2. Deploy Bicep (ACR + App Service Plan + Web App) ───────────────────────
echo ""
echo "[2/5] Deploying infrastructure (Bicep)…"
OUTPUTS=$(az deployment group create \
  --resource-group "$RG" \
  --template-file "${SCRIPT_DIR}/main.bicep" \
  --parameters appName="$APP_NAME" sku="$SKU" \
  --query "properties.outputs" \
  -o json)

ACR_NAME=$(echo "$OUTPUTS"   | jq -r '.acrName.value')
ACR_SERVER=$(echo "$OUTPUTS" | jq -r '.acrLoginServer.value')
WEBAPP=$(echo "$OUTPUTS"     | jq -r '.webAppName.value')
APP_URL=$(echo "$OUTPUTS"    | jq -r '.webAppUrl.value')

echo "  ACR         : $ACR_SERVER"
echo "  Web App     : $APP_URL"

# ── 3. Create Azure AD app + service principal for GitHub Actions (OIDC) ─────
echo ""
echo "[3/5] Creating Entra ID app & service principal for GitHub Actions…"
SP_NAME="${APP_NAME}-github-sp"

# Create (or reuse) the app registration
EXISTING=$(az ad app list --display-name "$SP_NAME" --query "[0].appId" -o tsv 2>/dev/null || true)
if [[ -n "$EXISTING" && "$EXISTING" != "None" ]]; then
  echo "  Re-using existing app: $EXISTING"
  APP_ID="$EXISTING"
else
  APP_ID=$(az ad app create --display-name "$SP_NAME" --query appId -o tsv)
  echo "  Created app: $APP_ID"
fi

# Ensure service principal exists
SP_OBJ=$(az ad sp list --filter "appId eq '${APP_ID}'" --query "[0].id" -o tsv 2>/dev/null || true)
if [[ -z "$SP_OBJ" || "$SP_OBJ" == "None" ]]; then
  SP_OBJ=$(az ad sp create --id "$APP_ID" --query id -o tsv)
fi

SUBSCRIPTION=$(az account show --query id -o tsv)
TENANT=$(az account show --query tenantId -o tsv)

# Assign Contributor on the resource group only
az role assignment create \
  --assignee "$APP_ID" \
  --role Contributor \
  --scope "/subscriptions/${SUBSCRIPTION}/resourceGroups/${RG}" \
  --output none 2>/dev/null || echo "  (role assignment already exists)"

# ── 4. Configure OIDC federated credential ───────────────────────────────────
echo ""
echo "[4/5] Configuring OIDC federated credential for GitHub Actions…"

SUBJECT="repo:${GITHUB_REPO}:ref:refs/heads/main"
CRED_NAME="github-main"

az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters "{
    \"name\": \"${CRED_NAME}\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"${SUBJECT}\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" -o none 2>/dev/null || echo "  (federated credential already exists)"

# Also add one for workflow_dispatch (manual trigger)
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters "{
    \"name\": \"${CRED_NAME}-dispatch\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:${GITHUB_REPO}:ref:refs/heads/main\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" -o none 2>/dev/null || true

# ── 5. ACR scheduled purge task (keep only last 30 days of sha-tagged images) ─
echo ""
echo "[5/6] Creating ACR scheduled purge task…"
az acr task create \
  --registry "$ACR_NAME" \
  --name purge-old-images \
  --file infra/acr-purge-task.yaml \
  --context "https://github.com/${GITHUB_REPO}.git#main" \
  --schedule "0 2 * * 0" \
  --commit-trigger-enabled false \
  --pull-request-trigger-enabled false \
  --output none 2>/dev/null || echo "  (purge task already exists)"
echo "  Scheduled: weekly on Sunday at 02:00 UTC — keeps last 5 sha-tags + anything <30d, :latest preserved"

# ── 6. Print GitHub configuration ────────────────────────────────────────────
echo ""
echo "[6/6] Done. Add these to your GitHub repository:"
echo ""
echo "================================================================"
echo " Settings → Secrets and variables → Actions"
echo "================================================================"
echo ""
echo " ── SECRETS ──────────────────────────────────────────────────"
echo " AZURE_CLIENT_ID       = $APP_ID"
echo " AZURE_TENANT_ID       = $TENANT"
echo " AZURE_SUBSCRIPTION_ID = $SUBSCRIPTION"
echo " DOCKERHUB_USERNAME    = <your DockerHub username>"
echo " DOCKERHUB_TOKEN       = <DockerHub access token — Account Settings → Security → Access Tokens>"
echo ""
echo " ── VARIABLES (non-sensitive, can be in vars) ────────────────"
echo " ACR_NAME              = $ACR_NAME"
echo " ACR_LOGIN_SERVER      = $ACR_SERVER"
echo " AZURE_WEBAPP_NAME     = $WEBAPP"
echo ""
echo "================================================================"
echo " App URL: $APP_URL"
echo " (may show default page until first deployment completes)"
echo "================================================================"
