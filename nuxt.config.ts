const _d = new Date()
const _m = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const _buildDate = `${String(_d.getDate()).padStart(2,'0')}-${_m[_d.getMonth()]}-${_d.getFullYear()}`

export default defineNuxtConfig({
  devtools: { enabled: false },
  ssr: false,
  runtimeConfig: {
    public: {
      appVersion: process.env.APP_VERSION ?? 'dev',
      buildDate: _buildDate,
    },
  },
})
