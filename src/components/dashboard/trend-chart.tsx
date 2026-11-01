"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatValue, type ValueFormat } from "@/lib/format";
import type { SeriesPoint } from "@/lib/overview/types";

const AXIS_TICK = { fontSize: 12, fill: "var(--muted-foreground)" };

interface TrendChartProps {
  series: SeriesPoint[];
  format: ValueFormat;
  height?: number;
}

/** Biểu đồ đường: kỳ này (xanh, nét liền) và kỳ trước (xám, nét đứt) – giống Pancake. */
export function TrendChart({ series, format, height = 260 }: TrendChartProps) {
  const hasPrevious = series.some((p) => p.previous !== null);

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
        <LegendKey dashed={false} label="Kỳ này" />
        {hasPrevious && <LegendKey dashed label="Kỳ trước" />}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            minTickGap={16}
            tickMargin={8}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompact(v)}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            width={52}
            allowDecimals={format !== "number"}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as SeriesPoint;
              return (
                <div className="min-w-44 rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                  <div className="mb-1 font-medium">{String(label)}</div>
                  <TooltipRow dashed={false} label="Kỳ này" value={formatValue(point.current, format)} />
                  {point.previous !== null && (
                    <TooltipRow dashed label="Kỳ trước" value={formatValue(point.previous, format)} />
                  )}
                </div>
              );
            }}
          />
          {hasPrevious && (
            <Line
              dataKey="previous"
              stroke="var(--muted-foreground)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          )}
          <Line
            dataKey="current"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function LegendKey({ dashed, label }: { dashed: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="18" height="4" aria-hidden>
        <line
          x1="0"
          y1="2"
          x2="18"
          y2="2"
          strokeWidth="2"
          stroke={dashed ? "var(--muted-foreground)" : "var(--primary)"}
          strokeDasharray={dashed ? "4 3" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}

function TooltipRow({ dashed, label, value }: { dashed: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <LegendKey dashed={dashed} label={label} />
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
