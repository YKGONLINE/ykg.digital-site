(() => {
  'use strict';
  const config = window.YKG_TRACKING_CONFIG || {};
  const measurementId = /^G-[A-Z0-9]+$/.test(config.measurementId || '') ? config.measurementId : '';
  const storageKey = 'ykg-privacy-choice-v2';
  const legacyKey = 'ykg-analytics-choice-v1';
  const textVersion = '2026-10-03-measurement-advertising-default-on-v4';
  const measurementTextVersion = '2026-10-03-measurement-default-on-v3';
  const previousTextVersion = '2026-10-03-measurement-v2';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const isEnglish = document.documentElement.lang.toLowerCase().startsWith('en');
  const preview = /^\/(?:onizleme|arsiv)(?:\/|$)/.test(location.pathname);
  const robots = document.querySelector('meta[name="robots"]')?.content || '';
  const canMeasure = ['ykg.digital', 'www.ykg.digital'].includes(location.hostname.toLowerCase())
    && !preview && !robots.toLowerCase().includes('noindex') && !/\/404\.html$/.test(location.pathname);
  const legalBase = location.pathname.startsWith('/onizleme/dil/en/') ? '/onizleme/dil/en/'
    : location.pathname.startsWith('/onizleme/dil/tr/') ? '/onizleme/dil/tr/'
    : location.pathname.startsWith('/onizleme/') ? '/onizleme/' : isEnglish ? '/en/' : '/';
  let choice = null;
  let legacyMeasurement = false;
  let hasLegacyChoice = false;
  let googleLoaded = false;
  let gaConfigured = false;
  let pageViewSent = false;

  // Preserve existing rejections. Default-on settings are not recorded as visitor
  // acceptance. Advertising remains a preference only until its tags are connected.
  try {
    const record = JSON.parse(localStorage.getItem(storageKey) || 'null');
    const supportedRecord = record && (
      (record.version === 4 && record.textVersion === textVersion)
      || (record.version === 3 && record.textVersion === measurementTextVersion)
      || (record.version === 2 && record.textVersion === previousTextVersion)
    );
    if (supportedRecord
      && typeof record.measurement === 'boolean' && typeof record.advertising === 'boolean'
      && Number.isFinite(record.savedAt) && Number.isFinite(record.expiresAt)
      && record.savedAt <= Date.now() && record.expiresAt > Date.now()
      && record.expiresAt - record.savedAt === lifetime) {
      choice = record;
    } else {
      const legacy = localStorage.getItem(legacyKey);
      hasLegacyChoice = legacy === 'accepted' || legacy === 'rejected';
      legacyMeasurement = legacy === 'accepted';
    }
  } catch {}

  const measurementAllowed = () => choice ? choice.measurement : hasLegacyChoice ? legacyMeasurement : true;
  const advertisingAllowed = () => choice ? choice.advertising : hasLegacyChoice ? false : true;
  const cleanUrl = (value) => {
    try { const url = new URL(value); return url.origin + url.pathname; } catch { return ''; }
  };
  const page = () => ({
    page_location: location.origin + location.pathname,
    page_title: document.title,
    page_referrer: cleanUrl(document.referrer)
  });
  const consentState = () => ({
    analytics_storage: measurementAllowed() ? 'granted' : 'denied',
    // Ads and Meta integration is deferred. The advertising preference must not
    // activate advertising collection through the existing Analytics tag.
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });

  function startGoogle() {
    if (googleLoaded || !canMeasure) return;
    googleLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    // Technical tag state for the requested opt-out model; this is not proof
    // of visitor consent or a determination of legal compliance.
    window.gtag('consent', 'default', consentState());
    window.gtag('set', 'ads_data_redaction', true);
    window.gtag('set', 'url_passthrough', false);
    window.gtag('consent', 'update', consentState());
    window.gtag('js', new Date());
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(script);
  }

  function configureMeasurement() {
    if (!measurementId || !googleLoaded || gaConfigured) return;
    gaConfigured = true;
    window.gtag('config', measurementId, {
      ...page(), send_page_view: false, cookie_expires: 15552000,
      allow_google_signals: false, allow_ad_personalization_signals: false
    });
  }

  function removeCookies(pattern) {
    document.cookie.split(';').forEach((entry) => {
      const name = entry.split('=')[0].trim();
      if (!pattern.test(name)) return;
      const host = location.hostname;
      ['', host, '.' + host, '.ykg.digital'].forEach((domain) => {
        document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax' + (domain ? '; domain=' + domain : '');
      });
    });
  }

  function applyChoice() {
    if (!canMeasure || !measurementId) return;
    const gaEnabled = measurementAllowed();
    window['ga-disable-' + measurementId] = !gaEnabled;
    if (gaEnabled) startGoogle();
    if (googleLoaded) window.gtag('consent', 'update', consentState());
    if (gaEnabled) configureMeasurement();
    if (!gaEnabled) removeCookies(/^_(ga|gid|gat)(_|$)/);
    if (gaEnabled && gaConfigured && !pageViewSent) {
      pageViewSent = true;
      window.gtag('event', 'page_view', { ...page(), send_to: measurementId });
    }
  }
  applyChoice();

  const words = isEnglish ? {
    title: 'Privacy and Measurement', hint: 'Privacy preferences', close: 'Close panel',
    intro: 'ykg.digital uses visit statistics to improve this site. Advertising tools can help reach people interested in its work. Measurement and advertising preferences are on by default. You can turn them off separately here.',
    how: 'How do we use them?', reject: 'Reject all', settings: 'Preferences', accept: 'Accept all',
    measurement: 'Measurement', measurementInfo: 'Google Analytics visit statistics.',
    advertising: 'Advertising', advertisingInfo: 'Google Ads and Meta advertising measurement and ads relevant to your interests.',
    save: 'Save choices', privacy: 'Privacy and Data Protection', cookies: 'Cookies and Measurement',
    before: 'Measurement starts on your first visit, before a choice, using Google Analytics cookies. Refusing measurement stops new page-view events, removes Analytics cookies and prevents the tag from loading on subsequent pages. An already loaded tag may still send technical consent signals. Closing this panel leaves your existing setting unchanged.',
    duration: 'Analytics cookies are configured for 180 days. Your choices are remembered in this browser for 180 days. The advertising preference is on by default and can be turned off separately from measurement. It will apply to Google Ads and Meta once their connections are completed; changing this preference alone does not start advertising tracking.'
  } : {
    title: 'Gizlilik ve Ölçüm', hint: 'Gizlilik tercihleri', close: 'Paneli kapat',
    intro: 'ykg.digital, siteyi geliştirmek için ziyaret istatistiklerinden yararlanır. Reklam araçları, çalışmalarımızla ilgilenen kişilere ulaşmak için kullanılabilir. Ölçüm ve reklam tercihleri başlangıçta açıktır. İkisini buradan ayrı ayrı kapatabilirsiniz.',
    how: 'Nasıl kullanıyoruz?', reject: 'Reddet', settings: 'Tercihler', accept: 'Kabul et',
    measurement: 'Ölçüm', measurementInfo: 'Google Analytics ziyaret istatistikleri.',
    advertising: 'Reklam', advertisingInfo: 'Google Ads ve Meta reklam ölçümü ve ilgi alanlarınıza uygun reklamlar.',
    save: 'Seçimi kaydet', privacy: 'Gizlilik ve KVKK', cookies: 'Çerez ve Ölçüm',
    before: 'Ölçüm, ilk ziyarette seçim yapmadan önce Google Analytics çerezleriyle başlar. Reddettiğinizde yeni sayfa görüntüleme olayları durur, Analytics çerezleri silinir ve sonraki sayfalarda etiket yüklenmez. Önceden yüklenmiş etiket teknik tercih sinyalleri göndermeye devam edebilir. Paneli kapatmak mevcut ayarınızı değiştirmez.',
    duration: 'Analitik çerezleri 180 gün için ayarlanmıştır. Tercihleriniz bu tarayıcıda 180 gün hatırlanır. Reklam tercihi başlangıçta açıktır; ölçümden bağımsız kapatılabilir. Google Ads ve Meta bağlantıları tamamlandığında reklam tercihiniz bu araçlarda uygulanır; bu tercihi değiştirmek tek başına reklam takibini başlatmaz.'
  };
  const root = document.createElement('div');
  root.className = 'privacy-tools';
  root.innerHTML =
    '<button class="privacy-chip" type="button" data-consent-expand aria-label="' + words.title + '" aria-controls="privacy-panel" aria-expanded="false" hidden>' +
    '<svg class="privacy-sliders" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" aria-hidden="true"><path d="M3 6h4m4 0h10M3 12h10m4 0h4M3 18h4m4 0h10"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/></svg>' +
    '<span class="privacy-hint" aria-hidden="true">' + words.hint + '</span></button>' +
    '<section id="privacy-panel" class="privacy-panel" role="dialog" aria-modal="false" aria-labelledby="privacy-title" aria-describedby="privacy-copy" hidden>' +
    '<div class="privacy-heading"><h2 id="privacy-title">' + words.title + '</h2>' +
    '<button class="privacy-close" type="button" data-consent-close aria-label="' + words.close + '"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="6" cy="6" r=".9"/><circle cx="6" cy="18" r=".9"/><circle cx="9" cy="9" r=".9"/><circle cx="9" cy="15" r=".9"/><circle cx="12" cy="12" r=".9"/><circle cx="15" cy="9" r=".9"/><circle cx="15" cy="15" r=".9"/><circle cx="18" cy="6" r=".9"/><circle cx="18" cy="18" r=".9"/></svg></button></div>' +
    '<p id="privacy-copy">' + words.intro + '</p><details class="privacy-more"><summary>' + words.how + '</summary>' +
    '<p>' + words.before + '</p><p>' + words.duration + '</p>' +
    '<p><a href="' + legalBase + 'gizlilik.html">' + words.privacy + '</a> · <a href="' + legalBase + 'cerezler.html">' + words.cookies + '</a></p></details>' +
    '<div class="privacy-actions"><button type="button" data-choice="rejected">' + words.reject + '</button>' +
    '<button type="button" data-settings>' + words.settings + '</button><button type="button" data-choice="accepted">' + words.accept + '</button></div>' +
    '<div class="privacy-preferences" hidden><label class="privacy-toggle"><input type="checkbox" data-analytics-toggle /><span><strong>' + words.measurement + '</strong><br />' + words.measurementInfo + '</span></label>' +
    '<label class="privacy-toggle"><input type="checkbox" data-advertising-toggle /><span><strong>' + words.advertising + '</strong><br />' + words.advertisingInfo + '</span></label>' +
    '<div class="privacy-save"><button type="button" data-save-preferences>' + words.save + '</button></div></div></section>';
  document.body.appendChild(root);
  const panel = root.querySelector('.privacy-panel');
  const preferences = root.querySelector('.privacy-preferences');
  const analyticsToggle = root.querySelector('[data-analytics-toggle]');
  const advertisingToggle = root.querySelector('[data-advertising-toggle]');
  const chip = root.querySelector('[data-consent-expand]');
  const closeButton = root.querySelector('[data-consent-close]');
  const film = document.getElementById('film');
  const footer = document.querySelector('footer');
  let revealProgress = !film || document.documentElement.classList.contains('no-film')
    || Number(document.documentElement.dataset.privacyReveal) === 1 ? 1 : 0;
  let footerDocked = false;
  let footerObserver = null;
  let returnFocus = null;

  function dockPrivacyAtFooter() {
    if (!footer || footerDocked || !revealProgress) return;
    const bounds = footer.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > window.innerHeight + 1) return;
    footerDocked = true;
    footer.classList.add('has-privacy-dock');
    root.classList.add('is-footer-docked');
    footer.appendChild(root);
    footerObserver?.disconnect();
  }
  if (footer && 'IntersectionObserver' in window) {
    footerObserver = new IntersectionObserver(dockPrivacyAtFooter, { threshold: [0, 1] });
    footerObserver.observe(footer);
  }
  function showPanel(openPreferences = false) {
    returnFocus = document.activeElement;
    panel.hidden = false;
    preferences.hidden = !openPreferences;
    analyticsToggle.checked = measurementAllowed();
    advertisingToggle.checked = advertisingAllowed();
    chip.setAttribute('aria-expanded', 'true');
    closeButton.focus();
  }
  function closePanel(restoreFocus = true) {
    panel.hidden = true;
    chip.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      if (returnFocus?.isConnected && !returnFocus.inert) returnFocus.focus();
      else if (!chip.hidden) chip.focus();
    }
    returnFocus = null;
  }
  function syncFilmReveal(progress) {
    revealProgress = progress === 1 ? 1 : 0;
    chip.hidden = !revealProgress;
    chip.inert = !revealProgress;
    if (!revealProgress) closePanel(false);
    // No automatic panel opening, even for first-time visitors.
    if (revealProgress) dockPrivacyAtFooter();
  }
  function saveChoice(measurement, advertising) {
    const now = Date.now();
    choice = { version: 4, textVersion, measurement, advertising, savedAt: now, expiresAt: now + lifetime };
    hasLegacyChoice = false;
    try {
      localStorage.setItem(storageKey, JSON.stringify(choice));
      localStorage.removeItem(legacyKey);
    } catch {}
    applyChoice();
    closePanel();
  }
  syncFilmReveal(revealProgress);
  if (film) window.addEventListener('ykg:film-handoff', (event) => syncFilmReveal(event.detail.progress));
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-choice]');
    if (button) { const accept = button.dataset.choice === 'accepted'; saveChoice(accept, accept); return; }
    if (event.target.closest('[data-consent-close]')) { closePanel(); return; }
    if (event.target.closest('[data-consent-expand]')) { if (panel.hidden) showPanel(); else closePanel(); return; }
    if (event.target.closest('[data-settings]')) { preferences.hidden = false; analyticsToggle.focus(); return; }
    if (event.target.closest('[data-save-preferences]')) saveChoice(analyticsToggle.checked, advertisingToggle.checked);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden && !document.documentElement.classList.contains('menu-open')) {
      event.preventDefault(); closePanel();
    }
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-consent-open]')) showPanel(true);
  });
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === legacyKey) location.reload();
  });
})();
