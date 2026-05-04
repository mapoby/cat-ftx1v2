export default defineNuxtConfig({
  devtools: { enabled: false },
  ssr: false,
  runtimeConfig: {
    public: {
      appVersion: process.env.APP_VERSION ?? 'dev',
    },
  },
})
