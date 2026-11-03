import { LogOutIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";

/** Email người đang đăng nhập + nút Đăng xuất, ở cuối menu trái. */
export async function AccountMenu() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";

  return (
    <div className="flex items-center gap-2 px-2.5 py-1">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary uppercase">
        {email.slice(0, 1) || "?"}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={email}>
        {email}
      </span>
      <form action={signOut}>
        <button
          type="submit"
          title="Đăng xuất"
          aria-label="Đăng xuất"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          <LogOutIcon className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function AccountMenuSkeleton() {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1" aria-hidden>
      <span className="size-7 shrink-0 animate-pulse rounded-full bg-muted" />
      <span className="h-3 flex-1 animate-pulse rounded bg-muted" />
    </div>
  );
}
