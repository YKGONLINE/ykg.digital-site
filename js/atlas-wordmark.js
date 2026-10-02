(() => {
  'use strict';
  const canvas = document.getElementById('atlas-wordmark');
  const title = document.querySelector('.atlas-title');
  const logo = document.querySelector('.atlas-wordmark-fallback');
  const ctx = canvas?.getContext('2d', { alpha: true });
  if (!ctx || !title || !logo) return;

  // The high-DPI still and moving particles share the original SVG coordinates:
  // neither random thinning nor a different silhouette at the image handover.
  fetch(logo.dataset.points).then(response => {
    if (!response.ok) throw new Error('Wordmark unavailable');
    return response.text();
  }).then(source => {
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml');
    let seed = 20261001;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    // A Gaussian field has no rectangular perimeter. Around 60% of its points
    // lie inside the viewport; the continuous tails begin beyond all four edges.
    const normal = () => Math.sqrt(-2 * Math.log(Math.max(random(), .000001))) * Math.cos(random() * Math.PI * 2);
    const particles = [...svg.querySelectorAll('circle')].map(dot => ({
      x: +dot.getAttribute('cx') / 1390, y: +dot.getAttribute('cy') / 320,
      sx: .5 + normal() * .42, sy: .5 + normal() * .42,
      delay: random() * 1.6, duration: 1.65 + random() * 1.65,
      power: .85 + random() * .9,
      c1x: normal() * .24, c1y: normal() * .24,
      c2x: normal() * .16, c2y: normal() * .16,
      alpha: .12 + random() * .16,
      exitX: normal() * .65, exitY: normal() * .65,
      exitDelay: random() * 1.5, exitDuration: 1.9 + random() * 1.5,
    }));
    if (!particles.length) return;
    let width, height, frame = 0, previous = 0, elapsed = 0, visible = false, wasResting = false;
    let restTimer = 0, restStarted = 0, restEnd = 0, settledState = null;
    const clamp = t => Math.max(0, Math.min(1, t));
    const smooth = t => { const u = clamp(t); return u * u * (3 - 2 * u); };
    const bezier = (a, b, c, d, u) => {
      const v = 1 - u;
      return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d;
    };
    const fit = () => {
      width = innerWidth; height = innerHeight;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const clear = () => ctx.clearRect(0, 0, width, height);
    const settled = value => {
      if (settledState === value) return;
      settledState = value;
      title.classList.toggle('is-settled', value);
      canvas.hidden = value;
      // fit uses viewport dimensions, so restoring a display:none canvas never
      // inherits zero layout bounds or stale dimensions after a resize.
      if (!value) fit();
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      if (restTimer) {
        elapsed += Math.min((performance.now() - restStarted) / 1000, restEnd - elapsed);
        clearTimeout(restTimer);
        restTimer = 0;
      }
      if (!wasResting) clear();
    };
    const render = stamp => {
      frame = 0;
      if (!visible || document.hidden) return;
      elapsed += previous ? Math.min((stamp - previous) / 1000, .05) : 0;
      previous = stamp;
      const t = elapsed % 22;
      const resting = t >= 5 && t < 17;
      settled(resting);
      if (!resting || !wasResting) clear();
      wasResting = resting;
      if (resting) {
        // The static image owns this phase. No rAF, canvas repaint, or DOM writes
        // until dispersal; visibility changes freeze this remaining wait.
        previous = 0;
        restStarted = performance.now();
        restEnd = Math.floor(elapsed / 22) * 22 + 17;
        restTimer = setTimeout(() => {
          restTimer = 0;
          elapsed = restEnd;
          if (visible && !document.hidden) frame = requestAnimationFrame(render);
        }, (restEnd - elapsed) * 1000);
        return;
      }
      if (!resting) {
        const bounds = title.getBoundingClientRect();
        const radius = 2 * bounds.width / 1390;
        ctx.fillStyle = '#eef1f0';
        for (const p of particles) {
          const tx = bounds.left + p.x * bounds.width, ty = bounds.top + p.y * bounds.height;
          let x, y, alpha, r;
          if (t < 5) {
            const progress = Math.pow(clamp((t - p.delay) / p.duration), p.power);
            const sx = p.sx * width, sy = p.sy * height;
            x = bezier(sx, sx + p.c1x * width, tx + p.c2x * width, tx, progress);
            y = bezier(sy, sy + p.c1y * height, ty + p.c2y * height, ty, progress);
            // Keep travelling points subdued until they occupy their actual glyph.
            // This avoids a bright intermediate block around the letter bounds.
            alpha = (p.alpha + (1 - p.alpha) * smooth((progress - .8) / .2)) * (.4 + .6 * clamp(t / .4));
            r = .68 + (radius - .68) * smooth(progress);
          } else {
            const progress = clamp((t - 17 - p.exitDelay) / p.exitDuration);
            const ex = tx + p.exitX * width, ey = ty + p.exitY * height;
            x = bezier(tx, tx - p.c2x * width, ex - p.c1x * width, ex, progress);
            y = bezier(ty, ty - p.c2y * height, ey - p.c1y * height, ey, progress);
            alpha = (1 - smooth(progress)) * (1 - .72 * smooth(progress / .28));
            r = radius + (.68 - radius) * progress;
          }
          if (alpha < .015) continue;
          ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      frame = requestAnimationFrame(render);
    };
    const sync = () => {
      if (visible && !document.hidden) {
        if (!title.classList.contains('is-forming')) title.classList.add('is-forming');
        if (!frame && !restTimer) frame = requestAnimationFrame(render);
      } else stop();
    };
    fit();
    addEventListener('resize', fit, { passive: true });
    document.addEventListener('visibilitychange', sync);
    addEventListener('pagehide', stop); addEventListener('pageshow', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: .05 }).observe(title);
    } else { visible = true; sync(); }
  }).catch(() => { /* The static image stays visible if animation cannot initialize. */ });
})();
