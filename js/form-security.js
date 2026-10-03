(() => {
  const config = window.YKG_FORM_SECURITY_CONFIG || {};
  const form = document.getElementById('contact-form');
  if (!form || config.enabled !== true) return;
  const source = form.dataset.messagePrefix ? 'atlas_beta' : 'contact';
  const productionPage = ['ykg.digital', 'www.ykg.digital'].includes(location.hostname)
    && !location.pathname.startsWith('/onizleme/');
  const configured = productionPage && /^https:\/\/[^/]+\/submit$/.test(config.endpoint || '') && !!config.turnstileSiteKey;
  let widget = null;
  let container = null;
  let loading = null;

  const load = () => {
    if (window.turnstile) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      const timer = window.setTimeout(() => reject(new Error('verification_failed')), 15000);
      script.onload = () => { window.clearTimeout(timer); window.turnstile ? resolve() : reject(new Error('verification_failed')); };
      script.onerror = () => { window.clearTimeout(timer); reject(new Error('verification_failed')); };
      document.head.append(script);
    }).catch(error => { loading = null; throw error; });
    return loading;
  };
  const reset = () => {
    if (widget !== null && window.turnstile) window.turnstile.remove(widget);
    widget = null;
    if (container) container.remove();
    container = null;
  };
  const verify = async () => {
    if (!configured) throw new Error('unavailable');
    await load();
    reset();
    container = document.createElement('div');
    container.className = 'form-verification';
    form.insertBefore(container, document.getElementById('contact-status'));
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => complete(false), 90000);
      const complete = token => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        token ? resolve(token) : reject(new Error('verification_failed'));
      };
      try {
        widget = window.turnstile.render(container, {
          sitekey: config.turnstileSiteKey, action: source, theme: 'dark', size: 'compact',
          appearance: 'always', 'response-field': false,
          language: document.documentElement.lang === 'en' ? 'en' : 'tr',
          callback: complete, 'error-callback': () => { complete(false); return true; },
          'expired-callback': () => complete(false), 'timeout-callback': () => complete(false)
        });
      } catch { complete(false); }
    });
  };
  const send = async (fields, token = '') => {
    if (!configured) throw new Error('unavailable');
    const body = new URLSearchParams({ ...fields, source, 'cf-turnstile-response': token });
    const response = await fetch(config.endpoint, {
      method: 'POST', body, credentials: 'omit', referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(35000)
    });
    const answer = await response.json();
    if (answer.kind !== 'ykg-contact-result' || answer.requestId !== fields.request_id || typeof answer.ok !== 'boolean') {
      throw new Error('delivery_unknown');
    }
    return answer;
  };
  const submit = async (fields, onChallenge) => {
    const answer = await send(fields);
    if (answer.code !== 'challenge_required' || answer.ok) return answer;
    // The server's daily IP counter, rather than localStorage, requests proof.
    if (typeof onChallenge === 'function') onChallenge();
    const token = await verify();
    return send(fields, token);
  };
  window.YKG_FORM_SECURITY = Object.freeze({ enabled: true, configured, submit, reset });
})();
