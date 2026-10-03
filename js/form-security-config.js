// Public configuration only. Activation requires a deployed gateway and Turnstile sitekey.
// Secret keys are stored in Cloudflare/Apps Script, never in this file.
window.YKG_FORM_SECURITY_CONFIG = Object.freeze({
  enabled: true,
  endpoint: 'https://ykg-contact-gateway.ykg-contact-gateway.workers.dev/submit',
  turnstileSiteKey: '0x4AAAAAAFM7Rk-CdaJcbWb4'
});
