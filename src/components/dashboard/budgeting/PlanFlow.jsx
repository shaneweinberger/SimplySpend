import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney, layoutFlow } from '../../../utils/budget';
import { BUCKET_COLORS } from './colors';

const PAD_Y = 6;
const NODE_W = 10;
const HEIGHT = 260;
// Below this width the sources column is dropped (they're listed under the
// diagram anyway) so labels can stay at full size on a phone.
const COMPACT_BELOW = 560;

// Labels sit on top of the bands, so they get a halo in the card's color.
const HALO = { paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 4, strokeLinejoin: 'round' };

function band(x0, x1, y0, y1, t0, t1) {
    const xm = (x0 + x1) / 2;
    return `M${x0},${y0} C${xm},${y0} ${xm},${t0} ${x1},${t0} L${x1},${t1} C${xm},${t1} ${xm},${y1} ${x0},${y1} Z`;
}

function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Where the month's money comes from and where it's planned to go:
 * sources → Needs / Wants / Savings → categories.
 */
export default function PlanFlow({ sources, buckets }) {
    const ref = useRef(null);
    const [width, setWidth] = useState(720);

    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const compact = width < COMPACT_BELOW;
    // Category labels sit right of the last column; the band gaps share the rest.
    const labelRoom = Math.min(200, Math.round(width * (compact ? 0.5 : 0.4)));
    const right = width - labelRoom - NODE_W;
    const COL = compact ? { mid: 0, right } : { left: 0, mid: Math.round(right * 0.5), right };
    const maxLabel = Math.max(10, Math.floor((labelRoom - 14) / 7.2) - 5);

    const flow = useMemo(
        () => layoutFlow({ sources: compact ? [] : sources, buckets, height: HEIGHT, gap: 14, childGap: 5, labelGap: 22 }),
        [sources, buckets, compact],
    );

    const total = buckets.reduce((s, b) => s + b.value, 0);
    const colorOf = (bucketId) => BUCKET_COLORS[bucketId] || BUCKET_COLORS.wants;
    const y = (v) => v + PAD_Y;

    return (
        <div ref={ref}>
            {flow && (
                <svg
                    viewBox={`0 0 ${width} ${flow.height + PAD_Y * 2}`}
                    className="w-full h-auto overflow-visible"
                    role="img"
                    aria-label={`Plan flow: ${sources.map(s => `${s.label} ${formatMoney(s.value)}`).join(', ')} fund ${buckets.map(b => `${b.label} ${formatMoney(b.value)}`).join(', ')}.`}
                >
                    {!compact && flow.leftBands.map((b, i) => (
                        <path key={`l${i}`} d={band(COL.left + NODE_W, COL.mid, y(b.y0), y(b.y1), y(b.t0), y(b.t1))} fill={colorOf(b.to)} fillOpacity="0.2" />
                    ))}
                    {flow.rightBands.map((b, i) => (
                        <path key={`r${i}`} d={band(COL.mid + NODE_W, COL.right, y(b.y0), y(b.y1), y(b.t0), y(b.t1))} fill={colorOf(b.from)} fillOpacity="0.16">
                            <title>{`${flow.right[i].label}: ${formatMoney(flow.right[i].value)}`}</title>
                        </path>
                    ))}

                    {!compact && flow.left.map(n => (
                        <g key={n.id}>
                            <rect x={COL.left} y={y(n.y)} width={NODE_W} height={Math.max(3, n.h)} rx="3" fill={BUCKET_COLORS.sources} />
                            {n.h >= 38 ? (
                                <>
                                    <text x={COL.left + NODE_W + 8} y={y(n.y) + 17} style={HALO} className="fill-slate-800 text-[13px] font-semibold">{n.label}</text>
                                    <text x={COL.left + NODE_W + 8} y={y(n.y) + 33} style={HALO} className="fill-slate-500 text-[12px] tabular-nums">{formatMoney(n.value)}</text>
                                </>
                            ) : (
                                <text x={COL.left + NODE_W + 8} y={y(n.y + n.h / 2) + 4.5} style={HALO} className="fill-slate-800 text-[13px] font-semibold">
                                    {n.label} <tspan className="fill-slate-500 font-normal tabular-nums">{formatMoney(n.value)}</tspan>
                                </text>
                            )}
                        </g>
                    ))}

                    {flow.mid.map(n => (
                        <g key={n.id}>
                            <rect x={COL.mid} y={y(n.y)} width={NODE_W} height={Math.max(3, n.h)} rx="3" fill={colorOf(n.id)} />
                            <text x={COL.mid + NODE_W + 8} y={y(n.y) + 17} style={HALO} className="fill-slate-800 text-[13px] font-semibold">{n.label}</text>
                            {n.h >= 34 && (
                                <text x={COL.mid + NODE_W + 8} y={y(n.y) + 33} style={HALO} className="fill-slate-500 text-[12px] tabular-nums">
                                    {formatMoney(n.value)} · {Math.round((n.value / total) * 100)}%
                                </text>
                            )}
                        </g>
                    ))}

                    {flow.right.map(n => (
                        <g key={n.id}>
                            <rect x={COL.right} y={y(n.y)} width={NODE_W} height={Math.max(3, n.h)} rx="3" fill={colorOf(n.bucket)} />
                            <text x={COL.right + NODE_W + 10} y={y(n.y + Math.max(3, n.h) / 2) + 4.5} className="fill-slate-700 text-[13px]">
                                {truncate(n.label, maxLabel)}
                                <tspan dx="6" className="fill-slate-400 tabular-nums">{formatMoney(n.value)}</tspan>
                            </text>
                        </g>
                    ))}
                </svg>
            )}
        </div>
    );
}
