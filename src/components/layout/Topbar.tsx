import { isPreviewMode } from "@/lib/supabase/preview/config";
import { PreviewRoleSwitcher } from "./PreviewRoleSwitcher";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

// The account control lives here, top right, rather than in the sidebar.
// PreviewRoleSwitcher is gated on isPreviewMode(), so it disappears on its
// own the moment a real Supabase project is connected — there is nothing to
// remember to delete.
export function Topbar({
  userId,
  fullName,
  role,
  hasAvatar,
}: {
  userId: string;
  fullName: string;
  role: string;
  hasAvatar: boolean;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-end gap-3 bg-white px-6">
      <NotificationBell />
      {isPreviewMode() && <PreviewRoleSwitcher current={role} />}
      <UserMenu
        userId={userId}
        fullName={fullName}
        role={role}
        hasAvatar={hasAvatar}
        canSignOut={!isPreviewMode()}
      />
    </header>
  );
}
