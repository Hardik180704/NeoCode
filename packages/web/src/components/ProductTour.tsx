import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { MacFrame } from "./MacFrame";
import { useCycle, BrandWordmark, TerminalInput, AnimatedSectionHeading } from "./Shared";

const paletteCommands = [
  { command: "/new", description: "new session" },
  { command: "/agents", description: "switch agent" },
  { command: "/models", description: "select model" },
  { command: "/sessions", description: "open previous sessions" },
  { command: "/lens", description: "explore codebase and agent activity" },
  { command: "/mcp", description: "manage MCP tools" },
  { command: "/theme", description: "change terminal theme" },
  { command: "/login", description: "sign in" },
] as const;

const PALETTE_QUERY = "/len";
const PALETTE_OPEN_DELAY_MS = 650;
const PALETTE_FIRST_KEY_MS = 280;
const PALETTE_TYPE_MS = 150;
const PALETTE_TYPE_JITTER_MS = 90;
const PALETTE_SELECTED_HOLD_MS = 2600;
const PALETTE_CLOSE_MS = 420;

type PalettePhase = "closed" | "typing" | "selected" | "closing";

function NeoCodeCommandPalette() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { amount: 0.4 });
  const reduceMotion = useReducedMotion() ?? false;
  const [typedLength, setTypedLength] = useState(0);
  const [phase, setPhase] = useState<PalettePhase>("closed");
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!inView || reduceMotion) return;

    let delay = PALETTE_OPEN_DELAY_MS;
    let advance = () => setPhase("typing" as PalettePhase);

    if (phase === "typing") {
      if (typedLength < PALETTE_QUERY.length) {
        delay = typedLength === 0 ? PALETTE_FIRST_KEY_MS : PALETTE_TYPE_MS + Math.random() * PALETTE_TYPE_JITTER_MS;
        advance = () => setTypedLength((length) => length + 1);
      } else {
        delay = 320;
        advance = () => setPhase("selected");
      }
    } else if (phase === "selected") {
      delay = PALETTE_SELECTED_HOLD_MS;
      advance = () => setPhase("closing");
    } else if (phase === "closing") {
      delay = PALETTE_CLOSE_MS;
      advance = () => {
        setTypedLength(0);
        setCycle((value) => value + 1);
        setPhase("closed");
      };
    }

    const timer = window.setTimeout(advance, delay);
    return () => window.clearTimeout(timer);
  }, [inView, phase, reduceMotion, typedLength]);

  const typed = reduceMotion ? PALETTE_QUERY : PALETTE_QUERY.slice(0, typedLength);
  const query = typed.slice(1);
  const typingDone = reduceMotion || phase === "selected" || phase === "closing";
  const paletteVisible = reduceMotion || phase !== "closed";
  const matchCount = paletteCommands.filter(({ command }) => query.length === 0 || command.slice(1).startsWith(query)).length;

  return (
    <MacFrame scene="monolith" title="neocode — commands" variant="scene-commands">
      <div ref={containerRef} className="terminal-canvas command-mockup palette-mockup" aria-label="NeoCode slash-command palette">
        <div className="palette-backdrop" aria-hidden="true">
          <div>Thinking: Let me explore the project structure to understand what this project contains.</div>
          <div>Read File: README.md</div>
          <div>Read File: package.json</div>
          <div>List Directory: CH-1_CreateMCP</div>
          <div>Read File: CH-1_CreateMCP/1_first_mcpserver_stdio.py</div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {paletteVisible ? (
            <motion.div
              className="nc-palette"
              key={`palette-${cycle}`}
              initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.97, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, scale: 0.985, filter: "blur(8px)" }}
              transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="nc-palette-input">
                <span className="nc-palette-prompt" aria-hidden="true">›</span>
                <span className="nc-palette-typed">{typed}</span>
                <span className="nc-palette-cursor" aria-hidden="true" />
                <span className="nc-palette-key" aria-hidden="true">esc</span>
              </div>
              <div className="nc-palette-results" aria-live="polite">
                {paletteCommands.map(({ command, description }, index) => {
                  const matches = query.length === 0 || command.slice(1).startsWith(query);
                  const selected = typingDone && command === "/lens";
                  const matchedLength = command === "/lens" ? Math.min(typed.length, command.length) : 0;
                  const className = [
                    "nc-palette-row",
                    matches ? "" : "nc-palette-row-dim",
                    selected ? "nc-palette-row-selected" : "",
                  ].filter(Boolean).join(" ");

                  return (
                    <motion.div
                      animate={{ opacity: matches ? 1 : 0.3, x: selected ? 3 : 0 }}
                      className={className}
                      key={command}
                      transition={{ duration: 0.28, delay: Math.min(index * 0.018, 0.12), ease: [0.22, 1, 0.36, 1] }}
                    >
                      {selected ? (
                        <motion.span
                          aria-hidden="true"
                          className="nc-palette-selection"
                          initial={reduceMotion ? false : { opacity: 0, scaleX: 0.94 }}
                          animate={{ opacity: 1, scaleX: 1 }}
                          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                        />
                      ) : null}
                      <code>
                        {matchedLength > 0 ? (
                          <><span className="nc-command-match">{command.slice(0, matchedLength)}</span>{command.slice(matchedLength)}</>
                        ) : command}
                      </code>
                      <span className="nc-palette-description">{description}</span>
                    </motion.div>
                  );
                })}
              </div>
              <div className="nc-palette-footer">
                <span>{query ? `${matchCount} match` : `${paletteCommands.length} commands`}</span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={typingDone ? "open" : "filter"}
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                  >
                    {typingDone ? "↵ Open" : "type to filter"}
                  </motion.span>
                </AnimatePresence>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MacFrame>
  );
}

const activityRows = [
  { action: "Thinking", target: "Let me explore the project structure to understand what this project contains.", ms: null },
  { action: "List Directory", target: ".", ms: 12 },
  { action: "Read File", target: "README.md", ms: 45 },
  { action: "Read File", target: "package.json", ms: 8 },
  { action: "Read File", target: "pyproject.toml", ms: 9 },
  { action: "List Directory", target: "CH-1_CreateMCP", ms: 11 },
  { action: "Read File", target: "CH-1_CreateMCP/1_first_mcpserver_stdio.py", ms: 38 },
] as const;

const ACTIVITY_TICK_MS = 900;
const ACTIVITY_HOLD_MS = 1500;
const ACTIVITY_VISIBLE_ROWS = 5;
const ACTIVITY_TOTAL_TICKS = activityRows.length + 1;

function ActivityMockup() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const inView = useInView(canvasRef, { amount: 0.35 });
  const reduceMotion = useReducedMotion();
  const running = inView && !reduceMotion;
  const [tick, setTick] = useState(0);
  const [loop, setLoop] = useState(0);

  useEffect(() => {
    if (!running) return;
    const sequenceDone = tick >= ACTIVITY_TOTAL_TICKS;
    const timer = window.setTimeout(() => {
      if (sequenceDone) {
        setLoop((value) => value + 1);
        setTick(0);
      } else {
        setTick((value) => value + 1);
      }
    }, sequenceDone ? ACTIVITY_HOLD_MS : ACTIVITY_TICK_MS);
    return () => window.clearTimeout(timer);
  }, [running, tick]);

  const effectiveTick = reduceMotion ? ACTIVITY_TOTAL_TICKS : tick;
  const revealed = Math.min(effectiveTick, activityRows.length);
  const firstVisible = reduceMotion ? 0 : Math.max(0, revealed - ACTIVITY_VISIBLE_ROWS);
  const summaryVisible = effectiveTick >= ACTIVITY_TOTAL_TICKS;
  const scrollProgress = effectiveTick / ACTIVITY_TOTAL_TICKS;

  return (
    <MacFrame scene="alpine" title="neocode — session" variant="scene-activity">
      <div ref={canvasRef} className="terminal-canvas activity-mockup" aria-label="NeoCode tool activity interface">
        <div className="activity-stream">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div className="activity-loop" key={loop} initial={false} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
              <AnimatePresence initial={false} mode="popLayout">
                {activityRows.slice(firstVisible, revealed).map((row, offset) => {
                  const index = firstVisible + offset;
                  const done = effectiveTick > index + 1;
                  const isThinking = row.action === "Thinking";
                  const className = isThinking
                    ? done
                      ? "activity-row activity-thinking"
                      : "activity-row activity-thinking activity-thinking-active"
                    : "activity-row";

                  return (
                    <motion.div
                      layout
                      className={className}
                      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      key={`row-${index}`}
                    >
                      {isThinking ? (
                        <>
                          <em>Thinking:</em>
                          <span>{row.target}</span>
                        </>
                      ) : (
                        <>
                          <span className="activity-status" aria-hidden="true">
                            {done ? <span className="activity-check">✓</span> : <i className="activity-spinner" />}
                          </span>
                          <em>{row.action}:</em>
                          <span>{row.target}{done ? "" : "..."}</span>
                          {done && <span className="activity-time">· {row.ms}ms</span>}
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {summaryVisible && (
                  <motion.p
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    I now have a comprehensive understanding of this project. Here&apos;s my analysis:
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>
        <TerminalInput />
        <div className="mock-scroll" aria-hidden="true">
          <i style={{ top: `calc(${(scrollProgress * 100).toFixed(2)}% - ${(scrollProgress * 32).toFixed(2)}px)` }} />
        </div>
      </div>
    </MacFrame>
  );
}

const ANALYSIS_THINKING = "Let me explore the project structure to understand what this project contains.";
const ANALYSIS_LAST_STEP = 4;
const ANALYSIS_STEP_MS = 880;
const ANALYSIS_HOLD_MS = 2400;

function AnalysisBlock({ className, reduceMotion, children }: { className?: string; reduceMotion: boolean; children: ReactNode }) {
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function AnalysisMockup() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const inView = useInView(canvasRef, { amount: 0.35 });
  const reduceMotion = useReducedMotion() ?? false;
  const [step, setStep] = useState(0);
  const [loop, setLoop] = useState(0);
  const running = inView && !reduceMotion;

  useEffect(() => {
    if (!running) return;
    const sequenceDone = step >= ANALYSIS_LAST_STEP;
    const timer = window.setTimeout(() => {
      if (sequenceDone) {
        setLoop((value) => value + 1);
        setStep(0);
      } else {
        setStep((value) => value + 1);
      }
    }, sequenceDone ? ANALYSIS_HOLD_MS : ANALYSIS_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [running, step]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    if (reduceMotion || step === 0) {
      stream.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    const timer = window.setTimeout(() => {
      stream.scrollTo({ top: stream.scrollHeight, behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [loop, reduceMotion, step]);

  const visibleStep = reduceMotion ? ANALYSIS_LAST_STEP : step;
  const scrollProgress = reduceMotion ? 0 : visibleStep / ANALYSIS_LAST_STEP;

  return (
    <MacFrame scene="monolith" title="neocode — analysis" variant="scene-analysis">
      <div ref={canvasRef} className="terminal-canvas analysis-mockup" aria-label="NeoCode repository analysis response">
        <div ref={streamRef} className="an-stream" tabIndex={0} aria-label="Repository analysis details">
          <motion.div className="an-sequence" key={loop} initial={false}>
            <AnalysisBlock reduceMotion={reduceMotion} className="an-thinking">
              <em>Thinking:</em>
              <span className={visibleStep === 0 && !reduceMotion ? "an-thinking-copy an-thinking-active" : "an-thinking-copy"}>{ANALYSIS_THINKING}</span>
              {visibleStep === 0 && !reduceMotion ? <span className="an-thinking-dots" aria-hidden="true"><i /><i /><i /></span> : null}
            </AnalysisBlock>
            {visibleStep >= 1 ? (
              <AnalysisBlock reduceMotion={reduceMotion} className="an-intro">
                <p>I now have a comprehensive understanding of this project.</p>
                <p>Here&apos;s my analysis:</p>
              </AnalysisBlock>
            ) : null}
            {visibleStep >= 2 ? (
              <AnalysisBlock reduceMotion={reduceMotion} className="an-section">
                <div className="an-heading"><span>##</span> Project Overview</div>
                <p className="an-text">This repository contains a chapter-by-chapter MCP learning project for Python.</p>
              </AnalysisBlock>
            ) : null}
            {visibleStep >= 3 ? (
              <AnalysisBlock reduceMotion={reduceMotion} className="an-section">
                <div className="an-heading"><span>##</span> Tech Stack</div>
                <div className="an-bullet"><i>-</i><span>Python with <code>uv</code> as the package manager</span></div>
                <div className="an-bullet"><i>-</i><span><code>FastMCP</code> for MCP servers</span></div>
                <div className="an-bullet"><i>-</i><span>MCP SDK for the Python client</span></div>
              </AnalysisBlock>
            ) : null}
            {visibleStep >= 4 ? (
              <AnalysisBlock reduceMotion={reduceMotion} className="an-section">
                <div className="an-heading"><span>##</span> Project Structure</div>
                <div className="an-table">
                  <div className="an-table-line">
                    <span className="an-pipe">|</span><span className="an-head">{" Path    "}</span><span className="an-pipe">|</span><span className="an-head">{" Purpose            "}</span><span className="an-pipe">|</span>
                  </div>
                  <div className="an-table-line">
                    <span className="an-pipe">|</span><span className="an-path">{" main.py "}</span><span className="an-pipe">|</span><span>{" Minimal entry point "}</span><span className="an-pipe">|</span>
                  </div>
                </div>
              </AnalysisBlock>
            ) : null}
          </motion.div>
        </div>
        <TerminalInput />
        <div className="mock-scroll" aria-hidden="true">
          <i style={{ top: `calc(${(scrollProgress * 100).toFixed(2)}% - ${(scrollProgress * 32).toFixed(2)}px)` }} />
        </div>
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const [userTheme, setUserTheme] = useState<number | null>(null);
  const inView = useInView(canvasRef, { amount: 0.35 });
  const cycledTheme = useCycle(themes.length, 1800, inView && userTheme === null);
  
  const activeTheme = userTheme !== null ? userTheme : cycledTheme;
  const theme = themes[activeTheme];
  const style = {
    "--demo-accent": theme.accent,
    "--demo-background": theme.background,
    "--demo-surface": theme.surface,
  } as CSSProperties;

  return (
    <MacFrame scene="alpine" title="neocode — theme" variant="scene-theme">
      <div ref={canvasRef} className="terminal-canvas theme-mockup" style={style} aria-label="Animated NeoCode theme selector">
        <div className="theme-background-copy" aria-hidden="true">
          <span>## Project Overview</span>
          <span>This repository contains an MCP learning project.</span>
          <span>### Project Structure</span>
          <span>| Path | Purpose |</span>
        </div>
        <div className="theme-dialog">
          <div className="theme-dialog-head">
            <strong>Select Theme</strong>
            {userTheme !== null ? (
              <button 
                type="button"
                className="theme-cycle-button"
                onClick={() => setUserTheme(null)} 
              >
                resume cycle
              </button>
            ) : (
              <span>esc</span>
            )}
          </div>
          <div className="theme-search"><i />Search themes...</div>
          <div className="theme-list" aria-live="polite">
            {themes.map((item, index) => (
              <button
                type="button"
                className={index === activeTheme ? "theme-row theme-row-active" : "theme-row"} 
                key={item.name}
                onClick={() => setUserTheme(index)}
                aria-pressed={index === activeTheme}
                style={{ "--theme-option-accent": item.accent } as CSSProperties}
              >
                {index === activeTheme ? (
                  <motion.span
                    aria-hidden="true"
                    className="theme-row-highlight"
                    layoutId="active-theme-row"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 32, mass: 0.75 }}
                  />
                ) : null}
                <span className="theme-row-swatch" aria-hidden="true" />
                <span className="theme-row-label">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
        <TerminalInput />
      </div>
    </MacFrame>
  );
}


type TourSectionProps = {
  id?: string;
  number: string;
  title: string;
  copy: string;
  mockup: ReactNode;
  reverse?: boolean;
};

function TourSection({ id, number, title, copy, mockup, reverse = false }: TourSectionProps) {
  const titleId = `tour-${number.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <section className={reverse ? "tour-row tour-row-reverse" : "tour-row"} id={id} aria-labelledby={titleId}>
      <motion.div className="tour-copy" initial={reduceMotion ? false : { opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }}>
        <span className="tour-number">{number}</span>
        <AnimatedSectionHeading id={titleId}>{title}</AnimatedSectionHeading>
        <p className="tour-copy-intro">{copy}</p>
      </motion.div>
      <motion.div className="tour-visual" initial={reduceMotion ? false : { opacity: 0, y: 38 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.18 }} transition={{ duration: 0.65 }}>
        {mockup}
      </motion.div>
    </section>
  );
}

type PlanBuildMode = "plan" | "build";

const PLAN_BUILD_CONTENT: Record<PlanBuildMode, {
  label: string;
  summary: string;
  activities: { icon: string; text: string; pending?: boolean }[];
  stats: { value: number; label: string }[];
}> = {
  plan: {
    label: "PLAN MODE",
    summary: "Understand the repository before changing anything.",
    activities: [
      { icon: "✓", text: "Read src/auth.ts" },
      { icon: "✓", text: "Read src/middleware.ts" },
      { icon: "✓", text: 'Search "session"' },
      { icon: "✓", text: "Read src/session.ts" },
    ],
    stats: [
      { value: 12, label: "files inspected" },
      { value: 0, label: "files modified" },
    ],
  },
  build: {
    label: "BUILD MODE",
    summary: "Implementing session refresh...",
    activities: [
      { icon: "✓", text: "Read src/auth.ts" },
      { icon: "✓", text: "Edit src/session.ts" },
      { icon: "✓", text: "Edit src/middleware.ts" },
      { icon: "◌", text: "Running tests", pending: true },
    ],
    stats: [
      { value: 12, label: "files inspected" },
      { value: 4, label: "files modified" },
      { value: 2, label: "checks running" },
    ],
  },
};

function PlanBuildMockup() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const inView = useInView(canvasRef, { amount: 0.35 });
  const reduceMotion = useReducedMotion() ?? false;
  const [mode, setMode] = useState<PlanBuildMode>("plan");
  const [autoPlay, setAutoPlay] = useState(true);
  const [manualRevision, setManualRevision] = useState(0);
  const content = PLAN_BUILD_CONTENT[mode];

  useEffect(() => {
    if (!inView || reduceMotion || !autoPlay) return;
    const timer = window.setTimeout(() => {
      setMode((current) => current === "plan" ? "build" : "plan");
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [autoPlay, inView, mode, reduceMotion]);

  useEffect(() => {
    if (autoPlay || reduceMotion) return;
    const timer = window.setTimeout(() => setAutoPlay(true), 6000);
    return () => window.clearTimeout(timer);
  }, [autoPlay, manualRevision, reduceMotion]);

  function selectMode(value: PlanBuildMode) {
    setMode(value);
    setAutoPlay(false);
    setManualRevision((revision) => revision + 1);
  }

  const stateContent = (
    <>
      <span className="pb-state-label">{content.label}</span>
      <p>{content.summary}</p>
      <div className="pb-activities">
        {content.activities.map((activity, index) => (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className={activity.pending ? "pb-activity pb-activity-pending" : "pb-activity"}
            initial={reduceMotion ? false : { opacity: 0, x: -8 }}
            key={activity.text}
            transition={{ duration: 0.32, delay: reduceMotion ? 0 : index * 0.07, ease: [0.22, 1, 0.36, 1] }}
          >
            <i>{activity.icon}</i>
            <span>{activity.text}</span>
          </motion.div>
        ))}
      </div>
    </>
  );

  const statsContent = (
    <>
      {content.stats.map((stat) => (
        <span key={stat.label}><b>{stat.value}</b> {stat.label}</span>
      ))}
    </>
  );

  return (
    <MacFrame scene="monolith" title="neocode — plan & build" variant="scene-plan-build">
      <div ref={canvasRef} className="terminal-canvas plan-build-mockup-inner" aria-label="NeoCode plan and build modes">
        <div className="pb-topbar">
          <div className="pb-brand"><BrandWordmark /></div>
          <div className="pb-mode-switch" role="group" aria-label="Mode selector">
            {(["plan", "build"] as const).map((value) => (
              <button
                type="button"
                className={mode === value ? "pb-mode pb-mode-active" : "pb-mode"}
                key={value}
                onClick={() => selectMode(value)}
                aria-pressed={mode === value}
              >
                {mode === value && !reduceMotion ? (
                  <motion.span className="pb-mode-pill" layoutId="pb-mode-pill" transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} />
                ) : mode === value ? (
                  <span className="pb-mode-pill" />
                ) : null}
                <span>{value.toUpperCase()}</span>
              </button>
            ))}
          </div>
          <div className="pb-connection"><span>Claude</span><em><i />Connected</em></div>
        </div>
        <div className="pb-body">
          {reduceMotion ? (
            <div className="pb-state" key={mode}>{stateContent}</div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                className="pb-state"
                key={mode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {stateContent}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
        <div className="pb-statusbar">
          {reduceMotion ? (
            <div className="pb-stats" key={mode}>{statsContent}</div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                className="pb-stats"
                key={mode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                {statsContent}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </MacFrame>
  );
}

export function ProductTour() {
  return (
    <div className="product-tour section-shell" id="product">
      <div className="tour-intro">
        <AnimatedSectionHeading>See NeoCode at work.</AnimatedSectionHeading>
        <p>Five interface states reproduced from the terminal application.</p>
      </div>
      <TourSection
        id="commands"
        number="01 / COMMANDS"
        title="Slash commands"
        copy="Type / in the prompt to open NeoCode commands without leaving the active terminal. Start or resume persistent workspaces, switch backend models and agents, and customize your theme settings instantly."
        mockup={<NeoCodeCommandPalette />}
      />
      <TourSection
        number="02 / ACTIVITY"
        title="Visible tool activity"
        copy="Repository reads, directory listings, and environment checks appear inline as they occur. Execution logs and thinking blocks match your active editor theme, keeping your session fully transparent."
        mockup={<ActivityMockup />}
        reverse
      />
      <TourSection
        number="03 / ANALYSIS"
        title="Repository analysis"
        copy="Inspect project files and return a structured codebase map in the same terminal view. Complex directory hierarchies and file purposes are compiled into clean markdown tables."
        mockup={<AnalysisMockup />}
      />
      <TourSection
        id="themes"
        number="04 / THEMES"
        title="Built-in themes"
        copy="Change the terminal palette dynamically using the theme dialog. Adapt all system interfaces, borders, inputs, and code views to Dracula, Tokyo Night, Catppuccin, Nord, or custom editor files."
        mockup={<ThemeMockup />}
        reverse
      />
      <TourSection
        number="05 / MODES"
        title="Plan before you build"
        copy="Toggle between read-only planning and full implementation inside the session. Scan the repository and plan changes without modifying code, then apply edits and run automated validation tests."
        mockup={<PlanBuildMockup />}
      />
    </div>
  );
}
