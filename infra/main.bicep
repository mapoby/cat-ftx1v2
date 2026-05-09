// Azure infrastructure for CAT FTX-1 controller
// Resources: Container Registry + App Service Plan (Linux) + Web App

@description('Short name prefix for all resources, e.g. "catftx1". Must be globally unique for ACR.')
param appName string

@description('Azure region. Defaults to the resource group location.')
param location string = resourceGroup().location

@description('App Service Plan SKU. B1 (~$13/mo) is the minimum for Linux containers.')
@allowed(['B1', 'B2', 'B3', 'S1', 'S2', 'P1v3', 'P2v3'])
param sku string = 'B1'

var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

// ── Azure Container Registry ─────────────────────────────────────────────────

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${appName}acr'     // must be globally unique, alphanumeric only
  location: location
  sku: { name: 'Basic' }    // Basic: ~$0.17/day, sufficient for CI/CD
  properties: {
    adminUserEnabled: false
  }
}

// ── App Service Plan (Linux) ──────────────────────────────────────────────────

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appName}-plan'
  location: location
  kind: 'Linux'
  sku: { name: sku }
  properties: {
    reserved: true   // required flag for Linux plans
  }
}

// ── Web App (Linux container) ─────────────────────────────────────────────────

resource webapp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${appName}-app'   // becomes <name>.azurewebsites.net
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true          // redirect all HTTP → HTTPS (Web Serial API needs HTTPS)
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/${appName}:latest'
      alwaysOn: true         // keep container warm (B1+)
      appSettings: [
        {
          name:  'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'     // stateless container — no persistent storage needed
        }
        {
          name:  'WEBSITES_PORT'
          value: '80'        // nginx listens on 80
        }
      ]
    }
  }
}

// ── Grant AcrPull to webapp managed identity ──────────────────────────────────

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, webapp.id, acrPullRoleId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      acrPullRoleId
    )
    principalId: webapp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Enable managed identity image pulls ──────────────────────────────────────

resource webappConfig 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: webapp
  name: 'web'
  properties: {
    acrUseManagedIdentityCreds: true
  }
}

// ── Outputs consumed by infra/setup.sh ───────────────────────────────────────

output acrName        string = acr.name
output acrLoginServer string = acr.properties.loginServer
output webAppName     string = webapp.name
output webAppUrl      string = 'https://${webapp.properties.defaultHostName}'
