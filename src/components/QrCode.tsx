import { useMemo, type CSSProperties } from 'react';
import qrcode from 'qrcode-generator';

/**
 * A QR code drawn as one SVG path, so it stays sharp on a projector at any
 * size. Generated on the device — nothing is fetched from a QR service, which
 * would also have been told every join link.
 */
export const QrCode = ({
  value,
  label,
  className,
  style,
}: {
  value: string;
  label: string;
  className?: string;
  style?: CSSProperties;
}) => {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let d = '';
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (qr.isDark(row, col)) d += `M${col + 4} ${row + 4}h1v1h-1z`;
      }
    }
    return { size: count + 8, path: d };
  }, [value]);

  // Always dark on white, whatever the theme: phones read that most reliably.
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      className={className}
      style={style}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
};
