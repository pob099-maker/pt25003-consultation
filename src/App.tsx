import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QuestionnaireProvider } from './contexts/QuestionnaireContext';
import { Landing } from './pages/Landing';
import { About } from './pages/About';
import { Consultation } from './pages/Consultation';
import { Privacy } from './pages/Privacy';
import { ThankYou } from './pages/ThankYou';
import { flushOutbox } from './services/submit';

// Staff-only, and the heaviest screen in the app. Keeping it out of the main
// bundle means a grower on a paddock connection never downloads it.
const Admin = lazy(() => import('./pages/admin/Admin').then((module) => ({ default: module.Admin })));

export const App = () => {
  useEffect(() => {
    // Anything held on the device from an earlier submission goes out now.
    void flushOutbox();
  }, []);

  return (
    <BrowserRouter>
      <QuestionnaireProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<About />} />
          <Route path="/consultation" element={<Consultation />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route
            path="/admin"
            element={
              <Suspense fallback={<p className="p-6 text-ink-soft">Loading…</p>}>
                <Admin />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </QuestionnaireProvider>
    </BrowserRouter>
  );
};
