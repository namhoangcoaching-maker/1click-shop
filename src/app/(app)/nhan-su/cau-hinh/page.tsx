import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChevronRightIcon, MapPinIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { AddMemberForm, LocationsManager } from "@/components/staff/member-manager";
import { formatDateTimeVN } from "@/lib/date-range";
import { getManagerOrg } from "@/lib/org/guard";
import { roleLabel } from "@/lib/org/roles";
import { getLocations, getMembers } from "@/lib/staff/data";
import { assignableRoles, canManage } from "@/lib/staff/permissions";
import { ATTENDANCE_LABELS, describeShift } from "@/lib/staff/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cấu hình nhân sự" };

export default function StaffConfigPage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] space-y-4 px-4 py-4 md:px-6">
      <div>
        <h1 className="text-xl font-bold">Cấu hình nhân sự</h1>
        <p className="text-sm text-muted-foreground">
          Thêm nhân sự, rồi bấm vào từng người để cấu hình chấm công, ca làm, lương. Chủ shop quản lý mọi người; Quản lý
          quản lý người vai trò Nhân viên.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 bg-card" />}>
        <Config />
      </Suspense>
    </main>
  );
}

async function Config() {
  await connection();
  const org = await getManagerOrg();
  if (!org) return null;
  const [members, locations] = await Promise.all([getMembers(org.id), getLocations(org.id)]);
  const active = members.filter((m) => !m.disabledAt).length;

  return (
    <>
      <Panel title="Thêm nhân sự" icon={UserPlusIcon} tone="green">
        <p className="mb-3 text-sm text-muted-foreground">
          Tạo tài khoản bằng email + mật khẩu tạm. Gửi cho nhân sự địa chỉ web, email, mật khẩu tạm; họ đăng nhập rồi vào
          “Tài khoản” để đổi mật khẩu.
        </p>
        <AddMemberForm roles={assignableRoles(org.role)} />
      </Panel>

      <Panel
        title={`Danh sách (${active} đang làm${members.length > active ? `, ${members.length - active} đã khóa` : ""})`}
        icon={UsersIcon}
      >
        <ul className="divide-y">
          {members.map((m) => {
            const manageable = canManage(org.role, m.role);
            const body = (
              <>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-semibold">{m.displayName ?? "(chưa đặt tên)"}</span>
                    <span className="text-muted-foreground">{m.email}</span>
                    <span className="rounded bg-muted px-1.5 text-xs">{roleLabel(m.role)}</span>
                    {m.department && <span className="text-xs text-muted-foreground">· {m.department}</span>}
                    {m.disabledAt && <span className="rounded bg-destructive/10 px-1.5 text-xs text-destructive">Đã khóa</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.settings
                      ? `${m.settings.attendanceMode === "gps" ? "GPS tại shop" : "Online tại nhà"} · ${describeShift(m.settings)}`
                      : manageable
                        ? "Chưa cấu hình"
                        : "Chủ shop cấu hình"}
                    {" · "}
                    {m.lastSignInAt ? `đăng nhập gần nhất ${formatDateTimeVN(m.lastSignInAt)}` : "chưa đăng nhập lần nào"}
                  </div>
                </div>
                {manageable && <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
              </>
            );
            return (
              <li key={m.userId} className={cn(m.disabledAt && "opacity-60")}>
                {manageable ? (
                  <Link href={`/nhan-su/cau-hinh/${m.userId}`} className="-mx-2 flex items-center gap-2 rounded-md px-2 py-2.5 hover:bg-muted">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 py-2.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Địa điểm chấm công GPS" icon={MapPinIcon} tone="orange">
        <p className="mb-3 text-sm text-muted-foreground">
          Người chấm công “{ATTENDANCE_LABELS.gps}” phải đứng trong bán kính của địa điểm mới bấm Vào ca / Ra ca được.
          Người “{ATTENDANCE_LABELS.online}” không cần.
        </p>
        <LocationsManager locations={locations} />
      </Panel>
    </>
  );
}
