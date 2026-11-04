import { getCurrentOrg } from "@/lib/org/current";
import { roleLabel, shopInitials } from "@/lib/org/roles";

/** Ô tên shop + vai trò ở đầu menu trái, đọc từ database. */
export async function ShopCard() {
  const org = await getCurrentOrg();
  if (!org) {
    return <ShopBadge name="Chưa có shop" subtitle="Liên hệ quản trị 1Click" />;
  }
  return <ShopBadge name={org.name} subtitle={roleLabel(org.role)} logoUrl={org.logoUrl} />;
}

export function ShopBadge({
  name,
  subtitle,
  logoUrl,
}: {
  name: string;
  subtitle: string;
  logoUrl?: string | null;
}) {
  return (
    <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-lg bg-muted px-2.5 py-2">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo shop do khách tải lên, kích thước nhỏ
        <img src={logoUrl} alt="" className="size-8 rounded-md object-cover" />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-700 text-xs font-bold text-white">
          {shopInitials(name)}
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}

export function ShopCardSkeleton() {
  return (
    <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-lg bg-muted px-2.5 py-2" aria-hidden>
      <span className="size-8 shrink-0 animate-pulse rounded-md bg-slate-300" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-300" />
        <div className="h-2.5 w-14 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}
