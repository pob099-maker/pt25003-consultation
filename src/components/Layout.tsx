import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import agAimsMark from '../assets/agaims-mark.png';

/**
 * The AgAims mark, the same artwork the Fieldwork app carries. The white is
 * part of the logo — the furrow between the mounds, the outline around the
 * leaves — so it sits on its own light chip rather than on the header, which
 * would eat it on a dark ground.
 */
const AgAimsMark = () => (
  <img src={agAimsMark} alt="AgAims" width={36} height={36} className="size-9 shrink-0 rounded-md bg-white" />
);

export const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-dvh bg-paper text-ink">
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:font-medium focus:text-white"
    >
      Skip to the questions
    </a>
    <header className="border-b-2 border-accent/60 bg-surface no-print">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5 text-primary">
          <AgAimsMark />
          <span className="leading-tight">
            <span className="block font-display text-title font-extrabold">Potato Mechanisation</span>
            <span className="block font-display text-eyebrow uppercase text-ink-faint">Industry consultation</span>
          </span>
        </Link>
        <span className="text-eyebrow uppercase text-ink-faint">PT25003</span>
      </div>
    </header>
    <main id="main" className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      {children}
    </main>
    <footer className="mt-8 border-t border-line bg-surface no-print">
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
