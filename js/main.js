import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FXAAPass } from "three/addons/postprocessing/FXAAPass.js";
import { config, filmShare, stageAt } from "./config.js?v=11";
import { sample } from "./timeline.js?v=2";
import {
  buildRungDigits,
  buildStrandRibbons,
  buildGalaxyDust,
  buildParticles,
  buildStreaks,
  buildStars,
  farGalaxyTexture,
  nebulaTexture,
  coreTexture,
  mulberry32,
  orbitBasis,
  fibonacciSphere,
  buildDeerTargets,
  glyphAtlasTexture,
} from "./world.js?v=7"; // sürüm etiketi: tarayıcı eski world.js ile yeni main.js karıştırmasın

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const look = { ...config.look };

const api = { ready: false };
window.__intro = api;

// Film herkes için oynar; sistemdeki "hareketi azalt" ayarı yok sayılır (YKG kararı: marka kimliği
// filmin üzerine kurulu, film kaydırmayla ilerler, kendiliğinden oynamaz). Karar verilene kadar ekran
// siyah kalır (styles.css); film teknik olarak açılamazsa (WebGL yok vb.) yedek görünüm gösterilir.
try {
  boot();
} catch (error) {
  console.error(error);
  root.classList.remove("webgl");
  root.classList.add("no-film");
}

// Atom yörüngeleri, halka ve çift sarmal tek formülden: parçacıklar, kol çizgileri ve rakamlar
// aynı noktada durur (çizgiyle parçacık birbirinden kaymaz).
function dnaChunk() {
  const d = config.dna;
  const o = config.atom.orbits;
  const f = (x) => Number(x).toFixed(5);
  const orb = o
    .map((q, i) => `const vec3 ORB${i} = vec3(${f(q.r)}, ${f((q.tiltX * Math.PI) / 180)}, ${f((q.tiltZ * Math.PI) / 180)});`)
    .join("\n");
  return /* glsl */ `
    uniform float uAlign, uStretch, uDnaSpin, uDnaTiltCos, uDnaTiltSin;
    ${orb}
    const float DNA_L = ${f(d.axisLength)};
    const float DNA_R = ${f(d.radius)};
    const float GROOVE = ${f(d.groove)};
    const float BANDS = ${f(o.length)};
    const float SLOTS = ${f(d.rungSlots)};
    vec3 orbitParams(float oi) { return oi < 0.5 ? ORB0 : (oi < 1.5 ? ORB1 : ORB2); }
    vec3 orbitPoint(float oi, float th) {
      vec3 q = orbitParams(oi);
      float x = cos(th) * q.x;
      float z = sin(th) * q.x;
      float y1 = -z * sin(q.y);
      float z1 = z * cos(q.y);
      return vec3(x * cos(q.z) - y1 * sin(q.z), x * sin(q.z) + y1 * cos(q.z), z1);
    }
    vec3 dnaWorld(float u, float phi, float r) {
      float ps = phi + uDnaSpin;
      float v = r * cos(ps);
      float w = r * sin(ps);
      return vec3(u * uDnaTiltCos - v * uDnaTiltSin, u * uDnaTiltSin + v * uDnaTiltCos, w);
    }
    // Kol noktası: atomda yörünge, hizalanınca eksene dik halka, çekilince sarmal.
    vec3 strandPoint(float oi, float th, float strand) {
      vec3 atomP = orbitPoint(oi, th);
      float k = uStretch;
      float rr = mix(orbitParams(oi).x * 0.55, DNA_R, k);
      float bandU = ((oi + th / 6.2831853) / BANDS - 0.5) * DNA_L;
      float u = mix((oi - 1.0) * 1.5, bandU, k);
      vec3 ring = dnaWorld(u, th + strand * GROOVE * k, rr);
      return mix(atomP, ring, uAlign);
    }
    // Basamak (baz çifti): iki kolu birleştiren kiriş, s=0 bir kol, s=1 öbür kol.
    vec3 rungPoint(float slot, float s) {
      float u = ((slot + 0.5) / SLOTS - 0.5) * DNA_L;
      float fb = (u / DNA_L + 0.5) * BANDS;
      float th = fract(fb) * 6.2831853;
      vec3 a = dnaWorld(u, th, DNA_R);
      vec3 b = dnaWorld(u, th + GROOVE, DNA_R);
      return mix(a, b, s);
    }
  `;
}

function boot() {
  const canvas = document.getElementById("stage");
  const hero = document.getElementById("hero");
  const film = document.getElementById("film");
  const hint = document.getElementById("hint");
  const captionBox = document.getElementById("captions");
  const captionEls = config.captions.map((c) => {
    const el = document.createElement("p");
    el.textContent = c.text;
    captionBox.appendChild(el);
    return { el, t: c.t, last: -1 };
  });

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 1);
  root.classList.add("webgl");

  const narrow = window.innerWidth < config.counts.narrowMaxWidth;
  const count = narrow ? config.counts.narrow : config.counts.desktop;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);

  // --- Ana parçacıklar: patlama → galaksi ---
  const dnaTiltRad = (config.dna.axisTilt * Math.PI) / 180;
  const particleUniforms = {
    uExpand: { value: 0 },
    uForm: { value: 0 },
    uAtom: { value: 0 },
    uSpin: { value: 0 },
    uSize: { value: 1 },
    uAlpha: { value: 0 },
    uPR: { value: 1 },
    // Çift sarmal (yandan DNA) → bit glifleri → geyik logosu
    uAlign: { value: 0 },
    uStretch: { value: 0 },
    uRungs: { value: 0 },
    uNucShow: { value: 0 },
    uAmb: { value: 0 },
    uDnaSpin: { value: 0 },
    uDnaTiltCos: { value: Math.cos(dnaTiltRad) },
    uDnaTiltSin: { value: Math.sin(dnaTiltRad) },
    uGlyph: { value: 0 },
    uDeer: { value: 0 },
    uDeerScale: { value: 0 },
    uDeerOffset: { value: new THREE.Vector2() },
    uGlyphTex: { value: glyphAtlasTexture() },
  };
  const particles = new THREE.Points(
    buildParticles(count, config),
    new THREE.ShaderMaterial({
      uniforms: particleUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uExpand, uForm, uAtom, uSpin, uSize, uAlpha, uPR;
        uniform float uRungs, uNucShow, uAmb, uGlyph, uDeer, uDeerScale;
        ${dnaChunk()}
        uniform vec2 uDeerOffset;
        attribute vec3 aDir;
        attribute vec3 aGal;
        attribute vec4 aRnd;
        attribute vec4 aAtom;
        attribute vec4 aOrb;
        attribute vec4 aDeer;
        attribute float aDeerBit;
        attribute float aDeerDelay;
        varying float vA;
        varying float vDeerGlyph;
        varying float vDeerGlyphMix;
        vec3 rotY(vec3 p, float a) {
          float c = cos(a), s = sin(a);
          return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
        }
        void main() {
          float r = length(aGal.xz);
          vec3 gal = rotY(aGal, uSpin * (1.0 / (0.3 + r * 0.045)));
          vec3 bang = aDir * (aRnd.w * uExpand);
          float f = clamp((uForm - aRnd.x * 0.4) / 0.6, 0.0, 1.0);
          f = f * f * (3.0 - 2.0 * f);
          vec3 p = mix(bang, gal, f);
          p = rotY(p, (1.0 - f) * f * 3.0);
          // Galaksi → atom. Yörünge parçacıkları yörünge çizgisiyle aynı formülden konumlanır
          // (atomda dönüş yok: parçacık çizgiden kaymaz, iz bırakmaz).
          float fa = clamp((uAtom - aRnd.x * 0.15) / 0.85, 0.0, 1.0);
          fa = fa * fa * (3.0 - 2.0 * fa);
          float role = aOrb.x;
          float isStrand = 1.0 - step(0.5, role);
          float isRungP = step(0.5, role) * (1.0 - step(1.5, role));
          float isHidden = step(1.5, role);
          vec3 jitter = (fract(aRnd.yzx * vec3(91.7, 37.3, 53.1)) - 0.5) * 0.35;
          vec3 atomP = isStrand > 0.5 ? orbitPoint(aOrb.y, aOrb.z) + jitter : aAtom.xyz;
          // Galaksi → atom geometrik: düz çizgide değil, merkez etrafında yay çizerek (kutupsal ara
          // değer). Spiral kollar çözülüp yörünge halkalarına dönüşüyor gibi okunur; ışığa dalış yok.
          float rg = length(p.xz);
          float ra2 = length(atomP.xz);
          float ag = atan(p.z, p.x);
          float aa = atan(atomP.z, atomP.x);
          float da = mod(aa - ag + 3.14159265, 6.2831853) - 3.14159265;
          float swirl = (1.0 - fa) * fa * 1.6;
          float ang = ag + da * fa + swirl;
          float rr2 = mix(rg, ra2, fa);
          vec3 polarP = vec3(cos(ang) * rr2, mix(p.y, atomP.y, fa), sin(ang) * rr2);
          p = fa >= 0.999 ? atomP : polarP;
          // Atom → halka → sarmal (kollar), çekirdek → baz çiftleri (basamaklar).
          if (isStrand > 0.5) {
            // DNA'da kol ince bir çizgi değil, çevresinde parçacık hacmi olan bir ışık tüpü.
            p = mix(p, strandPoint(aOrb.y, aOrb.z, aOrb.w) + jitter * mix(0.6, 3.0, uStretch), uAlign);
          }
          float fr = clamp((uRungs - fract(aRnd.x * 3.7) * 0.4) / 0.6, 0.0, 1.0);
          fr = fr * fr * (3.0 - 2.0 * fr);
          if (isRungP > 0.5) {
            p = mix(p, rungPoint(aOrb.y, aOrb.z) + jitter * 0.25, fr);
          }
          // Sarmalın ışığında geyik logosuna: normalize edilmiş hedef, ekranda HTML logoyla örtüşecek şekilde ölçeklenir.
          // Kontur parçacıkları kendi sırasına (aDeerDelay) bağlı gecikmeyle varır: çizgi sırayla çiziliyormuş gibi dolar.
          float fg = clamp((uDeer - aDeerDelay) / 0.12, 0.0, 1.0);
          fg = fg * fg * (3.0 - 2.0 * fg);
          vec3 deerP = vec3(aDeer.xy * uDeerScale + uDeerOffset, aDeer.z * uDeerScale * 0.02);
          // Geyiğin çevresindeki toz yavaşça süzülür: bekleme anı donuk görünmesin.
          float isDust = 1.0 - step(0.2, aDeer.w);
          deerP.xy += vec2(sin(uAmb * 0.35 + aRnd.y * 40.0), cos(uAmb * 0.3 + aRnd.z * 40.0)) * 0.012 * uDeerScale * isDust;
          p = mix(p, deerP, fg);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float depth = -mv.z;
          float size = uSize * (0.7 + aRnd.y * 2.6) * uPR * (95.0 / max(depth, 16.0));
          float aMix = mix(mix(0.3 + 0.45 * fract(aRnd.x * 7.31), aRnd.z, f), aAtom.w, fa);
          // Atomda kol parçacıkları çizginin çevresinde hafif bir hale: çizgiyi taşıyan kristal çizgidir.
          aMix = mix(aMix, 0.22, isStrand * fa);
          // Çekirdeğin kalanı sarmal kurulurken söner; basamak parçacıkları rakamlar belirince kısılır.
          aMix *= 1.0 - isHidden * uAlign;
          // Atomda çekirdek parçacıkları kısık: çekirdeği gölgeli küreler taşır.
          aMix *= 1.0 - 0.75 * (1.0 - isStrand) * uNucShow * (1.0 - uAlign);
          aMix = mix(aMix, 0.4, isStrand * uStretch);
          aMix = mix(aMix, (0.36 + 0.14 * aOrb.w) * (1.0 - 0.75 * uGlyph), isRungP * fr);
          // Geyik çizilirken sırası gelmemiş parçacıklar kısılır: sarmalın silüeti geyiğin üstünde kalmaz.
          aMix *= 1.0 - 0.97 * smoothstep(0.0, 0.18, uDeer) * (1.0 - fg);
          aMix = mix(aMix, aDeer.w, fg);
          float a = uAlpha * aMix;
          // Geyik çizgisi hafifçe pırıldar.
          a *= mix(1.0, 0.78 + 0.22 * sin(uAmb * 2.4 + aRnd.x * 60.0), fg * (1.0 - isDust));
          // DNA'da derinlik: önde kalan kol ve basamak parlak, arkada kalan sisli ve sönük.
          float d0 = -(modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z;
          float shade = clamp(0.62 + (d0 - depth) / (DNA_R * 2.2), 0.18, 1.15);
          a *= mix(1.0, shade, uStretch * (1.0 - fg));
          // Boncuklar biraz iri.
          size *= 1.0 + 0.5 * isRungP * aOrb.w * fr * (1.0 - fg);
          if (size < 1.0) { a *= size; size = 1.0; }
          gl_PointSize = min(size, 22.0);
          a *= smoothstep(1.0, 12.0, depth);
          vA = a;
          vDeerGlyph = aDeerBit;
          vDeerGlyphMix = fg;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uGlyphTex;
        varying float vA;
        varying float vDeerGlyph;
        varying float vDeerGlyphMix;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float dotA = 1.0 - smoothstep(0.0, 1.0, d);
          dotA = dotA * dotA;
          // Geyik konturundaki bazı parçacıklar vardıkça 0/1 glifine dönüşür (1 = "0", 2 = "1").
          if (vDeerGlyph > 0.5 && vDeerGlyphMix > 0.001) {
            vec2 uv = vec2(gl_PointCoord.x * 0.5 + (vDeerGlyph > 1.5 ? 0.5 : 0.0), gl_PointCoord.y);
            float glyphA = texture2D(uGlyphTex, uv).a;
            float a = mix(dotA, glyphA, vDeerGlyphMix);
            gl_FragColor = vec4(vec3(1.0), a * vA);
          } else {
            gl_FragColor = vec4(vec3(1.0), dotA * vA);
          }
        }
      `,
    }),
  );
  scene.add(particles);

  // --- Bit katmanı: her basamak okunur bir 0/1 dizisine dönüşür; sarmal yerinde kalır ---
  const digitUniforms = {
    uAlpha: { value: 0 },
    uPx: { value: config.dna.digitPx },
    uPR: { value: 1 },
    uAlign: particleUniforms.uAlign,
    uStretch: particleUniforms.uStretch,
    uDnaSpin: particleUniforms.uDnaSpin,
    uDnaTiltCos: particleUniforms.uDnaTiltCos,
    uDnaTiltSin: particleUniforms.uDnaTiltSin,
    uGlyphTex: particleUniforms.uGlyphTex,
    uDeer: particleUniforms.uDeer,
    uDeerScale: particleUniforms.uDeerScale,
    uDeerOffset: particleUniforms.uDeerOffset,
  };
  const digits = new THREE.Points(
    buildRungDigits(config),
    new THREE.ShaderMaterial({
      uniforms: digitUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uAlpha, uPx, uPR, uDeer, uDeerScale;
        uniform vec2 uDeerOffset;
        ${dnaChunk()}
        attribute vec4 aRung;
        attribute vec3 aDeerT;
        varying float vA;
        varying float vDigit;
        void main() {
          vec3 p = rungPoint(aRung.x, aRung.y);
          // Bitler sarmaldan kopup geyiğin çizgisine uçar: geyiğin "kod" yarısını onlar kurar.
          float fg = clamp((uDeer - aDeerT.z) / 0.16, 0.0, 1.0);
          fg = fg * fg * (3.0 - 2.0 * fg);
          p = mix(p, vec3(aDeerT.xy * uDeerScale + uDeerOffset, 0.0), fg);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float depth = -mv.z;
          gl_PointSize = uPx * uPR * clamp(40.0 / depth, 0.75, 1.4) * 1.35 * mix(1.0, 0.55, fg);
          // Basamak ekranda yan dönük değilse (kameraya doğru uzanıyorsa) rakamlar söner:
          // perspektifte eksen boyunca yatay bir sıra gibi görünmesinler.
          vec3 a = (modelViewMatrix * vec4(rungPoint(aRung.x, 0.0), 1.0)).xyz;
          vec3 b = (modelViewMatrix * vec4(rungPoint(aRung.x, 1.0), 1.0)).xyz;
          vec3 ab = b - a;
          float facing = smoothstep(0.45, 0.8, length(ab.xy) / max(length(ab), 1e-4));
          float d0 = -(modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z;
          float front = clamp(0.6 + (d0 - depth) / (DNA_R * 2.4), 0.25, 1.0);
          vA = uAlpha * mix(facing * front, 0.85, fg);
          vDigit = aRung.z;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uGlyphTex;
        varying float vA;
        varying float vDigit;
        void main() {
          vec2 uv = vec2(gl_PointCoord.x * 0.5 + vDigit * 0.5, 1.0 - gl_PointCoord.y);
          float a = texture2D(uGlyphTex, uv).a;
          gl_FragColor = vec4(vec3(1.0), a * vA);
        }
      `,
    }),
  );
  digits.renderOrder = 5;
  scene.add(digits);

  // --- Geyik hedefleri: PNG'nin alfa kanalından asenkron örnekleme ---
  // Yüklenene kadar aDeer sıfır kalır (merkezde, görünmez); film bu yüzden kırılmaz.
  const deerImg = new Image();
  deerImg.onload = () => {
    try {
      const off = document.createElement("canvas");
      off.width = deerImg.naturalWidth;
      off.height = deerImg.naturalHeight;
      const octx = off.getContext("2d");
      octx.drawImage(deerImg, 0, 0);
      const imgData = octx.getImageData(0, 0, off.width, off.height);
      const { deer, deerBit, deerDelay } = buildDeerTargets(count, particles.geometry.userData.sortKey, imgData, off.width, off.height, config);
      particles.geometry.attributes.aDeer.array.set(deer);
      particles.geometry.attributes.aDeer.needsUpdate = true;
      particles.geometry.attributes.aDeerBit.array.set(deerBit);
      particles.geometry.attributes.aDeerBit.needsUpdate = true;
      particles.geometry.attributes.aDeerDelay.array.set(deerDelay);
      particles.geometry.attributes.aDeerDelay.needsUpdate = true;
      // Rakamlara geyik hedefi: soldan sağa sıralı rakamlar, soldan sağa sıralı kontur noktalarına
      // (yollar kesişmesin); varış gecikmesi hedefin kontur sırasından gelir.
      const outline = [];
      for (let i = 0; i < count; i++) if (deer[i * 4 + 3] >= 0.3) outline.push(i);
      if (outline.length) {
        outline.sort((a, b) => deer[a * 4] - deer[b * 4]);
        const rung = digits.geometry.attributes.aRung;
        const tgt = digits.geometry.attributes.aDeerT;
        const n = rung.count;
        const idx = Array.from({ length: n }, (_, k) => k).sort((a, b) => rung.array[a * 4] - rung.array[b * 4] || a - b);
        idx.forEach((k, rank) => {
          const i = outline[Math.floor(((rank + 0.5) / n) * outline.length)];
          tgt.array[k * 3] = deer[i * 4];
          tgt.array[k * 3 + 1] = deer[i * 4 + 1];
          tgt.array[k * 3 + 2] = Math.min(0.8, deerDelay[i]);
        });
        tgt.needsUpdate = true;
      }
    } catch {
      // Örnekleme başarısız olsa da geyik hedefi merkezde sessizce bekler.
    }
  };
  deerImg.onerror = () => {};
  deerImg.src = config.deer.src;

  // --- Evrenden çıkış: ışıktan kaçan çizgiler ---
  const streakUniforms = { uExpand: { value: 0 }, uAlpha: { value: 0 } };
  const streaks = new THREE.LineSegments(
    buildStreaks(config.counts.streaks, config),
    new THREE.ShaderMaterial({
      uniforms: streakUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uExpand;
        attribute vec3 aDir;
        attribute vec2 aRnd;
        attribute float aEnd;
        varying float vA;
        void main() {
          float head = aRnd.x * uExpand;
          float tail = head * (1.0 - 0.45 * aRnd.x) - 1.5;
          vec3 p = aDir * mix(head, max(tail, 0.0), aEnd);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          vA = aRnd.y * (1.0 - aEnd) * smoothstep(0.6, 6.0, -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAlpha;
        varying float vA;
        void main() { gl_FragColor = vec4(vec3(1.0), vA * uAlpha); }
      `,
    }),
  );
  scene.add(streaks);

  // --- Arka plan yıldızları ---
  const starUniforms = { uAlpha: { value: 0 }, uPR: { value: 1 } };
  const stars = new THREE.Points(
    buildStars(config.counts.stars, config),
    new THREE.ShaderMaterial({
      uniforms: starUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uPR;
        attribute float aRnd;
        varying float vA;
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (1.0 + aRnd * 1.6) * uPR;
          vA = 0.25 + 0.75 * aRnd;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAlpha;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          gl_FragColor = vec4(vec3(1.0), (1.0 - d) * vA * uAlpha);
        }
      `,
    }),
  );
  scene.add(stars);

  // --- Uzak galaksiler: görüş alanının her yerine dağılmış, boyut/eğim/parlaklık çeşitli,
  // bir kısmı kameraya yakın geçen (paralaks, büyük ve bulanık) ---
  const farVariantTex = [];
  for (let v = 0; v < config.counts.farGalaxyVariants; v++) {
    farVariantTex.push(farGalaxyTexture(config.seed ^ (0x9a1 + v * 0x517)));
  }
  const farRng = mulberry32(config.seed ^ 0xfa4);
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const farMeshes = [];
  for (let i = 0; i < config.counts.farGalaxies; i++) {
    const near = farRng() < 0.22; // kameraya yakından geçen, büyük ve bulanık azınlık
    const material = new THREE.MeshBasicMaterial({
      map: farVariantTex[Math.floor(farRng() * farVariantTex.length)],
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(planeGeo, material);
    // Tüm görüş küresine dağıt: yalnız altta değil, üstte ve yanlarda da.
    const x = (farRng() * 2 - 1) * 260;
    const y = (farRng() * 2 - 1) * 200;
    const z = near ? -25 - farRng() * 65 : -60 - farRng() * 260;
    mesh.position.set(x, y, z);
    mesh.rotation.set(farRng() * Math.PI, farRng() * Math.PI, farRng() * Math.PI);
    const s = near ? 55 + farRng() * 55 : 10 + farRng() * 26;
    mesh.scale.set(s, s, s);
    const brightness = near ? 0.35 + farRng() * 0.35 : 0.45 + farRng() * 0.75;
    scene.add(mesh);
    farMeshes.push({ mesh, material, brightness });
  }

  // --- Galaksi düzlemindeki gaz/toz katmanı: parçacıkların altında, spirale bükülmüş doku ---
  const nebulaMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(config.galaxy.radius * 2.3, config.galaxy.radius * 2.3),
    new THREE.MeshBasicMaterial({
      map: nebulaTexture(config),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
      side: THREE.DoubleSide,
    }),
  );
  nebulaMesh.rotation.x = -Math.PI / 2; // düz yatır: galaksi düzlemi XZ
  nebulaMesh.renderOrder = -1; // parçacıklardan önce çizilsin, kol dokusu altta kalmasın
  scene.add(nebulaMesh);

  // --- Toz şeritleri: ışığı KARARTAN katman (additive değil); parçacıklardan sonra çizilir ---
  const dustUniforms = { uAlpha: { value: 0 }, uSpin: particleUniforms.uSpin, uPR: { value: 1 } };
  const dust = new THREE.Points(
    buildGalaxyDust(narrow ? config.galaxy.dustCount / 2 : config.galaxy.dustCount, config),
    new THREE.ShaderMaterial({
      uniforms: dustUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */ `
        uniform float uSpin, uPR;
        attribute float aRnd;
        varying float vW;
        vec3 rotY(vec3 p, float a) {
          float c = cos(a), s = sin(a);
          return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
        }
        void main() {
          float r = length(position.xz);
          vec3 p = rotY(position, uSpin * (1.0 / (0.3 + r * 0.045)));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp((5.0 + 9.0 * aRnd) * uPR * (70.0 / max(-mv.z, 8.0)), 1.0, 40.0);
          vW = 0.35 + 0.65 * aRnd;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAlpha;
        varying float vW;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = 1.0 - smoothstep(0.2, 1.0, d);
          gl_FragColor = vec4(0.0, 0.0, 0.0, a * vW * uAlpha);
        }
      `,
    }),
  );
  dust.renderOrder = 4;
  scene.add(dust);

  // --- Çekirdek küreleri: nucleusCenters ile birebir aynı sabit noktalarda yumuşak sprite'lar ---
  const nucleusCenters = fibonacciSphere(config.atom.nucleusSpheres).map((p) =>
    p.map((v) => v * config.atom.nucleusShellRadius),
  );
  // Işık yönüne göre gölgelenen tek renk küreler: proton/nötron kümesi net okunsun.
  const nucleusUniforms = { uAlpha: { value: 0 } };
  const nucleusMaterial = new THREE.ShaderMaterial({
    uniforms: nucleusUniforms,
    transparent: true,
    depthWrite: true,
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec3 L = normalize(vec3(-0.4, 0.7, 0.6));
        float diff = max(dot(vN, L), 0.0);
        float rim = pow(1.0 - max(dot(vN, vV), 0.0), 2.5);
        float spec = pow(max(dot(reflect(-L, vN), vV), 0.0), 24.0);
        float l = 0.05 + 0.42 * diff + 0.3 * rim + 0.35 * spec;
        gl_FragColor = vec4(vec3(l), uAlpha);
      }
    `,
  });
  const sphereGeo = new THREE.SphereGeometry(1.35, 32, 24);
  const nucleusGroup = new THREE.Group();
  const nucleusMeshes = nucleusCenters.map((c) => {
    const mesh = new THREE.Mesh(sphereGeo, nucleusMaterial);
    mesh.position.set(c[0] * 0.78, c[1] * 0.78, c[2] * 0.78);
    nucleusGroup.add(mesh);
    return mesh;
  });
  scene.add(nucleusGroup);

  // --- Merkezdeki ışık: her karede aynı ışık, hikâyenin dikiş yeri ---
  const core = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: coreTexture(),
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  core.renderOrder = 10;
  scene.add(core);

  // --- Atom: ince yörünge çizgileri ve üzerlerinde dolaşan elektronlar ---
  const orbitFns = config.atom.orbits.map(orbitBasis);
  const tmp = [0, 0, 0];
  // Yörünge çizgileri = sonraki sarmalın kolları: parçacıklarla aynı formülden konumlanır.
  const strandUniforms = {
    uAlpha: { value: 0 },
    uTrace: { value: 1 },
    uWidth: { value: 2 }, // şerit genişliği (cihaz pikseli), resize() ayarlar
    uRes: { value: new THREE.Vector2(1, 1) },
    uAlign: particleUniforms.uAlign,
    uStretch: particleUniforms.uStretch,
    uDnaSpin: particleUniforms.uDnaSpin,
    uDnaTiltCos: particleUniforms.uDnaTiltCos,
    uDnaTiltSin: particleUniforms.uDnaTiltSin,
  };
  const strandMaterial = new THREE.ShaderMaterial({
    uniforms: strandUniforms,
    side: THREE.DoubleSide, // şerit kameraya göre dönebilir; arka yüzü de çizilmeli
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uAlpha, uWidth, uTrace;
      uniform vec2 uRes;
      ${dnaChunk()}
      attribute vec4 aOrb;
      attribute float aSide;
      varying float vA;
      varying float vSide;
      void main() {
        vec3 p = strandPoint(aOrb.y, aOrb.z, aOrb.w);
        vec3 q = strandPoint(aOrb.y, aOrb.z + 0.02, aOrb.w);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec4 c0 = projectionMatrix * mv;
        vec4 c1 = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
        // Ekran uzayında kola dik yönde sabit piksel genişliğinde şerit.
        vec2 hr = uRes * 0.5;
        vec2 dir = c1.xy / c1.w * hr - c0.xy / c0.w * hr;
        float len = length(dir);
        dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
        c0.xy += vec2(-dir.y, dir.x) * aSide * 0.5 * uWidth / hr * c0.w;
        gl_Position = c0;
        vSide = aSide;
        // Önde kalan kol parlak, arkadaki sönük: sarmalın derinliği okunur.
        float d0 = -(modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z;
        float shade = clamp(0.62 + (d0 + mv.z) / (DNA_R * 2.6) * uStretch, 0.18, 1.0);
        float traceAt = (aOrb.y + aOrb.z / 6.2831853) / 3.0;
        float traced = 1.0 - smoothstep(uTrace - 0.025, uTrace + 0.025, traceAt);
        vA = uAlpha * shade * traced;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      varying float vSide;
      // Kenar yumuşak düşer: çizgi tırtıksız görünür.
      void main() { gl_FragColor = vec4(vec3(1.0), 0.7 * vA * (1.0 - smoothstep(0.3, 1.0, abs(vSide)))); }
    `,
  });
  for (const geo of buildStrandRibbons(config)) scene.add(new THREE.Mesh(geo, strandMaterial));
  const electronMaterial = new THREE.SpriteMaterial({
    map: core.material.map,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  const electronRng = mulberry32(config.seed ^ 0xe1e);
  const electrons = [];
  for (let i = 0; i < config.atom.electrons; i++) {
    const sprite = new THREE.Sprite(electronMaterial);
    sprite.scale.set(3.2, 3.2, 1);
    scene.add(sprite);
    electrons.push({
      sprite,
      orbit: orbitFns[i % orbitFns.length],
      phase: electronRng() * Math.PI * 2,
      speed: (0.35 + electronRng() * 0.3) * (electronRng() < 0.5 ? -1 : 1),
    });
  }

  // --- Son işlem: parlama, tek renk, beyaz an, vinyet, gren ---
  const composer = new EffectComposer(renderer);

  composer.addPass(new RenderPass(scene, camera));
  // Kenar yumuşatma yalnız atom aşamasında (çekirdek küreleri, yörüngeler). MSAA değil: Android'de
  // MSAA + DPR 2 ekranı siyaha boyamıştı (DEVIR.md → Dersler).
  const fxaa = new FXAAPass();
  composer.addPass(fxaa);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), look.bloomStrength, look.bloomRadius, look.bloomThreshold);
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uFlash: { value: 0 },
      uGrain: { value: look.grain },
      uVig: { value: look.vignette },
      uExposure: { value: look.exposure },
      uSeed: { value: 0 },
      uAspect: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uFlash, uGrain, uVig, uExposure, uSeed, uAspect;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
        float r2 = dot(q, q);
        // Yumuşak omuz: parlak bölgeler düz beyaz plato olmaz, içindeki doku görünür kalır.
        const float K = 0.62;
        if (l > K) l = K + (1.0 - K) * (1.0 - exp(-(l - K) / (1.0 - K)));
        l *= 1.0 - uVig * smoothstep(0.05, 0.9, r2);
        float white = 0.93 * (1.0 - 0.16 * smoothstep(0.0, 0.8, r2));
        l = mix(l, white, uFlash);
        l += (hash(vUv * vec2(1733.0, 977.0) + uSeed) - 0.5) * uGrain * (0.15 + min(l, 1.0));
        gl_FragColor = vec4(vec3(max(l, 0.0)), 1.0);
      }
    `,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  // --- Boyut ---
  const finale = document.getElementById("finale");
  const finaleLogo = document.getElementById("finale-logo");
  let pixelRatio = 1;
  function resize() {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, config.maxDpr);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
    strandUniforms.uRes.value.set(w * pixelRatio, h * pixelRatio);
    strandUniforms.uWidth.value = 1.6 * pixelRatio;
    camera.aspect = w / h;
    // Dar ekranda geniş görüş: galaksi, atom, sarmal ve geyik yanlardan kırpılmasın.
    camera.fov = camera.aspect < 0.8 ? 68 : 50;
    camera.updateProjectionMatrix();
    grade.uniforms.uAspect.value = w / h;
    particleUniforms.uPR.value = pixelRatio * (h / 900);
    starUniforms.uPR.value = pixelRatio;
    dustUniforms.uPR.value = pixelRatio * (h / 900);
    digitUniforms.uPR.value = pixelRatio * Math.max(0.8, h / 900);
    // Geyik/logo aşamasındaki gerçek kamera uzaklığı: draw()'daki fit pullback ile birebir aynı formül.
    const fit = Math.max(1, 0.55 / (Math.tan((camera.fov * deg) / 2) * camera.aspect));
    const deerDist = config.deer.camDist * fit;
    const viewH = 2 * deerDist * Math.tan((camera.fov * deg) / 2);
    const worldPerPxY = viewH / h;
    const worldPerPxX = (viewH * camera.aspect) / w;
    if (finaleLogo) {
      const rect = finaleLogo.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const heroRect = hero.getBoundingClientRect();
        particleUniforms.uDeerScale.value = rect.height * worldPerPxY;
        const dxPx = rect.left + rect.width / 2 - (heroRect.left + heroRect.width / 2);
        const dyPx = rect.top + rect.height / 2 - (heroRect.top + heroRect.height / 2);
        particleUniforms.uDeerOffset.value.set(dxPx * worldPerPxX, -dyPx * worldPerPxY);
      }
    }
    draw(time);
  }

  // --- Kare çizimi: t'nin saf fonksiyonu ---
  const deg = Math.PI / 180;
  function draw(t) {
    const s = sample(t, look, ambient);
    const ease = (a, b) => { const p = Math.max(0, Math.min(1, (t - a) / (b - a))); return p * p * (3 - 2 * p); };
    strandUniforms.uTrace.value = 1.03 * ease(14.0, 16.7);
    // Dikey ekranda atomun yörüngeleri / yakın çekim / geyik yanlardan kırpılmasın: kamera geri çekilir.
    const fit = Math.max(1, 0.55 / (Math.tan((camera.fov * deg) / 2) * camera.aspect));
    const pullback = 1 + (fit - 1) * Math.max(s.atom, s.closeUp, s.geyik);
    s.camDist *= pullback;
    // Kamera dar ekranda geri çekilince merkez ışık da orantılı küçülür — yoksa sabit dünya
    // boyutlu çekirdek küreleri (ve sarmal/geyik) dar ekranda ışığın altında kaybolur.
    s.coreSize /= pullback;
    const polar = s.camPolar * deg;
    const az = s.camAz * deg;
    const sx = s.camDist * Math.sin(polar) * Math.sin(az);
    const sy = s.camDist * Math.cos(polar);
    const sz = s.camDist * Math.sin(polar) * Math.cos(az);
    // Sarmal YANDAN görünür, kolların önü/arkası derinlik (boyut/parlaklık) ile ayrışır.
    camera.position.set(sx, sy, sz);
    camera.lookAt(0, 0, 0);

    particleUniforms.uExpand.value = s.expand;
    particleUniforms.uForm.value = s.form;
    particleUniforms.uAtom.value = s.atom;
    particleUniforms.uSpin.value = s.spin;
    particleUniforms.uAlpha.value = s.alpha * look.particleAlpha;
    particleUniforms.uSize.value = look.particleSize;
    particleUniforms.uAlign.value = s.align;
    particleUniforms.uStretch.value = s.stretch;
    particleUniforms.uRungs.value = s.rungs;
    particleUniforms.uNucShow.value = s.nucleusShow;
    particleUniforms.uAmb.value = ambient;
    // Sarmalın kendi ekseni etrafındaki dönüşü: yalnız t'nin saf fonksiyonu (karede rastgele yok).
    particleUniforms.uDnaSpin.value = Math.max(0, t - 18) * config.dna.spinSpeed;
    particleUniforms.uGlyph.value = s.glyph;
    particleUniforms.uDeer.value = s.deer;
    digitUniforms.uAlpha.value = s.glyph * (1 - s.logoReveal) * 0.95;
    streakUniforms.uExpand.value = s.expand;
    streakUniforms.uAlpha.value = s.streak * 0.4;
    // Atom aşamasında arka plan yıldızları iyice soluklaşır: dikkat çekirdek/yörüngede kalsın.
    starUniforms.uAlpha.value = s.stars * 0.7 * (1 - 0.5 * s.atom);
    for (const f of farMeshes) f.material.opacity = s.far * 0.5 * f.brightness;
    strandUniforms.uAlpha.value = s.orbitLines * (1 - s.deer) * 0.42;
    electronMaterial.opacity = s.electrons * (1 - s.align);
    // Gaz katmanı ve toz: parçacıklarla birlikte belirir (form), galaksi atoma çözülürken söner.
    const nebulaFade = 1 - ease(13.0, 15.2);
    nebulaMesh.material.opacity = Math.pow(s.form, 2) * nebulaFade * look.gas;
    dustUniforms.uAlpha.value = Math.pow(s.form, 3) * nebulaFade * look.dust * 0.22;
    dust.visible = dustUniforms.uAlpha.value > 0.001;
    // rotation.x zaten -90°: düzlem yatık, normali dünya Y ekseni — rotation.y bu yüzden
    // düzlemin KENDİ ekseni etrafında döner (particles shader'daki rotY ile aynı yönde).
    const nebulaSpin = look.spin * (0.07 * Math.max(0, t - 4.6));
    nebulaMesh.rotation.y = nebulaSpin * (1 / (0.3 + config.galaxy.radius * 0.55 * 0.045));
    // Çekirdek küreleri: atom oluşunca belirir, yörüngeler DNA'ya hizalanırken söner.
    const nucFade = s.atom * s.nucleusShow * (1 - s.align);
    nucleusUniforms.uAlpha.value = nucFade;
    // Görünmezken derinlik de yazmasın: yoksa Big Bang'de merkezde karanlık daireler bırakır.
    nucleusGroup.visible = nucFade > 0.01;
    for (let i = 0; i < nucleusMeshes.length; i++) {
      const m = nucleusMeshes[i];
      m.scale.setScalar(Math.max(0.001, 1 - s.align * 0.9));
      const assembly = ease(14.3 + i * 0.06, 16.1 + i * 0.035);
      const c = nucleusCenters[i];
      const radius = 0.78 + (1 - assembly) * 4.5;
      m.position.set(c[0] * radius, c[1] * radius, c[2] * radius);
    }
    for (const e of electrons) {
      e.orbit(e.phase + e.speed * (t + ambient * 0.5), tmp);
      e.sprite.position.set(tmp[0], tmp[1], tmp[2]);
    }

    const viewH = 2 * s.camDist * Math.tan((camera.fov * deg) / 2);
    const coreWorld = viewH * s.coreSize * look.coreLight;
    core.scale.set(coreWorld, coreWorld, 1);

    // Bit aşamasında kamera sarmala yakınlaşır (closeUp): bloom basamak/kol ayrıntısını yutmasın
    // diye kısılır. Geyikte parçacıklar yoğun: aşırı parlamasın diye hafifçe kısılır.
    bloom.strength = look.bloomStrength * s.bloomMul * (1 - 0.35 * s.geyik - 0.8 * s.closeUp);
    bloom.radius = look.bloomRadius;
    bloom.threshold = look.bloomThreshold + 0.1 * s.geyik + 0.58 * s.closeUp;
    grade.uniforms.uFlash.value = s.flash;
    grade.uniforms.uGrain.value = look.grain;
    grade.uniforms.uVig.value = look.vignette;
    grade.uniforms.uExposure.value = look.exposure;
    grade.uniforms.uSeed.value = (Math.floor(t * 24) % 97) * 0.173;

    fxaa.enabled = s.atom > 0.02 && s.align < 0.98;
    composer.render();
    hint.classList.toggle("is-gone", t > 0.15);
    for (const c of captionEls) {
      const [a, b] = c.t;
      const x = Math.min(1, Math.max(0, (t - a) / 0.6)) * Math.min(1, Math.max(0, (b - t) / 0.6));
      const o = Math.round(x * x * (3 - 2 * x) * 100) / 100;
      if (o !== c.last) {
        c.last = o;
        c.el.style.opacity = String(o);
        c.el.style.transform = `translateY(${((1 - o) * 8).toFixed(1)}px)`;
      }
    }
    if (finale) {
      finale.style.opacity = String(s.logoReveal);
      finale.classList.toggle("is-live", s.logoReveal > 0.02);
    }
    if (debug) debug.update(t);
  }

  // --- Oynatıcı: film kaydırmayla ilerler; zaman kaydırmayı yumuşak bir gecikmeyle izler ---
  let time = 0;
  let ambient = 0; // galaksinin dönüşü ve gren için: kaydırma dursa da sahne canlı kalır
  let visible = document.visibilityState === "visible";
  let inView = true;
  let raf = 0;
  let last = 0;
  const fpsWindow = [];

  function scrollRange() {
    const rect = film.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const length = Math.max(1, film.offsetHeight - hero.offsetHeight);
    return { top, length };
  }

  function targetTime() {
    const { top, length } = scrollRange();
    const p = Math.min(1, Math.max(0, (window.scrollY - top) / (length * filmShare())));
    return p * config.duration;
  }

  function running() {
    return visible && inView;
  }

  function loop(now) {
    raf = 0;
    if (!running()) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    if (dt > 0) {
      fpsWindow.push(dt);
      if (fpsWindow.length > 90) fpsWindow.shift();
    }
    ambient += dt;
    const target = targetTime();
    const k = 1 - Math.exp(-dt * config.scroll.follow);
    time += (target - time) * k;
    if (Math.abs(target - time) < 0.0005) time = target;
    draw(time);
    raf = requestAnimationFrame(loop);
  }

  function sync() {
    if (running() && !raf) {
      last = 0;
      raf = requestAnimationFrame(loop);
    } else if (!running() && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  // Belirli bir ana git: sayfayı o ana karşılık gelen kaydırma konumuna taşır (yalnız debug ve kontroller).
  function seek(t) {
    const { top, length } = scrollRange();
    const clamped = Math.min(config.duration, Math.max(0, t));
    window.scrollTo({ top: top + (clamped / config.duration) * length * filmShare(), behavior: "instant" });
    time = clamped;
    draw(time);
  }

  document.addEventListener("visibilitychange", () => {
    visible = document.visibilityState === "visible";
    sync();
  });
  new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
    sync();
  }).observe(film);

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  const debug = params.get("debug") === "1" ? createDebug() : null;

  Object.assign(api, {
    ready: true,
    seek,
    getTime: () => time,
    getTarget: () => targetTime(),
    getStage: () => stageAt(time),
    getFps: () => (fpsWindow.length ? fpsWindow.length / fpsWindow.reduce((a, b) => a + b, 0) : 0),
    getParticleCount: () => count,
  });

  // Yalnız ?debug=1: ölçüm araçları.
  if (debug) {
    // Kare kare tarama: her adımda kareyi çizer, merkez bölgenin ortalama parlaklığını ölçer
    // (siyaha düşen geçişleri yakalamak için).
    api.scan = (step = 0.1) => {
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const bw = Math.floor(w * 0.6);
      const bh = Math.floor(h * 0.6);
      const buf = new Uint8Array(bw * bh * 4);
      const out = [];
      for (let t = 0; t <= config.duration + 1e-6; t += step) {
        draw(t);
        gl.readPixels(Math.floor(w * 0.2), Math.floor(h * 0.2), bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i += 64) sum += buf[i];
        out.push([Math.round(t * 10) / 10, Math.round((sum / (buf.length / 64)) * 10) / 10]);
      }
      return out;
    };
    // Çizim maliyeti: ms/kare, GPU bitişi dahil, görünürlükten bağımsız.
    api.bench = (t, n = 60) => {
      const gl = renderer.getContext();
      draw(t);
      gl.finish();
      const t0 = performance.now();
      for (let i = 0; i < n; i++) draw(t + i / 60);
      gl.finish();
      return (performance.now() - t0) / n;
    };
  }

  film.style.setProperty(
    "--screens",
    String(1 + config.duration * config.scroll.screensPerSecond + config.handoff.screens),
  );
  time = targetTime();
  resize();
  sync();

  // --- Yönetmen paneli (?debug=1) ---
  function createDebug() {
    const panel = document.createElement("aside");
    panel.className = "debug";
    panel.setAttribute("aria-label", "Geliştirme paneli");
    panel.innerHTML = `
      <div class="meta" id="dbg-meta"></div>
      <div class="row"><label for="dbg-time">Zaman</label><input id="dbg-time" type="range" min="0" max="${config.duration}" step="0.01"><span id="dbg-time-v"></span></div>
      <div class="stages" id="dbg-stages"></div>
      <h3>Görünüm</h3>
      <div id="dbg-look"></div>
      <div class="stages" style="margin-top:8px"><button type="button" id="dbg-copy">Ayarları kopyala</button><button type="button" id="dbg-reset">Sıfırla</button></div>
    `;
    document.body.appendChild(panel);
    const meta = panel.querySelector("#dbg-meta");
    const slider = panel.querySelector("#dbg-time");
    const sliderV = panel.querySelector("#dbg-time-v");
    slider.addEventListener("input", () => seek(Number(slider.value)));
    const stages = panel.querySelector("#dbg-stages");
    for (const [name, [start, end]] of Object.entries(config.stages)) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name;
      b.addEventListener("click", () => seek(start + (end - start) * 0.7));
      stages.appendChild(b);
    }
    const ranges = {
      bloomStrength: [0, 3, 0.01],
      bloomRadius: [0, 1.5, 0.01],
      bloomThreshold: [0, 1, 0.01],
      exposure: [0.2, 2.5, 0.01],
      grain: [0, 0.2, 0.005],
      vignette: [0, 1, 0.01],
      particleSize: [0.3, 3, 0.01],
      particleAlpha: [0.02, 1, 0.01],
      spin: [0, 4, 0.01],
      gas: [0, 1.2, 0.01],
      coreLight: [0, 2, 0.01],
      dust: [0, 1.5, 0.01],
    };
    const lookBox = panel.querySelector("#dbg-look");
    for (const [key, [min, max, step]] of Object.entries(ranges)) {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `<label for="dbg-${key}">${key}</label><input id="dbg-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${look[key]}"><span>${look[key]}</span>`;
      const input = row.querySelector("input");
      const out = row.querySelector("span");
      input.addEventListener("input", () => {
        look[key] = Number(input.value);
        out.textContent = input.value;
        draw(time);
      });
      lookBox.appendChild(row);
    }
    panel.querySelector("#dbg-copy").addEventListener("click", async () => {
      const text = JSON.stringify(look, null, 2);
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        window.prompt("Ayarlar", text);
      }
    });
    panel.querySelector("#dbg-reset").addEventListener("click", () => {
      Object.assign(look, config.look);
      lookBox.querySelectorAll("input").forEach((input) => {
        const key = input.id.slice(4);
        input.value = look[key];
        input.nextElementSibling.textContent = look[key];
      });
      draw(time);
    });
    let lastMeta = 0;
    return {
      update(t) {
        slider.value = String(Math.min(t, config.duration));
        sliderV.textContent = t.toFixed(2);
        const now = performance.now();
        if (now - lastMeta > 250) {
          lastMeta = now;
          meta.textContent = `${stageAt(t)} · ${count.toLocaleString("tr-TR")} parçacık · ${api.getFps ? api.getFps().toFixed(0) : 0} fps`;
        }
      },
    };
  }
}
