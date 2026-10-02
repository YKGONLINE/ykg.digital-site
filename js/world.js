// Parçacık dünyası: her parçacığın kalıcı kimliği ve önceden hesaplanmış hedefleri var.
// Sabit tohum: aynı ayarla her açılışta aynı evren.

import * as THREE from "three";

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng) {
  const u = Math.max(rng(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

function unitVector(rng, out) {
  const z = rng() * 2 - 1;
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  out[0] = r * Math.cos(a);
  out[1] = z;
  out[2] = r * Math.sin(a);
  return out;
}

// Kolların açısı: iki ana kol ve onların arasında daha sönük iki yan kol.
function armAngle(rng, g) {
  const main = rng() < g.mainArmShare;
  const arm = Math.floor(rng() * g.arms);
  const offset = (arm * Math.PI * 2) / g.arms + (main ? 0 : Math.PI / g.arms);
  return { offset, weight: main ? 1 : 0.55 };
}

// Kollar boyunca yıldız kümeleri: storyboard'daki pütürlü, dokulu görünüm buradan gelir.
function buildClumps(rng, g) {
  const clumps = [];
  for (let i = 0; i < g.clumps; i++) {
    const r = g.radius * (0.1 + 0.9 * Math.pow(rng(), 0.85));
    const { offset, weight } = armAngle(rng, g);
    const th = offset + r * g.winding + gaussian(rng) * 0.1;
    // Azı parlak ve sıkı yıldız oluşum düğümü (gerçek galaksilerde kolların dış kenarındaki parlak noktalar).
    const knot = rng() < g.knotShare;
    clumps.push([Math.cos(th) * r, Math.sin(th) * r, r, weight * (knot ? 2.2 : 1), knot ? 0.35 : 1]);
  }
  return clumps;
}

// Yan kollar (spur): ana koldan ayrılıp daha açık bir açıyla dışarı uzanan kısa dallar.
function buildSpurs(rng, g) {
  const spurs = [];
  for (let i = 0; i < g.spurs; i++) {
    const r0 = g.radius * (0.22 + 0.62 * rng());
    const { offset, weight } = armAngle(rng, g);
    spurs.push({ r0, th0: offset + r0 * g.winding, len: g.radius * (0.1 + 0.16 * rng()), weight });
  }
  return spurs;
}

// Merkez sprite'ı parlaklığı taşır; iç bölgedeki yoğun parçacıklar sönük tutulur ki çekirdek patlamasın.
function innerDim(r, R) {
  const x = Math.min(1, Math.max(0, (r - R * 0.02) / (R * 0.28)));
  return 0.08 + 0.92 * x * x * (3 - 2 * x);
}

// Spiral galaksi içindeki bir hedef nokta: [x, y, z, parlaklık]
function galaxyPoint(rng, g, clumps, out) {
  const R = g.radius;
  const u = rng();
  if (u < g.bulgeShare) {
    const d = unitVector(rng, [0, 0, 0]);
    const r = Math.abs(gaussian(rng)) * R * 0.07;
    out[0] = d[0] * r;
    out[1] = d[1] * r * 0.5;
    out[2] = d[2] * r;
    out[3] = 0.35;
    return out;
  }
  if (u < g.bulgeShare + g.dustShare) {
    const r = R * Math.sqrt(rng());
    const th = rng() * Math.PI * 2;
    out[0] = Math.cos(th) * r;
    out[1] = gaussian(rng) * 0.3;
    out[2] = Math.sin(th) * r;
    out[3] = 0.22;
    return out;
  }
  if (u < g.bulgeShare + g.dustShare + g.clumpShare) {
    const c = clumps[Math.floor(rng() * clumps.length)];
    const size = (0.18 + c[2] * 0.022) * c[4];
    out[0] = c[0] + gaussian(rng) * size;
    out[1] = gaussian(rng) * 0.25;
    out[2] = c[1] + gaussian(rng) * size;
    out[3] = (0.6 + 0.4 * rng()) * c[3] * innerDim(c[2], R);
    return out;
  }
  if (rng() < g.spurShare) {
    const sp = g._spurs[Math.floor(rng() * g._spurs.length)];
    const k = rng();
    const r = sp.r0 + k * sp.len;
    const th = sp.th0 + k * sp.len * g.winding * 0.3 + gaussian(rng) * 0.03;
    out[0] = Math.cos(th) * r + gaussian(rng) * 0.25;
    out[1] = gaussian(rng) * 0.2;
    out[2] = Math.sin(th) * r + gaussian(rng) * 0.25;
    out[3] = (0.35 + 0.35 * rng()) * sp.weight * (1 - k * 0.5) * innerDim(r, R);
    return out;
  }
  let r = (R * -Math.log(1 - rng() * 0.96)) / 2.4;
  r = Math.max(Math.min(r, R * 1.05), R * 0.06 + rng() * R * 0.06);
  const { offset, weight } = armAngle(rng, g);
  const th = offset + r * g.winding + gaussian(rng) * (0.09 + 0.06 * (r / R));
  const spread = 0.28 + r * 0.035;
  out[0] = Math.cos(th) * r + gaussian(rng) * spread;
  out[1] = gaussian(rng) * (0.7 * (1 - r / R) + 0.1);
  out[2] = Math.sin(th) * r + gaussian(rng) * spread;
  out[3] = (0.45 + 0.55 * rng()) * weight * innerDim(r, R);
  return out;
}

// Çekirdek küreleri için N nokta: fibonacci küresi, tamamen formülle (rastgelelik yok,
// her açılışta ve her tohumda birebir aynı, kürelerin birbirinden ayrık durmasını garantiler.
export function fibonacciSphere(n) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (n === 1 ? 0 : (i / (n - 1)) * 2);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  return pts;
}

export function orbitBasis(o) {
  const ax = (o.tiltX * Math.PI) / 180;
  const az = (o.tiltZ * Math.PI) / 180;
  // Yörünge düzlemindeki (cos, 0, sin) noktasını önce X, sonra Z ekseninde döndürür.
  return (th, out) => {
    let x = Math.cos(th) * o.r;
    let y = 0;
    let z = Math.sin(th) * o.r;
    const y1 = y * Math.cos(ax) - z * Math.sin(ax);
    const z1 = y * Math.sin(ax) + z * Math.cos(ax);
    y = y1;
    z = z1;
    const x2 = x * Math.cos(az) - y * Math.sin(az);
    const y2 = x * Math.sin(az) + y * Math.cos(az);
    out[0] = x2;
    out[1] = y2;
    out[2] = z;
    return out;
  };
}

export function buildParticles(count, cfg) {
  const rng = mulberry32(cfg.seed);
  const dir = new Float32Array(count * 3);
  const gal = new Float32Array(count * 3);
  const rnd = new Float32Array(count * 4);
  const atom = new Float32Array(count * 4);
  // DNA hedefi silindirik koordinatlarda tutulur (eksen boyunca u, eksenden uzaklık r, açı phi,
  // parlaklık) — vertex shader'da her karede uDnaSpin ile döndürülüp dünya koordinatına çevrilir,
  // böylece sarmal kendi ekseni etrafında t'nin saf fonksiyonu olarak yavaşça döner.
  const orb = new Float32Array(count * 4); // atom → DNA rolü ve parametreleri (aşağıda)
  const sortKey = new Float32Array(count); // geyiğe geçişte adayları sıralamak için
  const deer = new Float32Array(count * 4); // PNG yüklenene kadar sıfır: merkezde, görünmez
  const deerBit = new Float32Array(count); // geyik konturunda 0/1 glifi (dot/glif karışık dağılım)
  const deerDelay = new Float32Array(count); // kontur sırasına bağlı varış gecikmesi
  const v = [0, 0, 0];
  const g = [0, 0, 0, 0];
  const o = [0, 0, 0];
  const clumps = buildClumps(rng, cfg.galaxy);
  cfg.galaxy._spurs = buildSpurs(rng, cfg.galaxy);
  const orbits = cfg.atom.orbits.map(orbitBasis);
  const d = cfg.dna;
  // Çekirdek küreleri: sabit (rastgelelik içermeyen) fibonacci dizilimi, ayrı tohumlu rng ile
  // yalnız küme ataması ve iç titreşim için kullanılır — aDna/geyik çekiliş sırasını bozmaz.
  const nucleusCenters = fibonacciSphere(cfg.atom.nucleusSpheres).map((p) => p.map((v) => v * cfg.atom.nucleusShellRadius));
  const nucRng = mulberry32(cfg.seed ^ 0x4e0c1e5);
  // DNA hedefleri yalnız bu AYRI tohumlu rng'yi tüketir: rng/nucRng akışına çağrı eklenmez,
  // böylece DNA'daki bir değişiklik galaksi/atom görüntüsünü kaydırmaz.
  const dnaRng = mulberry32(cfg.seed ^ 0x2a17d0a);
  // 3 yörünge = 3 bant = sarmalda 3 tam tur.
  const bandCount = orbits.length;
  for (let i = 0; i < count; i++) {
    unitVector(rng, v);
    dir.set(v, i * 3);
    galaxyPoint(rng, cfg.galaxy, clumps, g);
    gal[i * 3] = g[0];
    gal[i * 3 + 1] = g[1];
    gal[i * 3 + 2] = g[2];
    rnd[i * 4] = rng(); // geçiş gecikmesi
    rnd[i * 4 + 1] = Math.pow(rng(), 3); // boyut (çoğu küçük, azı iri)
    rnd[i * 4 + 2] = g[3]; // parlaklık
    rnd[i * 4 + 3] = 0.06 + 0.94 * Math.sqrt(rng()); // patlama hızı
    // Yörünge/çekirdek eşiği galaksideki yarıçapa göre ağırlıklanır: kol parçacıkları (büyük r)
    // çoğunlukla yörüngeye, çekirdeğe yakın parçacıklar (küçük r) çoğunlukla çekirdek kürelerine
    // gider — aynı rng() çağrısı kullanılır (yalnız eşik değeri değişir), çekiliş sırası bozulmaz.
    const rNorm = Math.min(1, Math.sqrt(g[0] * g[0] + g[2] * g[2]) / cfg.galaxy.radius);
    const orbitThreshold = Math.min(0.95, Math.max(0.02, cfg.atom.orbitShare * (0.25 + 2.6 * rNorm * rNorm)));
    const isOrbit = rng() < orbitThreshold;
    let oi = 0, th = 0;
    if (isOrbit) {
      oi = Math.floor(rng() * orbits.length);
      rng(); // çekiliş sırası korunur
      // Yörüngedeki açı, parçacığın galaksideki açısıdır: kollar dağılmadan halkalara açılır.
      th = Math.atan2(g[2], g[0]);
      if (th < 0) th += Math.PI * 2;
      orbits[oi](th, o);
      atom[i * 4] = o[0] + gaussian(rng) * 0.1;
      atom[i * 4 + 1] = o[1] + gaussian(rng) * 0.1;
      atom[i * 4 + 2] = o[2] + gaussian(rng) * 0.1;
      atom[i * 4 + 3] = 0.3 + 0.3 * rng();
    } else {
      // Çekirdek: ayrı ayrı seçilen sabit kürelerden birine sıkı bir gauss kümesiyle toplanır
      // (rastgelelik nucRng'den — aDna/geyik çekilişini etkilemez).
      const c = nucleusCenters[Math.floor(nucRng() * nucleusCenters.length)];
      const std = cfg.atom.nucleusClusterStd;
      atom[i * 4] = c[0] + gaussian(nucRng) * std;
      atom[i * 4 + 1] = c[1] + gaussian(nucRng) * std;
      atom[i * 4 + 2] = c[2] + gaussian(nucRng) * std;
      atom[i * 4 + 3] = 0.05 + 0.06 * nucRng();
    }
    // Atom → DNA rolü (tümü dnaRng'den; galaksi/atom çekilişine dokunmaz).
    // 0: kol — yörüngedeki açısı (θ) sarmalda da açısı olur (yörünge önce halkaya hizalanır, sonra
    //    eksen boyunca çekilip sarmala dönüşür; çember + doğrusal hareket = sarmal).
    // 1: basamak — çekirdek küresinden çıkıp bir baz çiftine yerleşir (ortada küçük boşluk).
    // 2: gizli — çekirdeğin kalanı; DNA'da söner.
    if (isOrbit) {
      orb[i * 4] = 0;
      orb[i * 4 + 1] = oi;
      orb[i * 4 + 2] = th;
      orb[i * 4 + 3] = dnaRng() < 0.5 ? 0 : 1;
      sortKey[i] = th + orb[i * 4 + 3] * d.groove;
    } else if (dnaRng() < d.rungShare) {
      const slot = Math.floor(dnaRng() * d.rungSlots);
      const half = dnaRng() < 0.5 ? 0 : 1;
      // Basamak parçacıklarının bir kısmı her yarının ortasında parlak bir boncukta toplanır.
      const bead = dnaRng() < 0.35;
      const sv = bead ? 0.27 + gaussian(dnaRng) * 0.018 : 0.06 + dnaRng() * 0.4;
      orb[i * 4] = 1;
      orb[i * 4 + 1] = slot;
      orb[i * 4 + 2] = half ? 1 - sv : sv;
      orb[i * 4 + 3] = bead ? 1 : 0;
      sortKey[i] = slot;
    } else {
      orb[i * 4] = 2;
      sortKey[i] = dnaRng() * Math.PI * 2;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
  geo.setAttribute("aGal", new THREE.BufferAttribute(gal, 3));
  geo.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 4));
  geo.setAttribute("aAtom", new THREE.BufferAttribute(atom, 4));
  geo.setAttribute("aOrb", new THREE.BufferAttribute(orb, 4));
  geo.userData.sortKey = sortKey;
  geo.setAttribute("aDeer", new THREE.BufferAttribute(deer, 4));
  geo.setAttribute("aDeerBit", new THREE.BufferAttribute(deerBit, 1));
  geo.setAttribute("aDeerDelay", new THREE.BufferAttribute(deerDelay, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return geo;
}

// Sarmalın ışığında geyik logosuna yerleşim: gerçek PNG'nin alfa kanalından örneklenir.
// Çapraz uçuşları azaltmak için hem hedef noktalar hem aday parçacıklar açıya göre sıralanıp eşlenir.
// Ayrıca döner: (a) deerBit — kontur parçacıklarının ~yarısı yuvarlak nokta, yarısı 0/1 glifi olsun
// diye kontur sırasında bloklar hâlinde (iç içe, deterministik) atanır; (b) deerDelay — kontur
// sırasına bağlı varış gecikmesi, çizgi "sırayla çiziliyormuş" gibi dolsun diye.
export function buildDeerTargets(count, sortKey, imageData, imgW, imgH, cfg) {
  const out = new Float32Array(count * 4); // varsayılan: merkezde, görünmez (PNG yüklenmeden önceki durum da budur)
  const outBit = new Float32Array(count);
  const outDelay = new Float32Array(count);
  const data = imageData.data;
  const threshold = cfg.deer.alphaThreshold;
  const stride = Math.max(1, cfg.deer.sampleStride | 0);
  const pts = [];
  let minX = imgW, maxX = 0, minY = imgH, maxY = 0;
  for (let y = 0; y < imgH; y += stride) {
    for (let x = 0; x < imgW; x += stride) {
      const a = data[(y * imgW + x) * 4 + 3];
      if (a > threshold) {
        pts.push(x, y);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const n = pts.length / 2;
  if (n < 1) return { deer: out, deerBit: outBit, deerDelay: outDelay }; // örnekleme boş: geyik hedefi merkezde bekler, kırılmaz
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const order = new Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  order.sort((a, b) => Math.atan2(-(pts[a * 2 + 1] - cy), pts[a * 2] - cx) - Math.atan2(-(pts[b * 2 + 1] - cy), pts[b * 2] - cx));

  // Rol seçimi: DNA hedefinden tamamen bağımsız, kendi tohumuyla kararlı bir yayılım.
  const roleRng = mulberry32(cfg.seed ^ 0xd00d33);
  const outlineIdx = [];
  const dustIdx = [];
  for (let i = 0; i < count; i++) {
    const r = roleRng();
    if (r < cfg.deer.outlineShare) outlineIdx.push(i);
    else if (r < cfg.deer.outlineShare + cfg.deer.dustShare) dustIdx.push(i);
  }
  // Aday parçacıkları, sarmaldaki mevcut açılarına (aDnaCyl.phi) göre sıralar: geyiğe geçişte çapraz uçuş azalır.
  outlineIdx.sort((a, b) => sortKey[a] - sortKey[b]);

  const rng = mulberry32(cfg.seed ^ 0x9e3a1);
  const invH = 1 / imgH;
  // Kontur boyunca ~120 dönüşümlü blok: yarısı nokta, yarısı 0/1 glifi — iç içe, geyiğin bir
  // yarısı bir türde öbür yarısı başka türde kalmasın diye kontur sırası boyunca bloklanır.
  const block = Math.max(1, Math.floor(outlineIdx.length / 240));
  for (let k = 0; k < outlineIdx.length; k++) {
    const i = outlineIdx[k];
    // Parçacıklar kontur boyunca eşit aralıkla dağılır (az parçacıkta boynuzlar eksik kalmasın).
    const p = order[Math.min(n - 1, Math.floor((k / outlineIdx.length) * n))] * 2;
    const nx = (pts[p] - cx) * invH;
    const ny = -(pts[p + 1] - cy) * invH;
    out[i * 4] = nx + (rng() - 0.5) * 0.004;
    out[i * 4 + 1] = ny + (rng() - 0.5) * 0.004;
    out[i * 4 + 2] = (rng() - 0.5) * 0.6;
    out[i * 4 + 3] = 0.32 + rng() * 0.16; // ince, parlaklığı toplanınca patlamayan bir çizgi
    const bandIdx = Math.floor(k / block);
    outBit[i] = bandIdx % 2 === 1 ? (bandIdx % 4 < 2 ? 1 : 2) : 0;
    // Kontur sırasına bağlı, sıkı bir gecikme aralığı: parçacıklar sırayla "çiziliyormuş" gibi varır.
    outDelay[i] = (k / outlineIdx.length) * 0.88;
  }
  for (const i of dustIdx) {
    const p = order[Math.floor(rng() * n)] * 2;
    const nx = (pts[p] - cx) * invH;
    const ny = -(pts[p + 1] - cy) * invH;
    const ang = rng() * Math.PI * 2;
    const spread = 0.12 + rng() * 0.28;
    out[i * 4] = nx + Math.cos(ang) * spread;
    out[i * 4 + 1] = ny + Math.sin(ang) * spread * 0.9;
    out[i * 4 + 2] = (rng() - 0.5) * 3.2;
    out[i * 4 + 3] = 0.05 + rng() * 0.09;
    // Toz bulutu sıralı çizilmez: gevşek, rastgele bir gecikme ile organik kalır.
    outDelay[i] = rng() * 0.5;
  }
  return { deer: out, deerBit: outBit, deerDelay: outDelay };
}

// Bit katmanı: her basamak boyunca eşit aralıklı, tohumlu 0/1 dizisi. Sarmalla aynı silindirik
// koordinatları kullanır; dünyaya çevirme shader'da, parçacıklarla aynı dönüş/eğimle yapılır.
export function buildRungDigits(cfg) {
  const d = cfg.dna;
  const rng = mulberry32(cfg.seed ^ 0xb175);
  const per = d.digitsPerHalf;
  const n = d.rungSlots * per * 2;
  const data = new Float32Array(n * 4);
  let j = 0;
  for (let slot = 0; slot < d.rungSlots; slot++) {
    for (let half = 0; half < 2; half++) {
      for (let k = 0; k < per; k++) {
        const sv = 0.1 + ((k + 0.5) / per) * 0.34;
        data[j++] = slot;
        data[j++] = half ? 1 - sv : sv;
        data[j++] = rng() < 0.5 ? 0 : 1; // rakam
        data[j++] = 0;
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute("aRung", new THREE.BufferAttribute(data, 4));
  // Geyiğe uçuş hedefi (x, y normalize; z: varış gecikmesi) — PNG yüklenince doldurulur.
  geo.setAttribute("aDeerT", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return geo;
}

// Toz şeritleri: kolların iç (içbükey) kenarını izleyen koyu damarlar. Ayrı bir katmanda ışığı
// karartarak çizilir; galaksi parçacıklarıyla aynı dönüşle hareket eder.
export function buildGalaxyDust(count, cfg) {
  const g = cfg.galaxy;
  const R = g.radius;
  const rng = mulberry32(cfg.seed ^ 0xd057);
  const pos = new Float32Array(count * 3);
  const rnd = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = R * (0.1 + 0.85 * Math.pow(rng(), 0.8));
    const main = rng() < 0.8;
    const arm = Math.floor(rng() * g.arms);
    const offset = (arm * Math.PI * 2) / g.arms + (main ? 0 : Math.PI / g.arms);
    const th = offset + r * g.winding + g.dustLag + gaussian(rng) * (0.03 + 0.03 * (r / R)) + (rng() < 0.2 ? gaussian(rng) * 0.25 : 0);
    pos[i * 3] = Math.cos(th) * r + gaussian(rng) * 0.2;
    pos[i * 3 + 1] = gaussian(rng) * 0.12 + 0.15;
    pos[i * 3 + 2] = Math.sin(th) * r + gaussian(rng) * 0.2;
    // Lekeli, kesik kesik toz: yarıçap ve açıya bağlı sabit bir desenle şerit yer yer incelip kopar.
    const patch = 0.5 + 0.5 * Math.sin(r * 0.85 + th * 2.3 + arm * 1.7) * Math.cos(r * 0.37 - th * 1.1);
    rnd[i] = rng() * (main ? 1 : 0.6) * Math.pow(patch, 1.6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return geo;
}

// Aynı kollar, ekranda sabit kalınlıkta yumuşak kenarlı şerit olarak (her noktada iki köşe: aSide ±1).
// 1 piksellik GL çizgisi telefonda tırtıklı görünüyordu; şerit kenarı gölgelendiricide yumuşatılır.
export function buildStrandRibbons(cfg, segments = 240) {
  const bands = cfg.atom.orbits.length;
  const geos = [];
  for (let oi = 0; oi < bands; oi++) {
    for (let strand = 0; strand < 2; strand++) {
      const n = (segments + 1) * 2;
      const data = new Float32Array(n * 4);
      const side = new Float32Array(n);
      for (let k = 0; k <= segments; k++) {
        for (let s = 0; s < 2; s++) {
          const i = k * 2 + s;
          data[i * 4 + 1] = oi;
          data[i * 4 + 2] = (k / segments) * Math.PI * 2;
          data[i * 4 + 3] = strand;
          side[i] = s === 0 ? -1 : 1;
        }
      }
      const index = [];
      for (let k = 0; k < segments; k++) {
        const a = k * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute("aOrb", new THREE.BufferAttribute(data, 4));
      geo.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
      geo.setIndex(index);
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
      geos.push(geo);
    }
  }
  return geos;
}

// 0/1 glifleri için tek doku: sol yarı "0", sağ yarı "1".
export function glyphAtlasTexture() {
  const w = 128, h = 64;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  ctx.font = "700 44px -apple-system, Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("0", w * 0.25, h * 0.54);
  ctx.fillText("1", w * 0.75, h * 0.54);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

export function buildStreaks(count, cfg) {
  const rng = mulberry32(cfg.seed ^ 0x51f15e);
  const dir = new Float32Array(count * 2 * 3);
  const rnd = new Float32Array(count * 2 * 2);
  const end = new Float32Array(count * 2);
  const v = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    unitVector(rng, v);
    const speed = 0.35 + 1.25 * rng();
    const bright = 0.3 + 0.7 * rng();
    for (let k = 0; k < 2; k++) {
      const j = i * 2 + k;
      dir.set(v, j * 3);
      rnd[j * 2] = speed;
      rnd[j * 2 + 1] = bright;
      end[j] = k;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
  geo.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
  geo.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 2));
  geo.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return geo;
}

export function buildStars(count, cfg) {
  const rng = mulberry32(cfg.seed ^ 0x57a25);
  const pos = new Float32Array(count * 3);
  const rnd = new Float32Array(count);
  const v = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    unitVector(rng, v);
    const r = 420 + rng() * 300;
    pos[i * 3] = v[0] * r;
    pos[i * 3 + 1] = v[1] * r;
    pos[i * 3 + 2] = v[2] * r;
    rnd[i] = Math.pow(rng(), 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 1));
  return geo;
}

// Uzak galaksiler için küçük, kodla çizilmiş bir doku.
export function farGalaxyTexture(seed) {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const rng = mulberry32(seed);
  const h = size / 2;
  const glow = ctx.createRadialGradient(h, h, 0, h, h, h);
  glow.addColorStop(0, "rgba(255,255,255,0.9)");
  glow.addColorStop(0.08, "rgba(255,255,255,0.35)");
  glow.addColorStop(0.4, "rgba(255,255,255,0.05)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const r = -Math.log(1 - rng() * 0.98) * 26;
    const arm = rng() < 0.5 ? 0 : Math.PI;
    const th = arm + r * 0.055 + gaussian(rng) * 0.25;
    const x = h + Math.cos(th) * r + gaussian(rng) * 3;
    const y = h + Math.sin(th) * r + gaussian(rng) * 3;
    ctx.fillStyle = `rgba(255,255,255,${0.12 + 0.3 * rng()})`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Galaksi düzlemi için kodla üretilmiş gaz/toz dokusu: spirale bükülmüş fbm gürültü, şişkin
// çekirdek ve kollar arası koyu toz şeritleri. Tek kanal (beyaz), alfa yoğunluğu taşır.
function makeValueNoise2D(rng) {
  const size = 64;
  const table = new Float32Array(size * size);
  for (let i = 0; i < table.length; i++) table[i] = rng();
  const at = (x, y) => table[((y % size) + size) % size * size + (((x % size) + size) % size)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const s = xf * xf * (3 - 2 * xf);
    const t = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * s + (c - a) * t + (a - b - c + d) * s * t;
  };
}

function fbm(noise, x, y, octaves) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

export function nebulaTexture(cfg) {
  const g = cfg.galaxy;
  const n = g.nebula;
  const size = n.textureSize;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  const rng = mulberry32(cfg.seed ^ 0x6e3b01a);
  const noise = makeValueNoise2D(rng);
  const h = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - h) / h;
      const dy = (y - h) / h;
      const r = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 4;
      if (r > 1.02) {
        img.data[idx + 3] = 0;
        continue;
      }
      const ang = Math.atan2(dy, dx);
      const rWorld = r * g.radius;
      // Aynı kol formülü (galaxyPoint'teki th = offset + r*winding ile aynı mantık): kollar bu açıda parlar.
      const armPhase = g.arms * (ang - rWorld * g.winding);
      const armWave = 0.5 + 0.5 * Math.cos(armPhase);
      const turbulence = fbm(noise, x * 0.035, y * 0.035, 5) * 0.5 + fbm(noise, x * 0.09 + 40, y * 0.09 + 40, 4) * 0.5;
      const dust = fbm(noise, x * 0.02 + 90, y * 0.02 + 90, 4);
      // Şişkin çekirdek: merkeze yakın güçlü, yumuşak parlaklık.
      const bulge = n.coreGlow * Math.exp(-r * r * 14);
      const armDensity = n.armDensity * Math.pow(armWave, 1.6) * (0.55 + 0.65 * turbulence);
      // Kollar arası (armWave düşükken) toz şeritleri daha da koyulaşır.
      const laneDark = 1 - n.dustDarkness * (1 - armWave) * (0.4 + 0.6 * dust);
      const radialFalloff = Math.pow(Math.max(0, 1 - r), 0.7);
      let a = (bulge + armDensity) * laneDark * radialFalloff;
      a = Math.max(0, Math.min(1, a));
      img.data[idx] = 255;
      img.data[idx + 1] = 255;
      img.data[idx + 2] = 255;
      img.data[idx + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function coreTexture() {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const h = size / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.06, "rgba(255,255,255,0.95)");
  g.addColorStop(0.18, "rgba(255,255,255,0.45)");
  g.addColorStop(0.42, "rgba(255,255,255,0.1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
