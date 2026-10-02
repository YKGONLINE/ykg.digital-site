// Zaman çizelgesi: her şey t'nin saf fonksiyonu. Aynı t → aynı kare (ileri/geri sarma, atla, yeniden izle).
// Anahtar kareler monoton kübik eğriyle yumuşatılır; aşırı salınım yok.

function track(keys) {
  const n = keys.length;
  const xs = keys.map((k) => k[0]);
  const ys = keys.map((k) => k[1]);
  const d = [];
  const m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * d[i];
      m[i + 1] = tau * b * d[i];
    }
  }
  return (t) => {
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const s = (t - xs[i]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    return (
      (2 * s3 - 3 * s2 + 1) * ys[i] +
      (s3 - 2 * s2 + s) * h * m[i] +
      (-2 * s3 + 3 * s2) * ys[i + 1] +
      (s3 - s2) * h * m[i + 1]
    );
  };
}

const tracks = {
  // Kamera: küre koordinatları, merkez = galaksinin çekirdeği. Galaksiden atoma kamera geri çekilir
  // (dalış yok). DNA'dan sonra sarmala yandan bakılır ve bu açı geyik/logoya kadar korunur.
  camDist: track([
    [0, 14], [2.3, 9], [3.3, 30], [5.2, 88], [8.4, 76], [11, 46], [13, 54], [15, 70], [17, 68],
    [18, 66], [19.5, 64], [21.5, 48], [22.5, 42], [25, 30], [26, 36], [27, 55], [32.5, 55],
  ]),
  camPolar: track([[0, 90], [2.3, 90], [5.2, 74], [8.4, 60], [10.3, 40], [11, 32], [13.2, 50], [15.6, 66], [17, 70], [18, 72], [21.5, 80], [25, 84], [27, 90], [32.5, 90]]), // derece, +Y ekseninden
  camAz: track([[0, 0], [5.2, 8], [11, 38], [13.3, 55], [17, 78], [18, 80], [21.5, 8], [25, 0], [32.5, 0]]),
  // Parçacıklar
  expand: track([[0, 0], [2.3, 0], [2.7, 14], [3.6, 58], [5.2, 125], [6.6, 140]]),
  form: track([[0, 0], [5.0, 0], [8.7, 1]]),
  alpha: track([[0, 0], [2.2, 0], [2.8, 0.55], [3.8, 1],  [26, 1], [30.5, 1], [31.6, 1], [32.5, 0.1]]),
  streak: track([[0, 0], [2.3, 0], [2.5, 1], [4.0, 0.55], [5.4, 0]]),
  stars: track([[0, 0], [2.6, 0], [4.6, 1]]),
  far: track([[0, 0], [3.0, 0], [5.0, 1], [7.6, 1], [9.8, 0.3], [11.5, 0]]),
  // Merkezdeki ışık: görünüm yüksekliğinin oranı olarak. Big Bang'den sonra küçük kalır, atomda
  // söner; DNA'dan sonra yok.
  coreSize: track([
    [0, 0.01], [1.2, 0.013], [1.75, 2.6], [2.3, 1.3], [3.2, 0.34], [5.2, 0.15], [8.4, 0.13], [11, 0.2], [12.5, 0.18], [13.8, 0.12], [14.8, 0.04], [15.4, 0.03], [17, 0.03],
    [18.5, 0.03], [20, 0], [32.5, 0],
  ]),
  // Ekran yalnız Big Bang'de beyaza gider (~1.8–2.05 sn).
  flash: track([[0, 0], [1.45, 0], [1.8, 1], [2.05, 1], [2.75, 0], [32.5, 0]]),
  // Galaksi yakın çekimde parlamasın: yalnız bu aşamada bloom kısılır (YKG ayarı: 0.9 × 0.26 ≈ 0.23).
  // Atom da düşük bloom'la daha temiz okunur (küreler tek tek seçilir); DNA'da normale döner.
  bloomMul: track([[0, 1], [7.5, 1], [8.8, 0.26], [11.2, 0.26], [13.8, 0.34], [17.6, 0.34], [18.8, 1]]),
  // Çekirdekten atoma
  atom: track([[0, 0], [12.8, 0], [13.5, 0.13], [16.6, 1]]),
  // Çekirdek küreleri kamera çekirdekten geri çekildikten sonra belirir (yakında ekranı kaplamasın).
  nucleusShow: track([[0, 0], [14.2, 0], [15.1, 1]]),
  orbitLines: track([[0, 0], [13.7, 0], [14.3, 1], [26, 1], [26.7, 0]]),
  electrons: track([[0, 0], [16.3, 0], [17.1, 1], [18, 1], [18.9, 0]]),
  // Atom → DNA: yörüngeler halkaya hizalanır (align), halka eksen boyunca çekilip sarmal olur (stretch).
  align: track([[0, 0], [18, 0], [19.6, 1]]),
  stretch: track([[0, 0], [19.2, 0], [21.6, 1]]),
  // Basamaklar (çekirdekten gelen baz çiftleri) ve 0/1 rakamları
  rungs: track([[0, 0], [20.4, 0], [21.8, 1]]),
  glyph: track([[0, 0], [22.6, 0], [24.4, 1]]),
  // Bit aşamasında yakın çekim: bloom kısılır
  closeUp: track([[0, 0], [22, 0], [24, 0.5], [26.2, 0.5], [26.8, 0]]),
  // Sarmaldan geyik logosuna: konum karışımı (uDeer) ve kamera varlık ağırlığı.
  deer: track([[0, 0], [26.2, 0], [29.4, 1], [32.5, 1]]),
  geyik: track([[0, 0], [26, 0], [26.6, 1], [32.5, 1]]),
  // Gerçek HTML logo + başlığın belirmesi.
  logoReveal: track([[0, 0], [29.5, 0], [30.5, 1], [32.5, 1]]),
};

export function sample(t, look, ambient = 0) {
  const s = {};
  for (const [key, fn] of Object.entries(tracks)) s[key] = fn(t);
  // Hiçlikteki noktanın nefesi: yalnız ilk aşamada.
  const breath = t < 1.3 ? 1 + 0.14 * Math.sin(t * 4.2) * Math.min(1, t / 0.3) : 1;
  s.coreSize *= breath;
  // Galaksi dönüşü süre bitse de devam eder (kare donmaz).
  s.spin = look.spin * (0.07 * Math.max(0, t - 4.6) + 0.012 * ambient * s.form);
  return s;
}
