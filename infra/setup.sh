#!/usr/bin/env bash
# One-time Azure provisioning script for CAT FTX-1
# Run this once locally with: bash infra/setup.sh
#
# Prerequisites:
#   az login && az account set --subscription <your-sub>
#   jq (brew install jq / apt install jq)
#
# Customise these variables or export them before running:

APP_NAME="${APP_NAME:-catftx1}"       # prefix for all Azure resources
LOCATION="${LOCATION:-westeurope}"    # az account list-locations -o table
GITHUB_REPO="${GITHUB_REPO:-mapoby/cat-ftx1v2}"  # owner/repo on GitHub

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RG="${APP_NAME}-rg"

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
  --parameters appName="$APP_NAME" \
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

# ── 5. Print GitHub configuration ────────────────────────────────────────────
echo ""
echo "[5/5] Done. Add these to your GitHub repository:"
echo ""
echo "================================================================"
echo " Settings → Secrets and variables → Actions"
echo "================================================================"
echo ""
echo " ── SECRETS ──────────────────────────────────────────────────"
echo " AZURE_CLIENT_ID       = $APP_ID"
echo " AZURE_TENANT_ID       = $TENANT"
echo " AZURE_SUBSCRIPTION_ID = $SUBSCRIPTION"
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
