// Azure infrastructure for CAT FTX-1 controller
// Resources: Container Registry + App Service Plan (Linux) + Web App

@description('Short name prefix for all resources, e.g. "catftx1". Must be globally unique for ACR.')
param appName string

@description('Azure region. Defaults to the resource group location.')
param location string = resourceGroup().location

@description('App Service Plan SKU. B1 (~$13/mo) is the minimum for Linux containers.')
@allowed(['B1', 'B2', 'B3', 'S1', 'S2', 'P1v3', 'P2v3'])
param sku string = 'B1'

// ── Azure Container Registry ─────────────────────────────────────────────────

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${appName}acr'     // must be globally unique, alphanumeric only
  location: location
  sku: { name: 'Basic' }    // Basic: ~$0.17/day, sufficient for CI/CD
  properties: {
    adminUserEnabled: true   // needed for App Service to pull images
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

var acrCreds = acr.listCredentials()

resource webapp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${appName}-app'   // becomes <name>.azurewebsites.net
  location: location
  properties: {
    serverFarmId: plan.id
    httpsOnly: true          // redirect all HTTP → HTTPS (Web Serial API needs HTTPS)
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/${appName}:latest'
      alwaysOn: true         // keep container warm (B1+)
      appSettings: [
        {
          name:  'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acr.properties.loginServer}'
        }
        {
          name:  'DOCKER_REGISTRY_SERVER_USERNAME'
          value: acrCreds.username
        }
        {
          name:  'DOCKER_REGISTRY_SERVER_PASSWORD'
          value: acrCreds.passwords[0].value
        }
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

// ── Outputs consumed by infra/setup.sh ───────────────────────────────────────

output acrName        string = acr.name
output acrLoginServer string = acr.properties.loginServer
output webAppName     string = webapp.name
output webAppUrl      string = 'https://${webapp.properties.defaultHostName}'
