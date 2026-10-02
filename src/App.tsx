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
import { Interview } from './pages/Interview';
import { SetPassword } from './pages/SetPassword';
import { GroupRecordPage } from './pages/GroupRecordPage';
import { ProjectLink } from './pages/ProjectLink';
import { QuestionPaper } from './pages/QuestionPaper';
import { Scoreboard } from './pages/Scoreboard';
import { WorkshopHost } from './pages/workshop/WorkshopHost';
import { WorkshopPresent } from './pages/workshop/WorkshopPresent';
import { WorkshopJoin } from './pages/workshop/WorkshopJoin';
import { flushOutbox } from './services/submit';
import { isDemoSite } from './lib/config';

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
            {/* The demonstration link lands on the results screen, where the
                tour and the project picker are: somebody sent a demonstration
                wants to see what the tool produces, not to fill in a form.
                Routing owns it rather than a rewrite at bootstrap, so the
                back button behaves and a query string survives. */}
            <Route path="/" element={isDemoSite() ? <Navigate to="/admin" replace /> : <Landing />} />
            {/* Where the demonstration's tour sends somebody who wants to see
                what a grower opens. On the live site it is not an address at
                all, so it bounces to the front page. */}
            <Route path="/landing" element={isDemoSite() ? <Landing /> : <Navigate to="/" replace />} />
            <Route path="/about" element={<About />} />
            <Route path="/consultation" element={<Consultation />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/questions" element={<QuestionPaper />} />
            {/* The public scoreboard: published editions only, and nothing else. */}
            <Route path="/scoreboard" element={<Scoreboard />} />
            <Route path="/scoreboard/:period" element={<Scoreboard />} />
            <Route path="/scoreboard/:period/:part" element={<Scoreboard />} />
            <Route path="/thank-you" element={<ThankYou />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/interview" element={<Interview />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/group" element={<GroupRecordPage />} />
            <Route path="/group/:id" element={<GroupRecordPage />} />
            <Route path="/workshop" element={<WorkshopHost />} />
            <Route path="/workshop/:code" element={<WorkshopPresent />} />
            <Route path="/p/:projectId" element={<ProjectLink />} />
            <Route path="/w" element={<WorkshopJoin />} />
            <Route path="/w/:code" element={<WorkshopJoin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </QuestionnaireProvider>
      </HashRouter>
    </ErrorBoundary>
  );
};
