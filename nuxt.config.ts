const _d = new Date()
const _m = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const _buildDate = `${String(_d.getDate()).padStart(2,'0')}-${_m[_d.getMonth()]}-${_d.getFullYear()}`

export default defineNuxtConfig({
  devtools: { enabled: false },
  ssr: false,
  app: {
    head: {
      script: [
        {
          tagPriority: 'critical',
          innerHTML: `;(function(){
  var hasSerial = 'serial' in navigator;
  var isSecure = window.isSecureContext;
  if (hasSerial && isSecure) return;
  var msg = hasSerial
    ? 'This page must be served over HTTPS. Web Serial requires a secure context — plain HTTP is not supported.'
    : 'Web Serial API is not supported in this browser. Use Google Chrome or Microsoft Edge (desktop).';
  function showGate() {
    var d = document.createElement('div');
    d.id = 'compat-gate';
    d.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;padding:2rem;text-align:center;z-index:9999';
    d.innerHTML = '<h1 style="margin:0 0 1rem">FTX-1 CAT Controller</h1><p style="max-width:480px;line-height:1.6;margin:0">' + msg + '</p>';
    document.body.appendChild(d);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showGate);
  } else {
    showGate();
  }
})();`,
        },
      ],
    },
  },
  runtimeConfig: {
    public: {
      appVersion: process.env.APP_VERSION ?? 'dev',
      buildDate: _buildDate,
      web3formsKey: process.env.WEB3FORMS_KEY ?? '',
    },
  },
})
