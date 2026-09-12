import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { applyStoredTheme } from './components/ThemeToggle';

// Before the first render, so a reader who chose dark never sees a flash of cream.
applyStoredTheme();

const container = document.getElementById('root');
if (container !== null) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
