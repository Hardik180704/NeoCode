import { useEffect, useRef, useState, type ReactNode } from "react";
import { MarkGithubIcon } from "@primer/octicons-react";
import { motion, useInView, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { Icon, GITHUB_URL } from "./Shared";
import { MockupStage } from "./MockupStage";

const PLAYGROUND_SCENARIOS = {
  payment: {
    prompt: "Find where failed payments are retried.",
    files: ["src/payments/retry.ts", "src/payments/service.ts", "src/api/webhooks.ts"],
    response: "The retry flow starts in retry.ts and is triggered by the webhook handler.",
    chips: ["retry.ts", "service.ts", "webhooks.ts"],
    statusText: "Analyzing repository...",
    countText: "3 relevant files found."
  },
  lens: {
    prompt: "/lens",
    files: ["indexing project...", "resolved 42 file nodes", "building dependency graph..."],
    response: "NeoLens codebase intelligence visualization workspace is compiled and ready.",
    chips: ["Graph View (F1)", "Workspace (F2)", "Timeline (F3)"],
    statusText: "Initializing NeoLens codebase intelligence...",
    countText: "Graph compilation successful."
  },
  mcp: {
    prompt: "/mcp",
    files: ["checking .neocode/mcp.json...", "connecting to github-mcp stdio server...", "connecting to weather-api http server..."],
    response: "2 active MCP servers connected with 14 available tools.",
    chips: ["github-mcp (stdio)", "weather-api (http)"],
    statusText: "Loading Model Context Protocol configurations...",
    countText: "All tool access policies loaded."
  },
  sessions: {
    prompt: "/sessions",
    files: ["retrieving session registry...", "session-a4b2: fix auth flow (10m ago)", "session-7c2e: update payment route (2h ago)"],
    response: "3 persistent terminal sessions found. Reopening session registry interface.",
    chips: ["session-a4b2", "session-7c2e", "active-session"],
    statusText: "Connecting to local Railway API endpoint...",
    countText: "Registry retrieved."
  }
} as const;

type PlaygroundScenarioKey = keyof typeof PLAYGROUND_SCENARIOS;

const HERO_TERMINAL_TYPE_MS = 42;

const heroTerminalPhaseRank = { typing: 0, analyzing: 1, files: 2, count: 3, response: 4, done: 5 } as const;
type HeroTerminalPhase = keyof typeof heroTerminalPhaseRank;

function HeroTerminalBlock({ reduceMotion, className, children }: { reduceMotion: boolean; className?: string; children: ReactNode }) {
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function NeoCodeHeroTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, amount: 0.35 });
  const reduceMotion = useReducedMotion() ?? false;
  const [scenarioKey, setScenarioKey] = useState<PlaygroundScenarioKey>("payment");
  const [phase, setPhase] = useState<HeroTerminalPhase>("typing");
  const [charCount, setCharCount] = useState(0);
  const [fileCount, setFileCount] = useState(0);

  const scenario = PLAYGROUND_SCENARIOS[scenarioKey];
  const started = inView && !reduceMotion;

  useEffect(() => {
    setPhase("typing");
    setCharCount(0);
    setFileCount(0);
  }, [scenarioKey]);

  useEffect(() => {
    if (!started) return;
    let timer: number;
    if (phase === "typing") {
      timer = charCount < scenario.prompt.length
        ? window.setTimeout(() => setCharCount((count) => count + 1), HERO_TERMINAL_TYPE_MS)
        : window.setTimeout(() => setPhase("analyzing"), 250);
    } else if (phase === "analyzing") {
      timer = window.setTimeout(() => setPhase("files"), 700);
    } else if (phase === "files") {
      timer = fileCount < scenario.files.length
        ? window.setTimeout(() => setFileCount((count) => count + 1), 320)
        : window.setTimeout(() => setPhase("count"), 250);
    } else if (phase === "count") {
      timer = window.setTimeout(() => setPhase("response"), 500);
    } else if (phase === "response") {
      timer = window.setTimeout(() => setPhase("done"), 500);
    }
    return () => window.clearTimeout(timer);
  }, [started, phase, charCount, fileCount, scenarioKey, scenario.prompt.length, scenario.files.length]);

  const rank = heroTerminalPhaseRank[phase];
  const typedText = reduceMotion ? scenario.prompt : scenario.prompt.slice(0, charCount);
  const visibleFiles = reduceMotion ? scenario.files.length : fileCount;
  const showAnalyzing = reduceMotion || rank >= heroTerminalPhaseRank.analyzing;
  const showCount = reduceMotion || rank >= heroTerminalPhaseRank.count;
  const showResponse = reduceMotion || rank >= heroTerminalPhaseRank.response;

  function selectScenario(key: PlaygroundScenarioKey) {
    setPhase("typing");
    setCharCount(0);
    setFileCount(0);
    if (key !== scenarioKey) setScenarioKey(key);
  }

  return (
    <MockupStage variant="hero" className="hero-terminal-stage">
      <div className="hero-mockup-composition">
        <div ref={containerRef} className="hero-terminal" aria-label="NeoCode terminal session">
        <div className="ht-header" aria-hidden="true">
          <div className="ht-dots"><i /><i /><i /></div>
          <span className="ht-path">neocode — terminal</span>
          <div className="ht-header-right">
            <span className="mac-status"><i /> NEOCODE</span>
          </div>
        </div>
        <div className="ht-body">
          <aside className="ht-sidebar" aria-hidden="true">
            <span className="ht-sidebar-label">PROJECT</span>
            <span className="ht-project-name">payments-app</span>
            <span className="ht-tree">src/</span>
            <span className="ht-tree ht-tree-nested">api/</span>
            <span className="ht-tree ht-tree-nested">payments/</span>
            <span className="ht-tree ht-tree-nested">auth/</span>
            <span className="ht-tree ht-tree-nested">components/</span>
          </aside>
          <div className="ht-convo">
            <div className="ht-user">
              <span className="ht-user-prefix">&gt;</span>
              <span>{typedText}</span>
              <span className="terminal-cursor ht-cursor" aria-hidden="true" />
            </div>
            {showAnalyzing ? <HeroTerminalBlock reduceMotion={reduceMotion} className="ht-status">{scenario.statusText}</HeroTerminalBlock> : null}
            {visibleFiles > 0 ? (
              <div className="ht-files">
                {scenario.files.slice(0, visibleFiles).map((file) => (
                  <HeroTerminalBlock reduceMotion={reduceMotion} className="ht-file" key={file}>
                    <span className="ht-check">✓</span>
                    <span>{file}</span>
                  </HeroTerminalBlock>
                ))}
              </div>
            ) : null}
            {showCount ? <HeroTerminalBlock reduceMotion={reduceMotion} className="ht-count">{scenario.countText}</HeroTerminalBlock> : null}
            {showResponse ? (
              <HeroTerminalBlock reduceMotion={reduceMotion} className="ht-response">
                <p>{scenario.response}</p>
                <div className="ht-chips">
                  {scenario.chips.map((chip) => (
                    <span key={chip}>{chip}</span>
                  ))}
                </div>
              </HeroTerminalBlock>
            ) : null}
          </div>
        </div>
        </div>

        <div className="theme-picker-bar hero-scenario-bar" role="group" aria-label="Terminal examples">
        {(["payment", "lens", "mcp", "sessions"] as const).map((key) => {
          const labels = {
            payment: "Find Payment Retry",
            lens: "Run /lens",
            mcp: "Run /mcp",
            sessions: "Run /sessions"
          };
          return (
            <button
              key={key}
              type="button"
              className={scenarioKey === key ? "theme-chip theme-chip-active" : "theme-chip"}
              onClick={() => selectScenario(key)}
              aria-pressed={scenarioKey === key}
            >
              <span className="theme-chip-dot" />
              {labels[key]}
            </button>
          );
        })}
        </div>
      </div>
    </MockupStage>
  );
}

const HERO_TITLE_LINES = ["Code with NeoCode.", "Stay in your terminal."] as const;

function HeroHoverHeading() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(-300);
  const pointerY = useMotionValue(-300);
  const revealOpacity = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 220, damping: 30, mass: 0.7 });
  const smoothY = useSpring(pointerY, { stiffness: 220, damping: 30, mass: 0.7 });
  const smoothOpacity = useSpring(revealOpacity, { stiffness: 180, damping: 24, mass: 0.6 });
  const spotlight = useMotionTemplate`radial-gradient(240px circle at ${smoothX}px ${smoothY}px, rgba(243, 247, 255, 1) 0%, rgba(91, 140, 255, 0.98) 28%, rgba(137, 180, 250, 0.9) 56%, rgba(125, 211, 252, 0.68) 74%, rgba(125, 211, 252, 0) 100%)`;

  function handlePointerMove(event: React.PointerEvent<HTMLHeadingElement>) {
    if (reduceMotion || event.pointerType === "touch") return;
    const bounds = headingRef.current?.getBoundingClientRect();
    if (!bounds) return;
    pointerX.set(event.clientX - bounds.left);
    pointerY.set(event.clientY - bounds.top);
    revealOpacity.set(1);
  }

  function handlePointerLeave() {
    revealOpacity.set(0);
  }

  return (
    <h1 ref={headingRef} onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
      <span className="hero-title-base">
        {HERO_TITLE_LINES.map((line) => <span className="hero-title-line" key={line}>{line}</span>)}
      </span>
      <motion.span
        aria-hidden="true"
        className="hero-title-reveal"
        style={{ backgroundImage: spotlight, opacity: smoothOpacity }}
      >
        {HERO_TITLE_LINES.map((line) => <span className="hero-title-line" key={line}>{line}</span>)}
      </motion.span>
    </h1>
  );
}

const HERO_DOT_COLORS = ["#89b4fa", "#5b8cff", "#7dd3fc"] as const;
const HERO_DOT_GAP = 9;
const HERO_DOT_TOP_SHINE = 170;
const HERO_DOME_PEAK = 330;
const HERO_DOME_DROP = 400;
const HERO_DOME_FADE = 150;

interface HeroDot {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  fade: number;
  color: string;
  phase: number;
  speed: number;
}

function HeroBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const hero = canvas.parentElement!;
    if (!hero) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    let dots: HeroDot[] = [];
    let frame: number | null = null;
    let visible = false;
    let scale = 1;

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * scale));
      canvas.height = Math.max(1, Math.round(bounds.height * scale));

      const width = bounds.width;
      const next: HeroDot[] = [];
      let index = 0;
      for (let x = HERO_DOT_GAP / 2; x < width; x += HERO_DOT_GAP) {
        const u = (x - width / 2) / (width / 2);
        const boundaryY = HERO_DOME_PEAK + u * u * HERO_DOME_DROP;
        for (let y = HERO_DOT_GAP / 2; y < boundaryY; y += HERO_DOT_GAP) {
          next.push({
            x,
            y,
            size: 0.8 + Math.random() * 0.9,
            baseAlpha: 0.17 + Math.random() * 0.24,
            fade: Math.min(1, (boundaryY - y) / HERO_DOME_FADE),
            color: HERO_DOT_COLORS[index % HERO_DOT_COLORS.length],
            phase: Math.random() * Math.PI * 2,
            speed: 0.9 + Math.random() * 0.9,
          });
          index++;
        }
      }
      dots = next;
    }

    function drawDots(timestamp: number, width: number) {
      const t = timestamp / 1000;
      const sweepProgress = (t % 6.5) / 6.5;
      const sweepX = -160 + sweepProgress * (width + 320);
      for (const dot of dots) {
        const twinkle = 0.5 + 0.5 * Math.sin(t * dot.speed + dot.phase);
        const topShine = dot.y < HERO_DOT_TOP_SHINE ? 1 - dot.y / HERO_DOT_TOP_SHINE : 0;
        let alpha = dot.baseAlpha * twinkle * dot.fade * (1 + topShine * 1.6);

        const sweepDistance = (dot.x - sweepX) / 130;
        const sweep = Math.exp(-sweepDistance * sweepDistance) * dot.fade;
        alpha += sweep * 0.55;

        ctx.globalAlpha = Math.min(1, alpha);
        ctx.fillStyle = dot.color;
        ctx.fillRect(dot.x - dot.size / 2, dot.y - dot.size / 2, dot.size, dot.size);
      }
      ctx.globalAlpha = 1;
    }

    function draw(timestamp: number) {
      const width = canvas.width / scale;
      const height = canvas.height / scale;
      if (width <= 1 || height <= 1) return;

      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, width, height);

      drawDots(timestamp, width);
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

    resize();
    draw(performance.now());

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    resizeObserver.observe(hero);

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    visibilityObserver.observe(hero);

    return () => {
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [reduceMotion]);

  return <canvas ref={canvasRef} className="hero-pixels" aria-hidden="true" />;
}

export function Hero() {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <section className="hero section-shell" id="top" style={{ position: "relative" }}>
      <div className="hero-glow" aria-hidden="true" />
      <HeroBackdrop />
      <motion.div
        className="hero-copy"
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        style={{ position: "relative", zIndex: 1 }}
      >
        <HeroHoverHeading />
        <p>
          NeoCode brings deep repository understanding, visible tool execution, MCP integrations, and interactive past-activity inspection right into your terminal shell.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href="#install">
            <span>GET STARTED</span>
            <Icon name="arrow" />
          </a>
          <a className="button button-secondary" href={GITHUB_URL} target="_blank" rel="noreferrer">
            <MarkGithubIcon size={18} />
            <span>VIEW ON GITHUB</span>
          </a>
        </div>
      </motion.div>
      <motion.div
        className="hero-mockup"
        initial={reduceMotion ? false : { opacity: 0, y: 44 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, delay: 0.15 }}
        style={{ position: "relative", zIndex: 1 }}
      >
        <NeoCodeHeroTerminal />
      </motion.div>
    </section>
  );
}
