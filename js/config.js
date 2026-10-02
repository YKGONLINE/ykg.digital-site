// Tek ayar kaynağı: süreler, yoğunluk, görünüm. Yönetmen paneli (?debug=1) `look` değerlerini canlı değiştirir.

export const config = {
  seed: 20260928,
  maxDpr: 2, // telefonda keskinlik (YKG); MSAA kapalı kalmalı (DEVIR → Dersler)
  counts: {
    desktop: 200000,
    narrow: 80000,
    narrowMaxWidth: 760,
    streaks: 4000,
    stars: 2500,
    farGalaxies: 40,
    farGalaxyVariants: 3,
  },
  // Storyboard karelerine karşılık gelen aşamalar (saniye).
  stages: {
    nokta: [0, 1.2], // 01
    beyaz: [1.2, 2.3], // 02
    cikis: [2.3, 5.2], // 03
    galaksiler: [5.2, 8.4], // 04
    galaksi: [8.4, 11], // 05
    cekirdek: [11, 13.4], // 06–07
    atom: [13.4, 18], // 08
    dna: [18, 22.5], // 09 — yörüngeler halkaya hizalanır, halka çekilip çift sarmal olur (yandan)
    bit: [22.5, 26], // 10 — kamera yaklaşır, basamaklar 0/1 olarak okunur
    geyik: [26, 30.5], // 11 — parçacıklar geyik logosunu kontur sırasıyla çizer
    logo: [30.5, 32.5], // 12 — temiz logo + başlık
  },
  duration: 32.5,
  // Sahne yazıları (saniye aralığı → metin). Metni değiştirmek için yalnız burayı düzenle.
  captions: (document.documentElement.lang === "en" ? [
    { t: [1.7, 4.6], text: "Idea." },
    { t: [6.2, 9.4], text: "Direction." },
    { t: [14.6, 17.8], text: "System." },
    { t: [19.6, 23.4], text: "Life." },
  ] : [
    { t: [1.7, 4.6], text: "Fikir." },
    { t: [6.2, 9.4], text: "Yön." },
    { t: [14.6, 17.8], text: "Sistem." },
    { t: [19.6, 23.4], text: "Hayat." },
  ]),
  // Film kaydırmayla oynar: saniye başına kaç ekran boyu kaydırma, zamanın kaydırmayı izleme hızı.
  scroll: {
    screensPerSecond: 0.34,
    follow: 5,
  },
  // Film bittikten sonra logo sol üstteki başlığa taşınır; bu geçiş için filmin sonuna eklenen
  // kaydırma payı (ekran boyu). Bu aralıkta film son karede durur.
  handoff: {
    screens: 0.9,
  },
  galaxy: {
    radius: 30,
    arms: 2,
    mainArmShare: 0.68,
    winding: 0.3,
    bulgeShare: 0.08,
    dustShare: 0.1,
    clumps: 900,
    clumpShare: 0.4,
    knotShare: 0.08, // kümelerin parlak düğüm olan payı
    spurs: 120, // yan kol sayısı
    spurShare: 0.12, // kol parçacıklarının yan kollara giden payı
    dustCount: 32000, // toz şeridi parçacığı (dar ekranda yarısı)
    dustLag: -0.2, // toz şeridinin koldan açısal kayması (içbükey kenar)
    // Parçacıkların altındaki kodla üretilmiş gaz/toz katmanı (galaksi aşaması, storyboard 04/05).
    nebula: {
      textureSize: 1024,
      coreGlow: 0.9, // şişkin çekirdek parlaklığı
      armDensity: 0.85, // kollardaki gaz yoğunluğu
      dustDarkness: 0.55, // kollar arası toz şeritlerinin koyuluğu
    },
  },
  // Galaksi = atom: galaksinin iç (çekirdeğe yakın) parçacıkları çekirdek kürelerine toplanır,
  // dış (kol) parçacıkları yörüngelere dizilir — yarıçapa göre ağırlıklı, rastgelelik ayrı tohumlu.
  atom: {
    orbitShare: 0.2, // temel yörünge payı; dış parçacıklarda bunun çok üstünde, iç parçacıklarda altında
    orbits: [
      { r: 30, tiltX: 8, tiltZ: 0 },
      { r: 30, tiltX: 62, tiltZ: 35 },
      { r: 30, tiltX: -50, tiltZ: -40 },
    ],
    electrons: 8,
    nucleusSpheres: 13, // ortada ayrı ayrı seçilen küre (proton/nötron) sayısı
    nucleusShellRadius: 3.4, // kürelerin ortak merkezden uzaklığı
    nucleusClusterStd: 0.85, // her kürenin kendi içindeki gauss yayılımı
  },
  // Galaksi = atom = DNA: aynı parçacıklar, atomun yörünge açısı (θ) korunarak çift sarmalın
  // hedeflerine geçer — YANDAN görünen klasik DNA ikonu (tünel değil). Yörünge parçacıkları (aAtom
  // "orbit" dalı) iki kolu oluşturur; çekirdek küresi parçacıkları (aAtom "nucleus" dalı) basamaklara
  // dağılır ya da ince sis olarak söner.
  dna: {
    axisLength: 46, // sarmalın eksen boyu (3 bant = 3 tur)
    axisTilt: 18, // derece: sarmal kadrajı çapraz kessin (referans görsel)
    radius: 7, // sarmal yarıçapı
    groove: 2.44, // iki kol arası faz (~140°): büyük/küçük oluk asimetrisi DNA'yı yaydan ayırır
    rungSlots: 30, // baz çifti sayısı (gerçek DNA'da tur başına ~10)
    rungShare: 0.07, // çekirdek parçacıklarından basamağa geçen pay
    spinSpeed: 0.2, // sarmalın kendi ekseninde dönüşü (rad/sn, t'nin saf fonksiyonu)
    digitsPerHalf: 3, // basamağın her yarısında okunan rakam sayısı
    digitPx: 17, // 1440×900'de rakam yüksekliği (px)
  },
  // Sarmalın son ışığında geyik logosuna yerleşim.
  deer: {
    src: "assets/mark-deer.png",
    alphaThreshold: 40, // bu alfanın üstü çizgi sayılır
    sampleStride: 2, // görüntüden örnekleme adımı
    outlineShare: 0.2, // geyik çizgisine yerleşen parçacık payı
    dustShare: 0.22, // çevresindeki sönük toz bulutu payı (kalanı söner)
    camDist: 55, // geyik/logo aşamasında kameranın sabit uzaklığı: parçacıklar küçük kalsın, çizgi net görünsün
  },
  look: {
    bloomStrength: 0.9,
    bloomRadius: 0.55,
    bloomThreshold: 0.22,
    exposure: 1.0,
    grain: 0.035,
    vignette: 0.45,
    particleSize: 1.0,
    particleAlpha: 0.2,
    spin: 1.0,
    gas: 0.32, // galaksinin gaz katmanının parlaklığı
    coreLight: 0.75, // merkez ışığın büyüklüğü (çarpan)
    dust: 0.5, // galaksideki toz şeritlerinin koyuluğu
  },
};

// Filmin kaydırma alanında filme ayrılan pay; kalanı logo geçişi (handoff).
export function filmShare() {
  const film = config.duration * config.scroll.screensPerSecond;
  return film / (film + config.handoff.screens);
}

export function stageAt(t) {
  for (const [name, [, end]] of Object.entries(config.stages)) {
    if (t < end) return name;
  }
  return "logo";
}
