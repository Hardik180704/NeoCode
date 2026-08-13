import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { Logo, GITHUB_URL } from "./Shared";

const FOOTER_SIGNAL_LINES = ["ASK CODE", "INSPECT FILES", "BUILD CHANGES"] as const;

const footerGroups = [
  {
    label: "Product",
    links: [
      { label: "Overview", href: "#product" },
      { label: "Commands", href: "#commands" },
      { label: "Themes", href: "#themes" },
      { label: "Install", href: "#install" },
    ],
  },
  {
    label: "Downloads",
    links: [
      { label: "Releases", href: `${GITHUB_URL}/releases`, external: true },
      { label: "Homebrew", href: "#install" },
      { label: "macOS + Linux", href: "#install" },
      { label: "Windows", href: "#install" },
    ],
  },
  {
    label: "Project",
    links: [
      { label: "GitHub", href: GITHUB_URL, external: true },
      { label: "README", href: `${GITHUB_URL}#readme`, external: true },
      { label: "Issues", href: `${GITHUB_URL}/issues`, external: true },
      { label: "MIT License", href: `${GITHUB_URL}/blob/main/LICENSE`, external: true },
    ],
  },
] as const;

function FooterSignal() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const signalCanvas = canvasRef.current!;
    if (!signalCanvas) return;
    const signalContainer = signalCanvas.parentElement!;
    if (!signalContainer) return;
    const signalContext = signalCanvas.getContext("2d")!;
    if (!signalContext) return;

    let frame: number | null = null;
    let visible = false;
    let scale = 1;
    let startedAt = performance.now();
    let pointerX = 0;
    let pointerY = 0;
    let pointerTargetX = 0;
    let pointerTargetY = 0;
    let pointerStrength = 0;
    let pointerTargetStrength = 0;

    function resize() {
      const bounds = signalContainer.getBoundingClientRect();
      scale = Math.min(window.devicePixelRatio || 1, 2);
      signalCanvas.width = Math.max(1, Math.round(bounds.width * scale));
      signalCanvas.height = Math.max(1, Math.round(bounds.height * scale));
      if (pointerX === 0 && pointerY === 0) {
        pointerX = bounds.width / 2;
        pointerY = bounds.height / 2;
        pointerTargetX = pointerX;
        pointerTargetY = pointerY;
      }
    }

    function draw(timestamp: number) {
      const width = signalCanvas.width / scale;
      const height = signalCanvas.height / scale;
      if (width <= 1 || height <= 1) return;

      signalContext.setTransform(scale, 0, 0, scale, 0, 0);
      signalContext.clearRect(0, 0, width, height);
      signalContext.textBaseline = "top";

      const horizontalPadding = 12;
      const preferredFontSize = Math.min(60, width * 0.082);
      signalContext.font = `400 ${preferredFontSize}px "Sixtyfour Variable", "IBM Plex Mono", monospace`;
      const widestLine = Math.max(...FOOTER_SIGNAL_LINES.map((line) => signalContext.measureText(line).width));
      const availableTextWidth = Math.max(1, width - horizontalPadding * 2);
      const fontSize = widestLine > availableTextWidth
        ? preferredFontSize * (availableTextWidth / widestLine)
        : preferredFontSize;
      const lineHeight = fontSize * 1.24;
      const contentHeight = lineHeight * FOOTER_SIGNAL_LINES.length;
      const startY = Math.max(0, (height - contentHeight) / 2);
      const elapsed = reduceMotion ? 2900 : timestamp - startedAt;
      const progress = (elapsed % 7600) / 7600;

      pointerX += (pointerTargetX - pointerX) * 0.13;
      pointerY += (pointerTargetY - pointerY) * 0.13;
      pointerStrength += (pointerTargetStrength - pointerStrength) * 0.1;

      signalContext.font = `400 ${fontSize}px "Sixtyfour Variable", "IBM Plex Mono", monospace`;

      FOOTER_SIGNAL_LINES.forEach((line, index) => {
        const y = startY + index * lineHeight;
        signalContext.fillStyle = "rgba(103, 136, 188, 0.68)";
        signalContext.fillText(line, horizontalPadding, y);

        const lineProgress = (progress + index * 0.16) % 1;
        const center = -width * 0.2 + lineProgress * width * 1.42;
        const gradient = signalContext.createLinearGradient(center - width * 0.24, 0, center + width * 0.24, 0);
        gradient.addColorStop(0, "rgba(45, 82, 190, 0)");
        gradient.addColorStop(0.34, "rgba(45, 82, 190, 0.5)");
        gradient.addColorStop(0.52, "rgba(74, 116, 200, 0.62)");
        gradient.addColorStop(0.68, "rgba(70, 130, 180, 0.36)");
        gradient.addColorStop(1, "rgba(70, 130, 180, 0)");

        signalContext.save();
        signalContext.globalCompositeOperation = "source-atop";
        signalContext.fillStyle = gradient;
        signalContext.fillRect(0, y, width, lineHeight);
        signalContext.restore();
      });

      if (pointerStrength > 0.002) {
        const radius = Math.max(190, width * 0.34);
        const pointerGlow = signalContext.createRadialGradient(pointerX, pointerY, 0, pointerX, pointerY, radius);
        pointerGlow.addColorStop(0, `rgba(243, 248, 255, ${0.92 * pointerStrength})`);
        pointerGlow.addColorStop(0.2, `rgba(91, 140, 255, ${0.78 * pointerStrength})`);
        pointerGlow.addColorStop(0.55, `rgba(137, 180, 250, ${0.42 * pointerStrength})`);
        pointerGlow.addColorStop(0.8, `rgba(125, 211, 252, ${0.14 * pointerStrength})`);
        pointerGlow.addColorStop(1, "rgba(125, 211, 252, 0)");

        signalContext.save();
        signalContext.globalCompositeOperation = "source-atop";
        signalContext.fillStyle = pointerGlow;
        signalContext.fillRect(0, 0, width, height);
        signalContext.restore();
      }

      signalContext.save();
      signalContext.globalCompositeOperation = "destination-out";
      signalContext.fillStyle = "rgba(0, 0, 0, 0.4)";
      for (let y = 1; y < height; y += 4) signalContext.fillRect(0, y, width, 1);
      signalContext.fillStyle = "rgba(0, 0, 0, 0.22)";
      for (let y = 3; y < height; y += 10) {
        const offset = Math.floor(y / 10) % 2 === 0 ? 0 : 7;
        for (let x = offset; x < width; x += 17) signalContext.fillRect(x, y, 2, 1);
      }
      signalContext.restore();
    }

    function animate(timestamp: number) {
      frame = null;
      draw(timestamp);
      if (visible && !reduceMotion) frame = window.requestAnimationFrame(animate);
    }

    function start() {
      if (frame === null && !reduceMotion) frame = window.requestAnimationFrame(animate);
      if (reduceMotion) draw(performance.now());
    }

    function handlePointerMove(event: PointerEvent) {
      if (reduceMotion || event.pointerType === "touch") return;
      const bounds = signalContainer.getBoundingClientRect();
      pointerTargetX = event.clientX - bounds.left;
      pointerTargetY = event.clientY - bounds.top;
      pointerTargetStrength = 1;
      start();
    }

    function handlePointerLeave() {
      pointerTargetStrength = 0;
    }

    resize();
    draw(performance.now());

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    resizeObserver.observe(signalContainer);

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      if (!visible && frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
    }, { threshold: 0.04 });
    visibilityObserver.observe(signalContainer);

    signalContainer.addEventListener("pointermove", handlePointerMove, { passive: true });
    signalContainer.addEventListener("pointerleave", handlePointerLeave);

    void document.fonts.ready.then(() => {
      if (!signalCanvas.isConnected) return;
      startedAt = performance.now();
      resize();
      draw(performance.now());
    });

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      signalContainer.removeEventListener("pointermove", handlePointerMove);
      signalContainer.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [reduceMotion]);

  return (
    <div className="footer-signal">
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="footer-signal-mobile" aria-hidden="true">
        {FOOTER_SIGNAL_LINES.map((line) => <span key={line}>{line}</span>)}
      </div>
      <span className="sr-only">Ask about code. Inspect project files. Build changes from the terminal.</span>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner section-shell">
        <div className="footer-main">
          <FooterSignal />
          <div className="footer-navigation" role="navigation" aria-label="Footer navigation">
            {footerGroups.map((group) => (
              <div className="footer-group" key={group.label}>
                <h2>{group.label}</h2>
                <ul>
                  {group.links.map((link) => (
                    <li key={`${group.label}-${link.label}`}>
                      <a
                        href={link.href}
                        target={"external" in link && link.external ? "_blank" : undefined}
                        rel={"external" in link && link.external ? "noreferrer" : undefined}
                      >
                        <span>{link.label}</span>
                        {"external" in link && link.external ? <i aria-hidden="true">↗</i> : null}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="footer-bottom">
          <Logo />
          <p>Open-source terminal coding agent.</p>
          <span>MIT LICENSE</span>
          <span>© {new Date().getFullYear()} NEOCODE</span>
        </div>
      </div>
    </footer>
  );
}
