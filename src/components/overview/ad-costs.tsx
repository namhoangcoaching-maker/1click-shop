import { MegaphoneIcon } from "lucide-react";
import { InsetBox, Panel, ProgressBar } from "@/components/dashboard/panel";
import { TrendBadge } from "@/components/dashboard/trend-badge";
import { formatPercent, formatVND, percentChange, ratio } from "@/lib/format";
import type { AdChannelCost } from "@/lib/overview/types";

/** Tỷ lệ chi phí quảng cáo / doanh thu kênh từ mức này trở lên được tô cam để chủ shop chú ý. */
const HIGH_AD_RATIO = 25;

/** Chi phí quảng cáo từng kênh, so với kỳ trước và so với doanh thu của chính kênh đó. */
export function AdCosts({ channels, totalRevenue }: { channels: AdChannelCost[]; totalRevenue: number }) {
  const total = channels.reduce((sum, c) => sum + c.cost.value, 0);
  const hasPrevious = channels.some((c) => c.cost.previous !== null);
  const totalPrevious = channels.reduce((sum, c) => sum + (c.cost.previous ?? 0), 0);

  return (
    <Panel title="Chi phí quảng cáo" icon={MegaphoneIcon} tone="red">
      <InsetBox className="mb-2 flex items-end justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Tổng chi phí</div>
          <div className="text-xl font-semibold tabular-nums">{formatVND(total)}</div>
          {hasPrevious && (
            <TrendBadge change={percentChange(total, totalPrevious)} positiveIsGood={false} />
          )}
        </div>
        <div className="text-right text-sm">
          <div className="text-muted-foreground">Trên tổng doanh thu</div>
          <div className="font-semibold tabular-nums">{formatPercent(ratio(total, totalRevenue), 1)}</div>
        </div>
      </InsetBox>

      <ul className="divide-y">
        {channels.map((channel) => {
          const adRatio = ratio(channel.cost.value, channel.channelRevenue);
          return (
            <li key={channel.channel} className="space-y-1.5 py-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{channel.channel}</span>
                <span className="font-semibold tabular-nums">{formatVND(channel.cost.value)}</span>
              </div>
              <div className="flex items-center gap-2">
                <ProgressBar
                  value={adRatio}
                  tone={adRatio >= HIGH_AD_RATIO ? "orange" : "blue"}
                  label={`Chi phí / doanh thu ${channel.channel}`}
                  className="flex-1"
                />
                <span className="w-32 text-right text-xs text-muted-foreground tabular-nums">
                  {formatPercent(adRatio, 1)} doanh thu kênh
                </span>
                {channel.cost.previous !== null && (
                  <TrendBadge
                    change={percentChange(channel.cost.value, channel.cost.previous)}
                    positiveIsGood={false}
                    className="w-16 justify-end"
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
