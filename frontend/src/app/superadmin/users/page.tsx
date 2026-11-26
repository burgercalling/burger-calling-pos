import { AppShell } from "@/components/layout/app-shell";
import { UserManagementView } from "@/components/users/user-management-view";

export default function SuperAdminUsersPage() {
  return <AppShell><UserManagementView mode="superadmin" /></AppShell>;
}
