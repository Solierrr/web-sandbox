import { useState } from "react";

interface BarChartProps {
  title: string;
  points: { label: string; value: number }[];
  format: (value: number) => string;
}

export function BarChart({ title, points, format }: BarChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const width = 560;
  const height = 150;
  const left = 8;
  const bottom = 22;
  const top = 8;
  const max = Math.max(...points.map((point) => point.value), 0);
  const slot = (width - left) / Math.max(points.length, 1);
  const bar = Math.max(4, Math.min(18, slot - 4));
  const labelEvery = Math.ceil(points.length / 7);
  const shown = active === null ? null : points[active];
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs opacity-70" aria-live="polite">
          {shown ? `${shown.label}: ${format(shown.value)}` : max > 0 ? `máx. ${format(max)}` : "sem dados"}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}, ${points.length} dias`} className="w-full">
        <line x1={left} x2={width} y1={height - bottom} y2={height - bottom} stroke="currentColor" strokeOpacity={0.2} />
        {points.map((point, index) => {
          const barHeight = max > 0 ? Math.max(point.value > 0 ? 2 : 0, (point.value / max) * (height - bottom - top)) : 0;
          const x = left + index * slot + (slot - bar) / 2;
          return (
            <g key={point.label} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
              <rect x={left + index * slot} y={0} width={slot} height={height - bottom} fill="transparent" />
              <rect
                x={x}
                y={height - bottom - barHeight}
                width={bar}
                height={barHeight}
                rx={3}
                fill="#FF6500"
                opacity={active === null || active === index ? 1 : 0.45}
              />
              {index % labelEvery === 0 && (
                <text x={x + bar / 2} y={height - 6} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.7}>
                  {point.label.slice(8, 10)}/{point.label.slice(5, 7)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <details className="text-xs">
        <summary className="cursor-pointer opacity-70">Ver como tabela</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {points.map((point) => (
              <tr key={point.label}>
                <th scope="row" className="py-0.5 pr-3 font-normal opacity-70">
                  {point.label}
                </th>
                <td>{format(point.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
