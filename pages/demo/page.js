export function mountPage(context) {
  context.setTitle("Demo");

  const canvasEl = document.getElementById("demoCanvas");
  if (!canvasEl) {
    return { dispose() {} };
  }

  const context2d = canvasEl.getContext("2d");
  let animationFrameHandle = null;
  let isDisposed = false;
  const particles = createParticles();

  syncCanvasSize();
  window.addEventListener("resize", syncCanvasSize);
  void renderLoop();

  return {
    dispose() {
      isDisposed = true;
      window.removeEventListener("resize", syncCanvasSize);
      if (animationFrameHandle !== null) {
        cancelAnimationFrame(animationFrameHandle);
        animationFrameHandle = null;
      }
    }
  };

  function createParticles() {
    return Array.from({ length: 36 }, (_, index) => ({
      angle: (index / 36) * Math.PI * 2,
      radius: 0.18 + (index % 6) * 0.11,
      speed: 0.35 + (index % 5) * 0.07,
      size: 4 + (index % 4) * 2,
      hue: 28 + (index % 7) * 26,
      phase: index * 0.37
    }));
  }

  function syncCanvasSize() {
    const width = Math.max(1, Math.floor(window.innerWidth));
    const height = Math.max(1, Math.floor(window.innerHeight));
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const targetWidth = Math.max(1, Math.floor(width * pixelRatio));
    const targetHeight = Math.max(1, Math.floor(height * pixelRatio));

    if (canvasEl.width !== targetWidth || canvasEl.height !== targetHeight) {
      canvasEl.width = targetWidth;
      canvasEl.height = targetHeight;
    }

    canvasEl.style.width = `${width}px`;
    canvasEl.style.height = `${height}px`;
  }

  async function renderLoop() {
    if (isDisposed) {
      return;
    }

    renderFrame();

    if (isDisposed) {
      return;
    }

    animationFrameHandle = requestAnimationFrame(() => {
      animationFrameHandle = null;
      void renderLoop();
    });
  }

  function renderFrame() {
    if (!context2d) {
      return;
    }

    const width = canvasEl.width;
    const height = canvasEl.height;
    const time = performance.now() / 1000;
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.26;

    context2d.save();
    context2d.setTransform(1, 0, 0, 1, 0, 0);
    context2d.clearRect(0, 0, width, height);
    const gradient = context2d.createRadialGradient(centerX, centerY, baseRadius * 0.15, centerX, centerY, Math.max(width, height) * 0.72);
    gradient.addColorStop(0, "rgba(255, 226, 180, 0.12)");
    gradient.addColorStop(1, "rgba(3, 7, 18, 0.96)");
    context2d.fillStyle = gradient;
    context2d.fillRect(0, 0, width, height);
    context2d.restore();

    context2d.save();
    context2d.strokeStyle = "rgba(255, 255, 255, 0.05)";
    context2d.lineWidth = Math.max(1, Math.round(width / 960));
    for (let x = 0; x < width; x += Math.max(56, Math.floor(width / 16))) {
      context2d.beginPath();
      context2d.moveTo(x, 0);
      context2d.lineTo(x, height);
      context2d.stroke();
    }
    for (let y = 0; y < height; y += Math.max(56, Math.floor(height / 16))) {
      context2d.beginPath();
      context2d.moveTo(0, y);
      context2d.lineTo(width, y);
      context2d.stroke();
    }
    context2d.restore();

    for (const particle of particles) {
      const orbit = baseRadius * particle.radius;
      const wobble = Math.sin(time * particle.speed + particle.phase) * baseRadius * 0.12;
      const x = centerX + Math.cos(particle.angle + time * particle.speed * 0.6) * (orbit + wobble);
      const y = centerY + Math.sin(particle.angle * 1.3 + time * particle.speed * 0.8) * (orbit * 0.68 + wobble * 0.6);
      const alpha = 0.32 + (Math.sin(time * 1.7 + particle.phase) + 1) * 0.18;

      context2d.save();
      context2d.fillStyle = `hsla(${particle.hue}, 92%, 68%, ${alpha})`;
      context2d.beginPath();
      context2d.arc(x, y, particle.size * (0.8 + alpha * 0.7), 0, Math.PI * 2);
      context2d.fill();
      context2d.restore();
    }

    context2d.save();
    context2d.strokeStyle = "rgba(255, 255, 255, 0.16)";
    context2d.lineWidth = Math.max(2, Math.round(width / 320));
    context2d.beginPath();
    context2d.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
    context2d.stroke();
    context2d.restore();
  }
}