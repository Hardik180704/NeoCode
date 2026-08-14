import { useState } from "react";
import { Icon, writeClipboard, AnimatedSectionHeading } from "./Shared";

const installOptions = [
  { id: "brew", method: "Homebrew", os: "macOS + Linux", command: "brew install Hardik180704/tap/neocode", step: "neocode" },
  { id: "shell", method: "Curl / Shell", os: "macOS + Linux", command: "curl -fsSL https://raw.githubusercontent.com/Hardik180704/NeoCode/main/install.sh | sh", step: "neocode" },
  { id: "windows", method: "PowerShell", os: "Windows", command: "irm https://raw.githubusercontent.com/Hardik180704/NeoCode/main/install.ps1 | iex", step: "neocode" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await writeClipboard(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button 
      type="button" 
      onClick={copy} 
      className="install-table-copy-btn" 
      aria-label={copied ? "Copied" : "Copy command"}
    >
      <Icon name={copied ? "check" : "copy"} size={13} />
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export function Install() {
  return (
    <section className="install section-shell" id="install">
      <div className="install-header">
        <AnimatedSectionHeading>Install NeoCode.</AnimatedSectionHeading>
        <p className="install-subtitle">
          Install the standalone binary, open a project directory, and run <code>neocode</code>.
        </p>
      </div>

      <div className="install-table-wrapper">
        <table className="install-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Command</th>
            </tr>
          </thead>
          <tbody>
            {installOptions.map((option) => (
              <tr key={option.id}>
                <td className="install-method-cell">
                  <div className="install-method-content">
                    <span className="install-method-name">{option.method}</span>
                    <span className="install-method-os">{option.os}</span>
                  </div>
                </td>
                <td className="install-command-cell">
                  <div className="install-code-container">
                    <span className="install-dollar">$</span>
                    <code className="install-code-text">{option.command}</code>
                    <CopyButton text={option.command} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
