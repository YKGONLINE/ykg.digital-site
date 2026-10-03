// Sabit başlık. Filmin sonunda (handoff aralığı) finale logosu sol üstteki yerine uçar,
// başlık metinleri söner. Menü film boyunca erişilebilir. Kaydırmanın saf fonksiyonu: geri kaydırınca logo
// merkeze döner. WebGL yoksa ya da hareket azaltılmışsa başlık baştan yerleşik görünür.

import { filmShare } from "./config.js?v=11";

const root = document.documentElement;
const header = document.getElementById("site-header");
const brand = document.getElementById("brand");
const menuBtn = document.getElementById("menu-btn");
const brandLogo = document.getElementById("brand-logo");
const brandMark = document.getElementById("brand-mark");
const brandWord = document.getElementById("brand-word");
const film = document.getElementById("film");
const hero = document.getElementById("hero");
const finale = document.getElementById("finale");
const finaleLogo = document.getElementById("finale-logo");
const filmSkip = document.querySelector(".film-skip");
const stage = document.getElementById("stage");
const sky = document.getElementById("sky");

// Ana sayfa menüsü açılış karesinde gizlidir; ilk kaydırmayla görünür ve klavyeye açılır.
function revealMenuAfterScroll() {
  if (window.scrollY <= 0 || header.classList.contains("has-scrolled")) return;
  header.classList.add("has-scrolled");
  menuBtn.tabIndex = 0;
}
window.addEventListener("scroll", revealMenuAfterScroll, { passive: true });
revealMenuAfterScroll();

// main.js bu betikten önce çalışır; yüklenemediyse (ağ hatası vb.) film yok sayılır.
if (!root.classList.contains("webgl")) root.classList.add("no-film");

// Başlıktaki geyiğin çizildiği yükseklik (px); styles.css'teki .brand-mark img ile aynı olmalı.
const BRAND_BIG = 360;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * (3 - 2 * x);

// 0: film sürüyor, 1: logo başlıkta.
function handoffProgress() {
  if (!root.classList.contains("webgl")) return 1;
  const total = Math.max(1, film.offsetHeight - hero.offsetHeight);
  const p = -film.getBoundingClientRect().top / total;
  const f = filmShare();
  return clamp01((p - f) / (1 - f));
}

let last = -1;
function update() {
  // Derinlik: yıldızlar kaydırmanın yirmide biri hızla kayar (hareket azaltılmışsa durağan).
  sky.style.backgroundPosition = `0 ${(-window.scrollY * 0.05).toFixed(1)}px`;
  const u = handoffProgress();
  if (u === last) return;
  last = u;
  const fly = smooth(clamp01(u / 0.75)); // logonun yolu

  // Bağlantı, logonun uçuşuyla aynı kaydırma aralığında ve aynı eğriyle söner.
  if (filmSkip) {
    filmSkip.style.opacity = String(1 - fly);
    filmSkip.style.visibility = fly === 1 ? "hidden" : "";
    filmSkip.inert = u > 0;
    filmSkip.setAttribute("aria-hidden", String(u > 0));
  }
  // Tercih simgesi, Sadede gel tamamen kaybolduktan sonra erişilebilir olur.
  root.dataset.privacyReveal = String(fly);
  window.dispatchEvent(new CustomEvent("ykg:film-handoff", { detail: { progress: fly } }));

  if (u > 0 && u < 1 && finaleLogo) {
    // FLIP: başlıktaki logo, finale logosunun ekrandaki yerinden kendi yerine taşınır.
    const from = finaleLogo.getBoundingClientRect();
    const to = brandMark.getBoundingClientRect();
    const k = 1 - fly;
    // Başlıktaki logo büyük çizilip küçültülür (styles.css → .brand-mark img): uçarken hiç
    // büyütülmez, bu yüzden bulanıklaşmaz.
    const scale = (to.height / BRAND_BIG) * (1 + (from.height / to.height - 1) * k);
    const dx = (from.left + from.width / 2 - (to.left + to.width / 2)) * k;
    const dy = (from.top + from.height / 2 - (to.top + to.height / 2)) * k;
    brandLogo.style.transform = `translate(-50%, -50%) translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(4)})`;
    brandLogo.style.willChange = "transform";
  } else {
    brandLogo.style.transform = "";
    brandLogo.style.willChange = "";
  }
  // Film sırasında başlıktaki logo görünmez; finale logosu devralınır (aynı görüntü, aynı yer).
  const finaleOpacity = parseFloat(finale?.style.opacity || "0") || 0;
  brandLogo.style.opacity = u > 0 ? String(Math.max(finaleOpacity, fly)) : "0";
  if (finaleLogo) finaleLogo.style.visibility = u > 0 ? "hidden" : "";
  // Parçacık geyiğin sönük izi merkezde kalmasın: sahne de söner.
  stage.style.opacity = u > 0 ? (1 - smooth(clamp01((u - 0.1) / 0.7))).toFixed(3) : "";
  header.style.setProperty("--shade", fly.toFixed(3));
  header.classList.toggle("is-docked", fly > 0.99);
  brand.tabIndex = fly > 0.99 ? 0 : -1;
  brandWord.style.opacity = smooth(clamp01((u - 0.7) / 0.3)).toFixed(3);
  // Yıldızlar film sönerken belirir: geçişte uzay kesilmez.
  if (root.classList.contains("webgl")) sky.style.opacity = smooth(clamp01((u - 0.1) / 0.7)).toFixed(3);
}

// --- Yıldız karosu: tohumlu, bir kez çizilir, arka planda tekrar eder. ---
function drawSky() {
  const size = 512;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = document.createElement("canvas");
  c.width = c.height = Math.round(size * dpr);
  const g = c.getContext("2d");
  g.scale(dpr, dpr);
  let seed = 20260928;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 150; i++) {
    const bright = rnd() < 0.07;
    const r = bright ? 0.8 + rnd() * 0.5 : 0.4 + rnd() * 0.4;
    const a = bright ? 0.6 + rnd() * 0.3 : 0.18 + rnd() * 0.32;
    g.fillStyle = `rgba(242, 242, 242, ${a.toFixed(3)})`;
    g.beginPath();
    g.arc(rnd() * size, rnd() * size, r, 0, Math.PI * 2);
    g.fill();
  }
  sky.style.backgroundImage = `url(${c.toDataURL("image/png")})`;
  sky.style.backgroundSize = `${size}px ${size}px`;
  document.documentElement.style.setProperty("--site-star-texture", sky.style.backgroundImage);
}
drawSky();

let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    update();
  });
}

window.addEventListener("scroll", schedule, { passive: true });
window.addEventListener("resize", () => {
  last = -1;
  schedule();
});
window.addEventListener("load", () => {
  last = -1;
  schedule();
});
update();
