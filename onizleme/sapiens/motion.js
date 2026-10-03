// Bütün süreler saniye cinsinden burada. Pozlar ve geçişler yalnız t'ye bağlıdır.
export const T = Object.freeze({
  gather: [0.3, 2.6],
  transitions: [[5, 7], [10, 12], [15, 17.5]],
  zoom: [5, 7],
  end: 24,
  pulse: { start: 17.5, period: 4.8, settle: 1.4 },
  inspect: [3.5, 8.5, 13.5, 21],
});
export const VW = 1672, VH = 941;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const span = (t, [a, b]) => clamp((t - a) / (b - a));
export const mix = (a, b, p) => a + (b - a) * p;
export const parseTime = value => Number.isFinite(Number(value)) ? clamp(Number(value), 0, T.end) : 0;
export function random(seed) {
  return () => { let t = seed += 0x6d2b79f5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function stateAt(t) {
  if (t < T.gather[1]) return { kind: 'gather', to: 0, p: span(t, T.gather) };
  for (let i = 0; i < T.transitions.length; i++) {
    const [a, b] = T.transitions[i];
    if (t < a) return { kind: 'hold', to: i, p: 1 };
    if (t < b) return { kind: 'transition', from: i, to: i + 1, p: span(t, [a, b]) };
  }
  return { kind: 'hold', to: 3, p: 1 };
}

// Kamera taş→tarım dönüşümüyle birlikte yerleşir; tarım boyunca tamamen sabittir.
export function cameraAt(t, width, height) {
  const scale = Math.min(width / VW, height / VH);
  const zoom = mix(1.16, 1, smooth(span(t, T.zoom)));
  const focus = (zoom - 1) / .16 * .8;
  const cx = mix(VW / 2, VW * .3, focus), cy = mix(VH / 2, VH * .45, focus);
  const w = width / scale / zoom, h = height / scale / zoom;
  return { left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2, scale: scale * zoom };
}

export function createMotion(targets, { stars = 700, seed = 20261003 } = {}) {
  const count = targets[0].x.length, total = count + stars;
  if (targets.length !== 4 || targets.some(a => a.x.length !== count || a.y.length !== count || a.b.length !== count)) throw new Error('Dört eşit nokta kümesi gerekli');
  const positions = new Float32Array(total * 3), alpha = new Float32Array(total), sizes = new Float32Array(total);
  const rnd = random(seed), delays = Float32Array.from({ length: count }, rnd);
  // Yalnız açılışta kullanılan sabit toz alanı. Sahneler birbirine doğrudan dönüşür.
  const openingCloud = (() => {
    const x = new Float32Array(count), y = x.slice(), z = x.slice(), b = x.slice();
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
      x[i] = VW * (.5 + Math.cos(a) * r * .69);
      y[i] = VH * (.49 + Math.sin(a) * r * .72);
      z[i] = (rnd() - .5) * 300;
      b[i] = .13 + Math.pow(rnd(),8) * .7;
    }
    return { x, y, z, b };
  })();
  // Açılışın ve arka planın tohumları birbirinden bağımsızdır.
  const starRandom = random(seed + 41);
  const starData = Array.from({ length: stars }, () => [starRandom(), starRandom(), .08 + starRandom() * .16]);
  const networkDistance = Float32Array.from(targets[3].x, (x, i) => Math.hypot((x / VW - .526), (targets[3].y[i] / VH - .47) * VH / VW));
  const networkMask = Float32Array.from(targets[3].x, x => smooth((x / VW - .535) / .035));

  function frame(t) {
    const state = stateAt(t), dest = targets[state.to];
    let a = dest, b = dest;
    const gathering = state.kind === 'gather';
    if (gathering) a = openingCloud;
    if (state.kind === 'transition') {
      a = targets[state.from];
    }
    const progress = state.kind === 'hold' ? 1 : smooth(state.p);
    for (let i = 0; i < count; i++) {
      const e = gathering ? smooth((state.p - delays[i] * .16) / .84) : progress;
      const j = i * 3;
      positions[j] = mix(a.x[i], b.x[i], e);
      positions[j + 1] = mix(a.y[i], b.y[i], e);
      positions[j + 2] = mix(a.z?.[i] ?? 0, b.z?.[i] ?? 0, e);
      alpha[i] = mix(a.b[i], b.b[i], e);
      sizes[i] = gathering ? mix(1.1 + 3.5 * smooth((a.b[i]-.13)/.7), 2, e) : 2;
      // Derinliğe giden toz hafifçe küçülür ve kısılır. Figürlerin kendi koordinatları sabittir.
      const depth = positions[j + 2] / 300;
      sizes[i] *= 1 + depth * .2;
      alpha[i] *= 1 + depth * .3;
      if (state.to === 3) {
        const age = Math.max(0, t - T.pulse.start);
        const wave = (age % T.pulse.period) / T.pulse.period * .85 - .08;
        const d = (networkDistance[i] - wave) / .035;
        const pulse = Math.exp(-d * d) * smooth(age / T.pulse.settle);
        alpha[i] *= 1 + .30 * pulse * networkMask[i] * e;
      }
    }
    for (let i = 0; i < stars; i++) {
      const k = count + i, s = starData[i];
      positions[k * 3] = s[0] * VW; positions[k * 3 + 1] = s[1] * VH; positions[k * 3 + 2] = -400;
      alpha[k] = s[2]; sizes[k] = 1;
    }
    return state;
  }
  return { count, total, positions, alpha, sizes, frame };
}
