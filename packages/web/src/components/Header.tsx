import { useEffect, useState } from "react";
import { MarkGithubIcon } from "@primer/octicons-react";
import { AnimatePresence, motion } from "motion/react";
import { Logo, Icon, GITHUB_URL } from "./Shared";

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 32);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={scrolled ? "site-header site-header-scrolled" : "site-header"}>
      <div className="header-inner">
        <Logo />
        <nav className="nav-desktop" aria-label="Primary navigation">
          <a href="#product">PRODUCT</a>
          <a href="#commands">COMMANDS</a>
          <a href="#themes">THEMES</a>
          <a href="#install">INSTALL</a>
        </nav>
        <AnimatePresence>
          {open && (
            <motion.nav
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="nav-mobile nav-open"
              aria-label="Mobile navigation"
            >
              <a href="#product" onClick={() => setOpen(false)}>PRODUCT</a>
              <a href="#commands" onClick={() => setOpen(false)}>COMMANDS</a>
              <a href="#themes" onClick={() => setOpen(false)}>THEMES</a>
              <a href="#install" onClick={() => setOpen(false)}>INSTALL</a>
              <a className="nav-github nav-github-menu" href={GITHUB_URL} target="_blank" rel="noreferrer">
                <MarkGithubIcon aria-hidden="true" size={16} /> GITHUB
              </a>
            </motion.nav>
          )}
        </AnimatePresence>
        <div className="header-actions">
          <a className="nav-github nav-github-cta" href={GITHUB_URL} target="_blank" rel="noreferrer">
            <MarkGithubIcon aria-hidden="true" size={14} /> GITHUB
          </a>
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
      </div>
    </header>
  );
}
