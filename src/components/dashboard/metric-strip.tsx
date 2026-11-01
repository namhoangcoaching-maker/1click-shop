"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatValue, percentChange } from "@/lib/format";
import type { Metric, MetricKey } from "@/lib/overview/types";
import { TrendBadge } from "./trend-badge";
import { TrendChart } from "./trend-chart";

/**
 * Dải chỉ số kiểu Pancake (Doanh số | Doanh thu | Lợi nhuận | …) có vạch ngăn.
 * Bấm vào chỉ số nào thì biểu đồ bên dưới vẽ chỉ số đó.
 */
export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  const [selectedKey, setSelectedKey] = useState<MetricKey>(metrics[0].key);
  const selected = metrics.find((m) => m.key === selectedKey) ?? metrics[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Chọn chỉ số để vẽ biểu đồ"
        className="-mx-4 flex overflow-x-auto border-b px-4"
      >
        {metrics.map((metric) => {
          const isSelected = metric.key === selected.key;
          return (
            <button
              key={metric.key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedKey(metric.key)}
              title={metric.hint}
              className={cn(
                "relative min-w-36 flex-1 space-y-1 px-3 py-2.5 text-right transition-colors hover:bg-muted/60",
                "not-first:before:absolute not-first:before:inset-y-3 not-first:before:left-0 not-first:before:w-px not-first:before:bg-border",
                "border-b-2 -mb-px",
                isSelected ? "border-primary" : "border-transparent",
              )}
            >
              <div className={cn("text-sm", isSelected ? "text-primary" : "text-muted-foreground")}>
                {metric.label}
              </div>
              <div className="text-[17px] font-semibold tabular-nums">
                {formatValue(metric.value, metric.format)}
              </div>
              {metric.previous !== null && (
                <TrendBadge
                  change={percentChange(metric.value, metric.previous)}
                  positiveIsGood={metric.positiveIsGood}
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="pt-4">
        <TrendChart series={selected.series} format={selected.format} />
      </div>
    </div>
  );
}
