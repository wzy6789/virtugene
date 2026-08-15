import { useState } from 'react';
import { useThemeStore } from '../../store/theme-store';
import type { EmotionSnapshot } from '../../db/index';

interface Props {
  snapshots: EmotionSnapshot[];
}

const W = 240;
const H = 84;
const PAD_X = 8;
const PAD_Y = 14;

function formatShort(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${mm}`;
}

export function EmotionCurve({ snapshots }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  // 旧 → 新（emotion-repo 返回的是新 → 旧）
  const data = [...snapshots].reverse();
  if (data.length < 2) return null;

  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.08)';
  const pointStroke = isDark ? '#0F0F1A' : '#FFFFFF';
  const tooltipBg = isDark ? 'rgba(15,15,26,0.96)' : 'rgba(255,255,255,0.96)';
  const tooltipText = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,26,46,0.7)';

  const x = (i: number) => PAD_X + (i / (data.length - 1)) * (W - PAD_X * 2);
  const y = (v: number) => PAD_Y + (1 - v / 100) * (H - PAD_Y * 2);

  const mood = (s: EmotionSnapshot) => Math.round(s.dimensions.valence * 10);
  const points = data.map((s, i) => `${x(i)},${y(mood(s))}`).join(' ');

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      className="mx-auto"
      onMouseLeave={() => setHover(null)}
    >
      {/* 网格线（0 / 50 / 100） */}
      {[0, 50, 100].map((v) => (
        <line key={v} x1={PAD_X} y1={y(v)} x2={W - PAD_X} y2={y(v)} stroke={gridColor} strokeWidth="1" />
      ))}

      {/* 折线 */}
      <polyline
        points={points}
        fill="none"
        stroke="#00CEC9"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* 数据点 */}
      {data.map((s, i) => (
        <circle
          key={s.id}
          cx={x(i)}
          cy={y(mood(s))}
          r={hover === i ? 4 : 2.5}
          fill="#6C5CE7"
          stroke={pointStroke}
          strokeWidth="1"
          onMouseEnter={() => setHover(i)}
          style={{ transition: 'r 0.15s ease-out', cursor: 'pointer' }}
        />
      ))}

      {/* Tooltip */}
      {hover != null &&
        (() => {
          const s = data[hover];
          const tw = 92;
          const th = 40;
          const tx = Math.max(PAD_X, Math.min(W - PAD_X - tw, x(hover) - tw / 2));
          const ty = y(mood(s)) > H / 2 ? 2 : H - th - 2;
          return (
            <g style={{ animation: 'tooltipIn 0.18s ease-out' }} pointerEvents="none">
              <rect x={tx} y={ty} width={tw} height={th} rx={8} fill={tooltipBg} stroke="rgba(0,206,201,0.5)" />
              <text x={tx + tw / 2} y={ty + 15} textAnchor="middle" fill={tooltipText} fontSize="8">
                {formatShort(s.createdAt)} · {s.dominantEmotion}
              </text>
              <text x={tx + tw / 2} y={ty + 31} textAnchor="middle" fill="#00CEC9" fontSize="12" fontWeight="700">
                心情 {mood(s)}
              </text>
            </g>
          );
        })()}
    </svg>
  );
}
