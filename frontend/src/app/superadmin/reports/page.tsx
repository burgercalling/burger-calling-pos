import { AppShell } from "@/components/layout/app-shell";
import { ReportsExplorerView } from "@/components/reports/reports-explorer-view";

export default function SuperAdminReportsPage() {
  return <AppShell><ReportsExplorerView mode="superadmin" /></AppShell>;
}
