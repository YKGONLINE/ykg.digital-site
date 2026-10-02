// Kurum → Mesaj → Kanal: oluşumdan sonra küreler ve mesaj akışı hareketini sürdürür.
(() => {
  const diagram = document.getElementById("brand-diagram");
  const canvas = document.getElementById("brand-scene");
  if (!diagram || !canvas) return;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  const count = window.matchMedia("(max-width: 640px)").matches ? 300 : 420;
  const width = 360, height = 220, duration = 4.6;
  const institutionCount = Math.ceil(count * 0.3);
  const messageCount = Math.ceil(count * 0.25);
  const channelCount = count - institutionCount - messageCount;
  let seed = 20260930;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const ease = (value) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };
  const mix = (a, b, t) => a + (b - a) * t;
  const sphere = (index, total) => {
    const vertical = 1 - 2 * (index + 0.5) / total;
    return { vertical, ring: Math.sqrt(Math.max(0, 1 - vertical * vertical)), angle: index * 2.3999632297 };
  };

  // Yuvarlak köşeli konuşma balonu: noktalar bu kapalı yol üzerinde akar.
  const outline = [];
  const corner = (cx, cy, from) => {
    for (let i = 0; i <= 8; i++) {
      const angle = from + i / 8 * Math.PI / 2;
      outline.push({ x: cx + Math.cos(angle) * 9, y: cy + Math.sin(angle) * 9 });
    }
  };
  corner(154, 93, Math.PI);
  corner(206, 93, Math.PI * 1.5);
  corner(206, 120, 0);
  outline.push({ x: 175, y: 129 }, { x: 160, y: 141 }, { x: 164, y: 129 });
  corner(154, 120, Math.PI / 2);
  let perimeter = 0;
  const segments = outline.map((point, index) => {
    const next = outline[(index + 1) % outline.length];
    const length = Math.hypot(next.x - point.x, next.y - point.y);
    const segment = { point, next, length, start: perimeter };
    perimeter += length;
    return segment;
  });
  function messagePoint(position) {
    const distance = ((position % 1 + 1) % 1) * perimeter;
    for (const segment of segments) {
      if (distance <= segment.start + segment.length) {
        const t = segment.length ? (distance - segment.start) / segment.length : 0;
        return { x: mix(segment.point.x, segment.next.x, t), y: mix(segment.point.y, segment.next.y, t) };
      }
    }
    return outline[0];
  }

  const particles = Array.from({ length: count }, (_, index) => {
    const angle = random() * Math.PI * 2;
    const distance = 150 + random() * 170;
    const group = index < institutionCount ? 0 : index < institutionCount + messageCount ? 1 : 2;
    const channelIndex = index - institutionCount - messageCount;
    return {
      sourceX: 180 + Math.cos(angle) * distance,
      sourceY: 110 + Math.sin(angle) * distance * 0.8,
      institution: sphere(index % institutionCount, institutionCount),
      messagePosition: (index - institutionCount) / messageCount,
      channel: ((channelIndex % 3) + 3) % 3,
      channelSphere: sphere(Math.max(0, Math.floor(channelIndex / 3)), Math.ceil(channelCount / 3)),
      group, delay: random() * 0.18, bend: (random() - 0.5) * 50,
      radius: 0.65 + random() * 0.42,
      phase: random() * Math.PI * 2,
    };
  });

  const paths = [
    { fromX: 81, fromY: 110, toX: 138, toY: 110, bend: -8, start: 1.35 },
    { fromX: 222, fromY: 110, toX: 298, toY: 60, bend: -10, start: 2.9 },
    { fromX: 222, fromY: 110, toX: 298, toY: 110, bend: 0, start: 2.9 },
    { fromX: 222, fromY: 110, toX: 298, toY: 160, bend: 10, start: 2.9 },
  ];
  const glow = document.createElement("canvas");
  glow.width = glow.height = 48;
  const glowContext = glow.getContext("2d");
  if (glowContext) {
    const gradient = glowContext.createRadialGradient(24, 24, 0, 24, 24, 24);
    gradient.addColorStop(0, "rgba(255,255,255,0.65)");
    gradient.addColorStop(0.16, "rgba(255,255,255,0.1)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    glowContext.fillStyle = gradient;
    glowContext.fillRect(0, 0, 48, 48);
  }

  let seconds = 0, frame = 0, lastTimestamp = null, lastPaint = 0, visible = false;
  const dot = (x, y, radius, alpha) => {
    context.globalAlpha = alpha;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  };

  function draw(time) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#fff";
    for (const path of paths) {
      const progress = ease((time - path.start) / 1.15);
      if (!progress) continue;
      for (let step = 0; step <= 30 * progress; step++) {
        const t = step / 30;
        dot(mix(path.fromX, path.toX, t), mix(path.fromY, path.toY, t) + Math.sin(t * Math.PI) * path.bend, 0.6, 0.2);
      }
      // Küçük ışık akımları, oluşum tamamlandıktan sonra da yönü gösterir.
      const head = ((time - path.start) * 0.22) % 1;
      if (head <= progress) {
        for (let trail = 5; trail >= 0; trail--) {
          const t = head - trail * 0.018;
          if (t < 0) continue;
          const x = mix(path.fromX, path.toX, t);
          const y = mix(path.fromY, path.toY, t) + Math.sin(t * Math.PI) * path.bend;
          if (!trail && glowContext) {
            context.globalAlpha = 0.8;
            context.drawImage(glow, x - 6, y - 6, 12, 12);
          }
          dot(x, y, trail ? 0.8 : 1.4, (1 - trail / 6) * 0.9);
        }
      }
    }

    particles.forEach((particle) => {
      const rotation = time * 0.25;
      const s = particle.institution;
      const depth = (Math.sin(s.angle + rotation) * s.ring + 1) / 2;
      const institutionX = 44 + Math.cos(s.angle + rotation) * s.ring * 33;
      const institutionY = 110 + s.vertical * 33;
      const gather = ease((time - particle.delay) / 1.15);
      const formMessage = particle.group > 0 ? ease((time - 1.35 - particle.delay) / 1.3) : 0;
      const spread = particle.group === 2 ? ease((time - 2.9 - particle.delay) / 1.4) : 0;
      let x = mix(particle.sourceX, institutionX, gather);
      let y = mix(particle.sourceY, institutionY, gather);
      const message = messagePoint(particle.messagePosition + time * 0.012);
      x = mix(x, message.x, formMessage);
      y = mix(y, message.y, formMessage) + Math.sin(formMessage * Math.PI) * particle.bend;
      const c = particle.channelSphere;
      const channelRotation = c.angle + time * 0.42;
      const channelX = 316 + Math.cos(channelRotation) * c.ring * 14;
      const channelY = 60 + particle.channel * 50 + c.vertical * 14;
      x = mix(x, channelX, spread);
      y = mix(y, channelY, spread) + Math.sin(spread * Math.PI) * particle.bend;
      const alpha = particle.group === 0 ? 0.38 + depth * 0.6 : 0.82 + Math.sin(time * 0.8 + particle.phase) * 0.12;
      dot(x, y, particle.radius, alpha);
    });
    context.globalAlpha = 1;
  }

  function resize() {
    const bounds = canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
    canvas.width = Math.max(1, Math.round(bounds.width * dpr));
    canvas.height = Math.max(1, Math.round(bounds.height * dpr));
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    draw(seconds);
  }
  function animate(timestamp) {
    frame = 0;
    if (lastTimestamp !== null) seconds += Math.min(timestamp - lastTimestamp, 80) / 1000;
    lastTimestamp = timestamp;
    if (seconds < duration || timestamp - lastPaint >= 1000 / 30) {
      draw(seconds);
      lastPaint = timestamp;
    }
    if (visible && !document.hidden) frame = requestAnimationFrame(animate);
  }
  function sync() {
    if (visible && !document.hidden) {
      if (!frame) frame = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTimestamp = null;
    }
  }

  canvas.hidden = false;
  diagram.classList.add("has-animation");
  resize();
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas.parentElement);
  else window.addEventListener("resize", resize);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.35, rootMargin: "0px 0px -8% 0px" }).observe(canvas);
  } else {
    visible = true;
    sync();
  }
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTimestamp = null;
  });
  window.addEventListener("pageshow", sync);
})();
