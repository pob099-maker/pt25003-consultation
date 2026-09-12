import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QuestionnaireProvider } from './contexts/QuestionnaireContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Landing } from './pages/Landing';
import { About } from './pages/About';
import { Consultation } from './pages/Consultation';
import { Privacy } from './pages/Privacy';
import { ThankYou } from './pages/ThankYou';
import { Admin } from './pages/admin/Admin';
import { flushOutbox } from './services/submit';

/**
 * Hash routing, so a link works on any static host without server rewrites —
 * GitHub Pages included, which cannot be told to fall back to index.html. The
 * consultation is shared as a single root link, so the hash is never something
 * anybody has to type.
 *
 * Every route is in the one bundle. The admin screen used to be lazily loaded
 * to save respondents its weight, which cost twelve kilobytes and bought a
 * white screen: a deploy replaces the chunk filenames, so any page already open
 * asked for a file that no longer existed and died with nothing on screen. The
 * saving was not worth a failure mode that shows a grower a blank page and
 * tells nobody.
 */
export const App = () => {
  useEffect(() => {
    // Anything held on the device from an earlier submission goes out now.
    void flushOutbox();
  }, []);

  return (
    <ErrorBoundary>
      <HashRouter>
        <QuestionnaireProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/consultation" element={<Consultation />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/thank-you" element={<ThankYou />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </QuestionnaireProvider>
      </HashRouter>
    </ErrorBoundary>
  );
};
