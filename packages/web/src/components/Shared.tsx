import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export const GITHUB_URL = "https://github.com/Hardik180704/NeoCode";

export type IconName = "arrow" | "check" | "copy" | "menu" | "x";

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
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

export function BrandWordmark() {
  return (
    <span className="brand-wordmark" role="img" aria-label="NeoCode">
      <span>NEO</span><strong>CODE</strong>
    </span>
  );
}

export function Logo() {
  return (
    <a className="logo" href="#top" aria-label="NeoCode home">
      <BrandWordmark />
    </a>
  );
}

export async function writeClipboard(value: string) {
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

export function CopyCommand({ command }: { command: string }) {
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

export function useCycle(length: number, interval: number, enabled = true) {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!enabled || reduceMotion || length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % length), interval);
    return () => window.clearInterval(timer);
  }, [enabled, interval, length, reduceMotion]);

  return index;
}

export function TerminalInput({ prompt }: { prompt?: string }) {
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

type AnimatedSectionHeadingProps = {
  children: ReactNode;
  id?: string;
  className?: string;
};

export function AnimatedSectionHeading({ children, id, className = "" }: AnimatedSectionHeadingProps) {
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
