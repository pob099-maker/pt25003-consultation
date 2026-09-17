import { useState } from 'react';
import { downloadChartPng, exportPalette, safeFilename, type ChartImage, type Palette } from '../lib/chartImage';

/** Saves the chart as a picture for a report or a slide. Built only when pressed. */
export const DownloadChartButton = ({
  build,
  name,
  className = 'text-meta text-primary-ink underline underline-offset-4 no-print',
}: {
  build: (palette: Palette) => ChartImage;
  /** Used for the file name. */
  name: string;
  className?: string;
}) => {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        const stamp = new Date().toISOString().slice(0, 10);
        void downloadChartPng(build(exportPalette()), `${safeFilename(name)}-${stamp}`).finally(() => setBusy(false));
      }}
    >
      {busy ? 'Saving…' : 'Download chart'}
    </button>
  );
};
