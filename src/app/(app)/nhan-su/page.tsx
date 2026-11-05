import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { UserPlusIcon, UsersIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { Skeleton } from "@/components/dashboard/stat-card";
import { AddMemberForm, MemberList, type MemberRow } from "@/components/staff/member-manager";
import { formatDateTimeVN } from "@/lib/date-range";
import { getManagerOrg } from "@/lib/org/guard";
import { createClient } from "@/lib/supabase/server";
import { getMembers } from "@/lib/staff/data";

export const metadata: Metadata = { title: "Nhân sự" };

export default function StaffPage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] space-y-4 px-4 py-4 md:px-6">
      <div>
        <h1 className="text-xl font-bold">Nhân sự</h1>
        <p className="text-sm text-muted-foreground">
          Tài khoản nhân viên của shop. Nhân viên chỉ thấy trang “Của tôi” (sắp có chấm công, công việc, lương của mình),
          không thấy số tiền, tồn kho, kết nối. Quản lý xem được mọi trang; chỉ Chủ shop thêm, sửa, khóa tài khoản.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-80 bg-card" />}>
        <Staff />
      </Suspense>
    </main>
  );
}

async function Staff() {
  await connection();
  const org = await getManagerOrg();
  if (!org) return null;
  const [members, supabase] = await Promise.all([getMembers(org.id), createClient()]);
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub;
  const canEdit = org.role === "owner";
  const rows: MemberRow[] = members.map((m) => ({
    userId: m.userId,
    email: m.email,
    displayName: m.displayName,
    role: m.role,
    department: m.department,
    locked: m.disabledAt !== null,
    lastSignIn: m.lastSignInAt ? formatDateTimeVN(m.lastSignInAt) : null,
    isMe: m.userId === me,
  }));
  const active = rows.filter((r) => !r.locked).length;

  return (
    <>
      {canEdit && (
        <Panel title="Thêm nhân viên" icon={UserPlusIcon} tone="green">
          <p className="mb-3 text-sm text-muted-foreground">
            Tạo tài khoản đăng nhập bằng email + mật khẩu tạm. Gửi cho nhân viên địa chỉ web, email và mật khẩu tạm; họ
            đăng nhập rồi vào “Của tôi” để đổi mật khẩu.
          </p>
          <AddMemberForm />
        </Panel>
      )}
      <Panel title={`Thành viên (${active} đang làm${rows.length > active ? `, ${rows.length - active} đã khóa` : ""})`} icon={UsersIcon}>
        <MemberList members={rows} canEdit={canEdit} />
      </Panel>
    </>
  );
}
