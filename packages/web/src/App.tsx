import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { MarkGithubIcon } from "@primer/octicons-react";
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react";

const GITHUB_URL = "https://github.com/Hardik180704/NeoCode";

type IconName = "arrow" | "check" | "copy" | "menu" | "x";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
    copy: <path d="M9 9h10v10H9zM5 15H4V5h10v1" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  );
}

function BrandWordmark({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? "brand-wordmark brand-wordmark-large" : "brand-wordmark"} role="img" aria-label="NeoCode">
      <span>NEO</span><strong>CODE</strong>
    </span>
  );
}

function Logo() {
  return (
    <a className="logo" href="#top" aria-label="NeoCode home">
      <BrandWordmark />
    </a>
  );
}

async function writeClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Clipboard access is unavailable");
  }
}

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await writeClipboard(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="install-command">
      <span>$</span>
      <code>{command}</code>
      <button type="button" onClick={copy} aria-label={copied ? "Copied" : "Copy install command"}>
        <Icon name={copied ? "check" : "copy"} size={15} />
        <span>{copied ? "COPIED" : "COPY"}</span>
      </button>
    </div>
  );
}

function useCycle(length: number, interval: number) {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % length), interval);
    return () => window.clearInterval(timer);
  }, [interval, length, reduceMotion]);

  return index;
}

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        <nav className={open ? "nav-open" : ""} aria-label="Primary navigation">
          <a href="#product" onClick={() => setOpen(false)}>PRODUCT</a>
          <a href="#commands" onClick={() => setOpen(false)}>COMMANDS</a>
          <a href="#themes" onClick={() => setOpen(false)}>THEMES</a>
          <a href="#install" onClick={() => setOpen(false)}>INSTALL</a>
          <a className="nav-github" href={GITHUB_URL} target="_blank" rel="noreferrer">
            <MarkGithubIcon aria-hidden="true" size={16} /> GITHUB
          </a>
        </nav>
        <button
          type="button"
          className="menu-button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <Icon name={open ? "x" : "menu"} />
        </button>
      </div>
    </header>
  );
}

const promptExamples = [
  "Explain how authentication works in this project",
  "Find where failed payments are retried",
  "Add tests for the session middleware",
];

function TerminalInput({ prompt }: { prompt?: string }) {
  return (
    <div className="terminal-input">
      <div className="terminal-input-line">
        <span className="terminal-cursor" />
        <span className={prompt ? "prompt-value" : "prompt-placeholder"}>{prompt ?? "Ask anything..."}</span>
      </div>
      <div className="terminal-mode"><strong>Build</strong><span>›</span><em>claude-opus-4-6</em></div>
    </div>
  );
}

type MacFrameProps = {
  children: ReactNode;
  scene: "alpine" | "monolith";
  title: string;
  variant?: string;
};

function MacFrame({ children, scene, title, variant = "" }: MacFrameProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={`mockup-scene mockup-scene-${scene} ${variant}`.trim()}>
      <div className="scene-light scene-light-left" aria-hidden="true" />
      <div className="scene-light scene-light-right" aria-hidden="true" />
      <motion.div
        className="mac-window"
        whileHover={reduceMotion ? undefined : { y: -4 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mac-titlebar" aria-hidden="true">
          <div className="mac-controls"><i /><i /><i /></div>
          <span className="mac-title">{title}</span>
          <span className="mac-status"><i /> NEOCODE</span>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

function PromptMockup() {
  const activePrompt = useCycle(promptExamples.length, 3400);

  return (
    <MacFrame scene="alpine" title="neocode — project" variant="scene-prompt">
      <div className="terminal-canvas prompt-mockup" aria-label="Animated NeoCode prompt interface">
        <div className="prompt-brand"><BrandWordmark large /></div>
        <div className="prompt-input-wrap">
          <div className="terminal-input">
            <div className="terminal-input-line">
              <span className="terminal-cursor" />
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  className="prompt-placeholder"
                  key={promptExamples[activePrompt]}
                  initial={{ opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -7 }}
                  transition={{ duration: 0.28 }}
                >
                  {promptExamples[activePrompt]}
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="terminal-mode"><strong>Build</strong><span>›</span><em>claude-opus-4-6</em></div>
          </div>
          <div className="terminal-hint"><b>tab</b><span>agents</span></div>
        </div>
        <div className="terminal-sweep" aria-hidden="true" />
      </div>
    </MacFrame>
  );
}

const commands = [
  ["/new", "Start a new conversation"],
  ["/agents", "Switch agents"],
  ["/models", "Select AI model for generation"],
  ["/sessions", "Browse past sessions"],
  ["/lens", "Watch and replay activity across the dependency graph"],
  ["/mcp", "Inspect configured MCP servers and tools"],
  ["/theme", "Change color theme"],
  ["/login", "Sign in with your browser"],
] as const;

function CommandPaletteMockup() {
  const activeCommand = useCycle(commands.length, 1350);

  return (
    <MacFrame scene="monolith" title="neocode — commands" variant="scene-commands">
      <div className="terminal-canvas command-mockup" aria-label="Animated NeoCode slash-command menu">
        <div className="command-list">
          {commands.map(([command, description], index) => (
            <div className={index === activeCommand ? "command-row command-row-active" : "command-row"} key={command}>
              {index === activeCommand ? <motion.span className="command-selection" layoutId="command-selection" /> : null}
              <code>{command}</code><span>{description}</span>
            </div>
          ))}
        </div>
        <TerminalInput prompt="/" />
        <div className="terminal-hint"><b>tab</b><span>agents</span></div>
      </div>
    </MacFrame>
  );
}

const activityRows = [
  ["Thinking", "Let me explore the project structure to understand what this project contains."],
  ["List Directory", "."],
  ["Read File", "README.md"],
  ["Read File", "package.json"],
  ["Read File", "pyproject.toml"],
  ["List Directory", "CH-1_CreateMCP"],
  ["Read File", "CH-1_CreateMCP/1_first_mcpserver_stdio.py"],
] as const;

function ActivityMockup() {
  return (
    <MacFrame scene="alpine" title="neocode — session" variant="scene-activity">
      <div className="terminal-canvas activity-mockup" aria-label="NeoCode tool activity interface">
        <div className="activity-stream">
          {activityRows.map(([action, target], index) => (
            <motion.div
              className={index === 0 ? "activity-row activity-thinking" : "activity-row"}
              initial={{ opacity: 0.18, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.9 }}
              transition={{ delay: index * 0.1, duration: 0.35 }}
              key={`${action}-${target}`}
            >
              <em>{action}:</em><span>{target}</span>
            </motion.div>
          ))}
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false }} transition={{ delay: 0.9 }}>
            I now have a comprehensive understanding of this project. Here&apos;s my analysis:
          </motion.p>
        </div>
        <TerminalInput />
        <div className="mock-scroll"><motion.i animate={{ y: [0, 160, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} /></div>
      </div>
    </MacFrame>
  );
}

const analysisLines = [
  "## Project Overview",
  "This repository contains a chapter-by-chapter MCP learning project for Python.",
  "### Tech Stack",
  "- Python with uv as the package manager",
  "- FastMCP for MCP servers",
  "- MCP SDK for the Python client",
  "### Project Structure",
  "| Path | Purpose |",
  "| main.py | Minimal entry point |",
] as const;

function AnalysisMockup() {
  return (
    <MacFrame scene="monolith" title="neocode — analysis" variant="scene-analysis">
      <div className="terminal-canvas analysis-mockup" aria-label="NeoCode repository analysis response">
        <div className="analysis-content">
          <p>I now have a comprehensive understanding of this project. Here&apos;s my analysis:</p>
          {analysisLines.map((line, index) => (
            <motion.div
              className={line.startsWith("#") ? "analysis-heading" : "analysis-line"}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.8 }}
              transition={{ delay: index * 0.07, duration: 0.3 }}
              key={line}
            >
              {line}
            </motion.div>
          ))}
        </div>
        <TerminalInput />
        <div className="mock-scroll"><i /></div>
      </div>
    </MacFrame>
  );
}

const themes = [
  { name: "Nightfox", accent: "#56D6C2", background: "#0D0D12", surface: "#1A1A24" },
  { name: "Catppuccin Mocha", accent: "#E0AF68", background: "#11111B", surface: "#1E1E2E" },
  { name: "Dracula", accent: "#BD93F9", background: "#282A36", surface: "#343746" },
  { name: "Monokai Pro", accent: "#AB9DF2", background: "#2D2A2E", surface: "#403E41" },
  { name: "Tokyo Night", accent: "#7AA2F7", background: "#1A1B26", surface: "#24283B" },
  { name: "Nord", accent: "#81A1C1", background: "#2E3440", surface: "#3B4252" },
] as const;

function ThemeMockup() {
  const activeTheme = useCycle(themes.length, 1800);
  const theme = themes[activeTheme];
  const style = {
    "--demo-accent": theme.accent,
    "--demo-background": theme.background,
    "--demo-surface": theme.surface,
  } as CSSProperties;

  return (
    <MacFrame scene="alpine" title="neocode — theme" variant="scene-theme">
      <div className="terminal-canvas theme-mockup" style={style} aria-label="Animated NeoCode theme selector">
        <div className="theme-background-copy" aria-hidden="true">
          <span>## Project Overview</span>
          <span>This repository contains an MCP learning project.</span>
          <span>### Project Structure</span>
          <span>| Path | Purpose |</span>
        </div>
        <div className="theme-dialog">
          <div className="theme-dialog-head"><strong>Select Theme</strong><span>esc</span></div>
          <div className="theme-search"><i />Search themes...</div>
          <div className="theme-list" aria-live="polite">
            {themes.map((item, index) => (
              <div className={index === activeTheme ? "theme-row theme-row-active" : "theme-row"} key={item.name}>
                {item.name}
              </div>
            ))}
          </div>
        </div>
        <TerminalInput />
      </div>
    </MacFrame>
  );
}

const HERO_TITLE_LINES = ["Code with NeoCode.", "Stay in your terminal."] as const;

const HERO_BEAMS = [
  { x: 0.08, width: 0.13, angle: -0.14, drift: 0.035, speed: 0.000052, phase: 0.4, color: "86, 214, 194", opacity: 0.07 },
  { x: 0.31, width: 0.17, angle: -0.09, drift: 0.045, speed: 0.000041, phase: 2.1, color: "137, 180, 250", opacity: 0.055 },
  { x: 0.61, width: 0.14, angle: 0.1, drift: 0.04, speed: 0.000047, phase: 4.5, color: "86, 214, 194", opacity: 0.045 },
  { x: 0.86, width: 0.12, angle: 0.15, drift: 0.03, speed: 0.000038, phase: 1.2, color: "137, 180, 250", opacity: 0.05 },
] as const;

function HeroBeams() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    const canvasElement = canvas;
    const drawingContext = context;

    const mobileQuery = window.matchMedia("(max-width: 820px)");
    let animationFrame = 0;
    let isVisible = true;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    function draw(time: number) {
      drawingContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawingContext.clearRect(0, 0, width, height);
      drawingContext.globalCompositeOperation = "screen";

      HERO_BEAMS.forEach((beam) => {
        const beamWidth = width * beam.width;
        const x = width * (beam.x + Math.sin(time * beam.speed + beam.phase) * beam.drift);
        drawingContext.save();
        drawingContext.translate(x, height / 2);
        drawingContext.rotate(beam.angle);
        const gradient = drawingContext.createLinearGradient(-beamWidth / 2, 0, beamWidth / 2, 0);
        gradient.addColorStop(0, `rgba(${beam.color}, 0)`);
        gradient.addColorStop(0.42, `rgba(${beam.color}, ${beam.opacity * 0.72})`);
        gradient.addColorStop(0.5, `rgba(${beam.color}, ${beam.opacity})`);
        gradient.addColorStop(0.58, `rgba(${beam.color}, ${beam.opacity * 0.72})`);
        gradient.addColorStop(1, `rgba(${beam.color}, 0)`);

        drawingContext.fillStyle = gradient;
        drawingContext.fillRect(-beamWidth / 2, -height * 0.72, beamWidth, height * 1.44);
        drawingContext.restore();
      });

      drawingContext.globalCompositeOperation = "source-over";
    }

    function shouldAnimate() {
      return !reduceMotion && !mobileQuery.matches && isVisible;
    }

    function animate(time: number) {
      draw(time);
      if (shouldAnimate()) animationFrame = window.requestAnimationFrame(animate);
    }

    function restart() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      draw(0);
      if (shouldAnimate()) animationFrame = window.requestAnimationFrame(animate);
    }

    function resize() {
      const bounds = canvasElement.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvasElement.width = Math.round(width * pixelRatio);
      canvasElement.height = Math.round(height * pixelRatio);
      restart();
    }

    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      restart();
    }, { rootMargin: "120px 0px" });

    resizeObserver.observe(canvasElement);
    intersectionObserver.observe(canvasElement);
    mobileQuery.addEventListener("change", restart);
    resize();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      mobileQuery.removeEventListener("change", restart);
    };
  }, [reduceMotion]);

  return (
    <div className="hero-beams" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

function HeroHoverHeading() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(-300);
  const pointerY = useMotionValue(-300);
  const revealOpacity = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 220, damping: 30, mass: 0.7 });
  const smoothY = useSpring(pointerY, { stiffness: 220, damping: 30, mass: 0.7 });
  const smoothOpacity = useSpring(revealOpacity, { stiffness: 180, damping: 24, mass: 0.6 });
  const spotlight = useMotionTemplate`radial-gradient(240px circle at ${smoothX}px ${smoothY}px, rgba(243, 247, 255, 1) 0%, rgba(86, 214, 194, 0.98) 28%, rgba(137, 180, 250, 0.9) 56%, rgba(207, 142, 244, 0.68) 74%, rgba(207, 142, 244, 0) 100%)`;

  function handlePointerMove(event: ReactPointerEvent<HTMLHeadingElement>) {
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

type AnimatedSectionHeadingProps = {
  children: ReactNode;
  id?: string;
  className?: string;
};

function AnimatedSectionHeading({ children, id, className = "" }: AnimatedSectionHeadingProps) {
  const reduceMotion = useReducedMotion();

  return (
    <h2 id={id} className={`animated-heading-wrap ${className}`.trim()}>
      <span className="animated-heading-base">{children}</span>
      {!reduceMotion && (
        <motion.span
          aria-hidden="true"
          className="animated-heading-sweep"
          initial={{ backgroundPosition: "180% 0", opacity: 0 }}
          whileInView={{ backgroundPosition: "0% 0", opacity: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.span>
      )}
    </h2>
  );
}

function Hero() {
  return (
    <section className="hero section-shell" id="top">
      <HeroBeams />
      <motion.div
        className="hero-copy"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
      >
        <span className="eyebrow"><i /> TERMINAL AGENT FOR COMPLEX REPOSITORIES</span>
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
        <div className="hero-facts" aria-label="NeoCode availability">
          <span><b>MACOS</b> / <b>LINUX</b> / <b>WINDOWS</b></span>
          <span><b>MIT</b> LICENSED</span>
          <span><b>MCP</b> COMPATIBLE</span>
        </div>
      </motion.div>
      <motion.div
        className="hero-mockup"
        initial={{ opacity: 0, y: 44 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, delay: 0.15 }}
      >
        <PromptMockup />
      </motion.div>
    </section>
  );
}

const capabilityItems = [
  ["01", "ASK", "Understand the codebase"],
  ["02", "INSPECT", "Read files and tool activity"],
  ["03", "BUILD", "Apply project changes"],
  ["04", "NEOLENS", "Replay dependency activity"],
] as const;

function CapabilityRail() {
  return (
    <section className="capability-rail section-shell" aria-label="NeoCode capabilities">
      {capabilityItems.map(([number, label, description]) => (
        <div className="capability-item" key={label}>
          <span>{number}</span>
          <strong>{label}</strong>
          <p>{description}</p>
        </div>
      ))}
    </section>
  );
}

type TourSectionProps = {
  id?: string;
  number: string;
  title: string;
  copy: string;
  points: string[];
  mockup: ReactNode;
  reverse?: boolean;
};

function TourSection({ id, number, title, copy, points, mockup, reverse = false }: TourSectionProps) {
  const titleId = `tour-${number.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

  return (
    <section className={reverse ? "tour-row tour-row-reverse" : "tour-row"} id={id} aria-labelledby={titleId}>
      <motion.div className="tour-copy" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }}>
        <span className="tour-number">{number}</span>
        <AnimatedSectionHeading id={titleId}>{title}</AnimatedSectionHeading>
        <p>{copy}</p>
        <ul>{points.map((point) => <li key={point}>{point}</li>)}</ul>
      </motion.div>
      <motion.div className="tour-visual" initial={{ opacity: 0, y: 38 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.18 }} transition={{ duration: 0.65 }}>
        {mockup}
      </motion.div>
    </section>
  );
}

function ProductTour() {
  return (
    <div className="product-tour section-shell" id="product">
      <div className="tour-intro">
        <span className="eyebrow">THE INTERFACE</span>
        <AnimatedSectionHeading>See NeoCode<br />at work.</AnimatedSectionHeading>
        <p>Four interface states reproduced from the terminal application.</p>
      </div>
      <TourSection
        id="commands"
        number="01 / COMMANDS"
        title="Slash commands"
        copy="Type / in the prompt to open NeoCode commands without leaving the session."
        points={["Start or reopen sessions", "Switch agents and models", "Open NeoLens, MCP settings, themes, and login"]}
        mockup={<CommandPaletteMockup />}
      />
      <TourSection
        number="02 / ACTIVITY"
        title="Visible tool activity"
        copy="Repository reads and directory listings appear in the conversation while the response is generated."
        points={["File and directory targets remain visible", "Thinking and tool labels use the selected theme", "The prompt stays available below the session"]}
        mockup={<ActivityMockup />}
        reverse
      />
      <TourSection
        number="03 / ANALYSIS"
        title="Repository analysis"
        copy="NeoCode can inspect project files and return a structured explanation in the same terminal view."
        points={["Markdown-style headings and lists", "Tool output and response share one session", "Continue with a follow-up from the prompt"]}
        mockup={<AnalysisMockup />}
      />
      <TourSection
        id="themes"
        number="04 / THEMES"
        title="Built-in themes"
        copy="Use /theme to change the terminal palette. The selection applies across messages, tools, dialogs, and the prompt."
        points={["Nightfox is the default", "Catppuccin, Dracula, Monokai Pro, Tokyo Night, and Nord included", "Theme selection is available inside the CLI"]}
        mockup={<ThemeMockup />}
        reverse
      />
    </div>
  );
}

const installOptions = [
  { id: "brew", label: "HOMEBREW", os: "macOS + Linux", command: "brew install Hardik180704/tap/neocode" },
  { id: "shell", label: "SHELL", os: "macOS + Linux", command: "curl -fsSL https://raw.githubusercontent.com/Hardik180704/NeoCode/main/install.sh | sh" },
  { id: "windows", label: "POWERSHELL", os: "Windows", command: "irm https://raw.githubusercontent.com/Hardik180704/NeoCode/main/install.ps1 | iex" },
];

function Install() {
  const [active, setActive] = useState("brew");
  const selected = installOptions.find((option) => option.id === active) ?? installOptions[0];

  return (
    <section className="install section-shell" id="install">
      <div className="install-copy">
        <span className="eyebrow">INSTALLATION</span>
        <AnimatedSectionHeading>Install NeoCode.</AnimatedSectionHeading>
        <p>Install the standalone binary, open a project directory, and run <code>neocode</code>.</p>
      </div>
      <div className="install-panel">
        <div className="install-tabs" role="tablist" aria-label="Installation method">
          {installOptions.map((option) => (
            <button
              type="button"
              className={active === option.id ? "install-tab install-tab-active" : "install-tab"}
              key={option.id}
              onClick={() => setActive(option.id)}
              role="tab"
              aria-selected={active === option.id}
            >
              {option.label}<small>{option.os}</small>
            </button>
          ))}
        </div>
        <CopyCommand command={selected.command} />
        <p className="install-next">Then run <code>neocode</code> inside a project.</p>
      </div>
    </section>
  );
}

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
      signalContext.font = `400 ${preferredFontSize}px "Sixtyfour Variable", "JetBrains Mono Variable", monospace`;
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

      signalContext.font = `400 ${fontSize}px "Sixtyfour Variable", "JetBrains Mono Variable", monospace`;

      FOOTER_SIGNAL_LINES.forEach((line, index) => {
        const y = startY + index * lineHeight;
        signalContext.fillStyle = "rgba(54, 77, 110, 0.48)";
        signalContext.fillText(line, horizontalPadding, y);

        const lineProgress = (progress + index * 0.16) % 1;
        const center = -width * 0.2 + lineProgress * width * 1.42;
        const gradient = signalContext.createLinearGradient(center - width * 0.24, 0, center + width * 0.24, 0);
        gradient.addColorStop(0, "rgba(86, 214, 194, 0)");
        gradient.addColorStop(0.34, "rgba(86, 214, 194, 0.72)");
        gradient.addColorStop(0.52, "rgba(137, 180, 250, 0.96)");
        gradient.addColorStop(0.68, "rgba(207, 142, 244, 0.58)");
        gradient.addColorStop(1, "rgba(207, 142, 244, 0)");

        signalContext.save();
        signalContext.globalCompositeOperation = "source-atop";
        signalContext.fillStyle = gradient;
        signalContext.fillRect(0, y, width, lineHeight);
        signalContext.restore();
      });

      if (pointerStrength > 0.002) {
        const radius = Math.max(115, width * 0.22);
        const pointerGlow = signalContext.createRadialGradient(pointerX, pointerY, 0, pointerX, pointerY, radius);
        pointerGlow.addColorStop(0, `rgba(243, 248, 255, ${0.92 * pointerStrength})`);
        pointerGlow.addColorStop(0.2, `rgba(86, 214, 194, ${0.78 * pointerStrength})`);
        pointerGlow.addColorStop(0.55, `rgba(137, 180, 250, ${0.42 * pointerStrength})`);
        pointerGlow.addColorStop(0.8, `rgba(207, 142, 244, ${0.14 * pointerStrength})`);
        pointerGlow.addColorStop(1, "rgba(207, 142, 244, 0)");

        signalContext.save();
        signalContext.globalCompositeOperation = "source-atop";
        signalContext.fillStyle = pointerGlow;
        signalContext.fillRect(0, 0, width, height);
        signalContext.restore();
      }

      signalContext.save();
      signalContext.globalCompositeOperation = "destination-out";
      signalContext.fillStyle = "rgba(0, 0, 0, 0.52)";
      for (let y = 1; y < height; y += 4) signalContext.fillRect(0, y, width, 1);
      signalContext.fillStyle = "rgba(0, 0, 0, 0.3)";
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

function Footer() {
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

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <CapabilityRail />
        <ProductTour />
        <Install />
      </main>
      <Footer />
    </>
  );
}
