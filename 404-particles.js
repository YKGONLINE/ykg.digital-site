(() => {
  const code = document.getElementById("error-code");
  const canvas = document.getElementById("particle-canvas");
  const context = canvas && canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!code || !canvas || !context) return;

  const mask = document.createElement("canvas");
  const maskContext = mask.getContext("2d", { willReadFrequently: true });
  if (!maskContext) return;

  let particles = [];
  let animationFrame = 0;
  let elapsedMs = 0;
  let lastTimestamp = null;
  let lastPaintTimestamp = 0;
  let viewportVisible = true;
  let viewportWidth = 0;
  let viewportHeight = 0;
  let pixelRatio = 1;
  let seed = 4042026;

  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const ease = (value) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };

  function randomOffscreenPoint(width, height) {
    const angle = random() * Math.PI * 2;
    const distance = Math.hypot(width, height) * (0.56 + random() * 0.88);
    return {
      x: width / 2 + Math.cos(angle) * distance,
      y: height / 2 + Math.sin(angle) * distance,
    };
  }

  function resizeCanvas() {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(viewportWidth * pixelRatio));
    canvas.height = Math.max(1, Math.round(viewportHeight * pixelRatio));
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function buildParticles() {
    const bounds = code.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !viewportWidth || !viewportHeight) return false;

    const targetDpr = pixelRatio;
    mask.width = Math.round(bounds.width * targetDpr);
    mask.height = Math.round(bounds.height * targetDpr);
    maskContext.setTransform(targetDpr, 0, 0, targetDpr, 0, 0);
    maskContext.clearRect(0, 0, bounds.width, bounds.height);
    maskContext.fillStyle = "#fff";
    const style = getComputedStyle(code);
    maskContext.font = `${style.fontWeight} ${style.fontSize} Manrope`;
    maskContext.textAlign = "center";
    maskContext.textBaseline = "middle";
    maskContext.fillText("404", bounds.width / 2, bounds.height / 2);

    const pixels = maskContext.getImageData(0, 0, mask.width, mask.height).data;
    const targets = [];
    for (let y = 0; y < mask.height; y += 1) {
      for (let x = 0; x < mask.width; x += 1) {
        if (pixels[(y * mask.width + x) * 4 + 3] > 128) {
          targets.push({ x: bounds.left + x / targetDpr, y: bounds.top + y / targetDpr });
        }
      }
    }
    if (targets.length < 100) return false;

    const particleCount = viewportWidth < 640 ? 1000 : 1800;
    seed = 4042026;
    for (let index = targets.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [targets[index], targets[swapIndex]] = [targets[swapIndex], targets[index]];
    }

    particles = Array.from({ length: particleCount }, (_, index) => {
      const target = targets[index % targets.length];
      const source = randomOffscreenPoint(viewportWidth, viewportHeight);
      return {
        x: target.x,
        y: target.y,
        sourceX: source.x,
        sourceY: source.y,
        delay: random() * 0.55,
        radius: viewportWidth < 640 ? 0.48 + random() * 0.35 : 0.5 + random() * 0.36,
        alpha: 0.8 + random() * 0.18,
        phase: random() * Math.PI * 2,
      };
    });

    document.body.classList.add("has-particles");
    code.classList.add("has-particles");
    return true;
  }

  function formationProgress(seconds, delay) {
    return ease((seconds - delay) / 5.4);
  }

  function draw(timestamp) {
    animationFrame = 0;
    if (lastTimestamp !== null) elapsedMs += Math.min(timestamp - lastTimestamp, 80);
    lastTimestamp = timestamp;
    const seconds = elapsedMs / 1000;
    if (elapsedMs >= 5950 && lastPaintTimestamp && timestamp - lastPaintTimestamp < 1000 / 30) {
      animationFrame = window.requestAnimationFrame(draw);
      return;
    }
    lastPaintTimestamp = timestamp;
    context.clearRect(0, 0, viewportWidth, viewportHeight);

    for (const particle of particles) {
      const progress = formationProgress(seconds, particle.delay);
      const formed = progress >= 1;
      const x = particle.sourceX + (particle.x - particle.sourceX) * progress
        + (formed ? Math.sin(seconds * 0.62 + particle.phase) * 1.15 : 0);
      const y = particle.sourceY + (particle.y - particle.sourceY) * progress
        + (formed ? Math.cos(seconds * 0.54 + particle.phase) * 1.05 : 0);
      const shimmer = formed
        ? 0.97 + Math.sin(seconds * 0.72 + particle.phase) * 0.055
        : 0.9 + Math.sin(seconds * 0.42 + particle.phase) * 0.06;
      context.beginPath();
      context.fillStyle = `rgba(248, 248, 248, ${(particle.alpha * shimmer).toFixed(3)})`;
      context.arc(x, y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }

    animationFrame = window.requestAnimationFrame(draw);
  }

  function syncAnimation() {
    const shouldAnimate = viewportVisible && document.visibilityState === "visible";
    if (shouldAnimate && !animationFrame && particles.length) {
      lastTimestamp = null;
      animationFrame = window.requestAnimationFrame(draw);
    } else if (!shouldAnimate && animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      lastTimestamp = null;
      lastPaintTimestamp = 0;
    }
  }

  function checkViewport() {
    const bounds = code.getBoundingClientRect();
    viewportVisible = bounds.bottom > 0 && bounds.top < window.innerHeight;
    syncAnimation();
  }

  function resizeAndRebuild() {
    resizeCanvas();
    if (buildParticles()) {
      syncAnimation();
    }
  }

  function initialize() {
    resizeAndRebuild();
    if (!particles.length) return;

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        viewportVisible = entries.some((entry) => entry.isIntersecting);
        syncAnimation();
      });
      observer.observe(code);
    } else {
      window.addEventListener("scroll", checkViewport, { passive: true });
      checkViewport();
    }

    window.addEventListener("resize", resizeAndRebuild, { passive: true });
    document.addEventListener("visibilitychange", syncAnimation);
    syncAnimation();
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(initialize);
  else initialize();
})();
