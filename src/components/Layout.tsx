import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-dvh bg-paper">
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-10 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
    >
      Skip to the questions
    </a>
    <header className="border-b border-line bg-surface no-print">
      <div className="mx-auto flex max-w-3xl items-baseline justify-between gap-4 px-4 py-3">
        <Link to="/" className="text-meta font-semibold uppercase tracking-wide text-accent">
          Potato Mechanisation Project
        </Link>
        <span className="text-meta text-ink-faint">PT25003</span>
      </div>
    </header>
    <main id="main" className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      {children}
    </main>
    <footer className="border-t border-line bg-surface no-print">
      <div className="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-2 px-4 py-5 text-meta text-ink-soft">
        <Link to="/privacy" className="underline underline-offset-4">
          Privacy statement
        </Link>
        <Link to="/about" className="underline underline-offset-4">
          How your information is used
        </Link>
        <span>Hort Innovation project PT25003</span>
      </div>
    </footer>
  </div>
);
