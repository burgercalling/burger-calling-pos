import { AppShell } from "@/components/layout/app-shell";
import { UserManagementView } from "@/components/users/user-management-view";

export default function OwnerCashiersPage() {
  return <AppShell><UserManagementView mode="owner" /></AppShell>;
}
