import { EyeIcon, HeartIcon, ImageIcon, PlayIcon, SparklesIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { formatNumber } from "@/lib/format";
import type { ContentItem, ContentPlatform } from "@/lib/overview/types";

const PLATFORM_NAMES: Record<ContentPlatform, string> = {
  facebook: "Facebook",
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

/** 3 video và 3 hình ảnh có lượt xem cao nhất trong kỳ. */
export function TopContent({ items }: { items: ContentItem[] }) {
  const byViews = [...items].sort((a, b) => b.views - a.views);
  const videos = byViews.filter((i) => i.kind === "video").slice(0, 3);
  const images = byViews.filter((i) => i.kind === "image").slice(0, 3);

  return (
    <Panel title="Content xem nhiều nhất" icon={SparklesIcon} tone="violet">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
        <ContentList title="Video" items={videos} />
        <ContentList title="Hình ảnh" items={images} />
      </div>
    </Panel>
  );
}

function ContentList({ title, items }: { title: string; items: ContentItem[] }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-medium text-muted-foreground">{title}</h3>
      <ol className="divide-y">
        {items.map((item, index) => (
          <li key={item.title} className="flex items-center gap-3 py-2.5">
            <span className="relative flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {item.kind === "video" ? (
                <PlayIcon className="size-5" aria-hidden />
              ) : (
                <ImageIcon className="size-5" aria-hidden />
              )}
              <span className="absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                {index + 1}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <a href={item.url} className="line-clamp-2 text-sm font-medium hover:text-primary">
                {item.title}
              </a>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground tabular-nums">
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground/70">
                  {PLATFORM_NAMES[item.platform]}
                </span>
                <span className="inline-flex items-center gap-1">
                  <EyeIcon className="size-3.5" aria-hidden />
                  <span className="font-semibold text-foreground">{formatNumber(item.views)}</span> lượt xem
                </span>
                <span className="inline-flex items-center gap-1">
                  <HeartIcon className="size-3.5" aria-hidden />
                  {formatNumber(item.likes)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
