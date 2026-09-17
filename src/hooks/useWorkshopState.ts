import { useCallback, useEffect, useState } from 'react';
import { getWorkshopState, type WorkshopState } from '../services/workshops';

const POLL_MS = 2500;

/**
 * Polls a workshop while the page is visible. Polling rather than a realtime
 * channel: a room of forty phones every few seconds is nothing for the
 * database, and it recovers from a dropped connection without any handling.
 */
export const useWorkshopState = (code: string | undefined) => {
  const [state, setState] = useState<WorkshopState | null>(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    if (code === undefined || code.length === 0) return;
    const next = await getWorkshopState(code);
    if (next === null) {
      setOffline(true);
      return;
    }
    setOffline(false);
    setState(next);
  }, [code]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { state, offline, refresh };
};
