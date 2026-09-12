import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly failed: boolean;
}

/**
 * A blank white page is the worst thing this app can show. Somebody who was
 * asked to give ten minutes gets no message, no explanation and no way back,
 * and we never hear about it — they simply do not appear in the results.
 *
 * Anything thrown during render lands here instead: a plain page, in plain
 * language, with the two things that actually help — reload, and a phone
 * number. Answers already given are on the device, so a reload resumes rather
 * than restarts.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Nowhere to send this, but it belongs in the console for whoever looks.
    console.error('Consultation failed to render', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <div style={{ maxWidth: '34rem', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>Something went wrong at our end</h1>
        <p style={{ lineHeight: 1.6 }}>
          Sorry — the page did not load properly. Your answers are saved on this device, so reloading should put you
          back where you were.
        </p>
        <p style={{ lineHeight: 1.6 }}>
          If it keeps happening, ring Peter O&rsquo;Brien on <a href="tel:0409773111">0409 773 111</a> and give your
          answers over the phone instead. They count the same either way.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1.25rem',
            fontSize: '1rem',
            fontWeight: 600,
            color: '#ffffff',
            background: '#6e4320',
            border: 0,
            borderRadius: '0.5rem',
            cursor: 'pointer',
          }}
        >
          Reload the page
        </button>
      </div>
    );
  }
}
