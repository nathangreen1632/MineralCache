import React from "react";
import { Link } from "react-router-dom";

export default function Footer(): React.ReactElement {
  const currentYear: number = new Date().getFullYear();

  return (
    <footer
      className="bg-[var(--theme-bg)] border-t border-[var(--theme-border)] text-[var(--theme-text)] shadow-[0_-2px_6px_0_var(--theme-shadow)] px-4 sm:px-6 lg:px-8 py-2 sm:py-4 text-center text-xs sm:text-sm"
      role="contentinfo"
    >
      <p className="opacity-80 leading-6">
        © {currentYear}{" "}
        <a
          href="https://www.oneguyproductions.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
        >
          One Guy Productions
        </a>{" "}
        All rights reserved.
      </p>

      <nav
        aria-label="Legal"
        className="mt-2 flex items-center justify-center gap-4"
      >
        <Link
          to="/legal#tos"
          className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
        >
          Terms
        </Link>
        <Link
          to="/legal#privacy"
          className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
        >
          Privacy
        </Link>
        <Link
          to="/legal#cookie"
          className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
        >
          Cookies
        </Link>
        <Link
          to="/legal#eula"
          className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
        >
          EULA
        </Link>
      </nav>
    </footer>
  );
}
