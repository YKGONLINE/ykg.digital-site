(() => {
  const sky = document.querySelector(".inner-page .sky");
  if (!sky) return;

  const size = 512;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.round(size * dpr);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(dpr, dpr);

  let seed = 20260928;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let index = 0; index < 150; index += 1) {
    const bright = random() < 0.07;
    const radius = bright ? 0.8 + random() * 0.5 : 0.4 + random() * 0.4;
    const alpha = bright ? 0.6 + random() * 0.3 : 0.18 + random() * 0.32;
    context.fillStyle = `rgba(242, 242, 242, ${alpha.toFixed(3)})`;
    context.beginPath();
    context.arc(random() * size, random() * size, radius, 0, Math.PI * 2);
    context.fill();
  }

  sky.style.backgroundImage = `url(${canvas.toDataURL("image/png")})`;
  sky.style.backgroundSize = `${size}px ${size}px`;
  document.documentElement.style.setProperty("--site-star-texture", sky.style.backgroundImage);
})();
