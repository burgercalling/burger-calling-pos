import { AppShell } from "@/components/layout/app-shell";
import { ReportsExplorerView } from "@/components/reports/reports-explorer-view";

export default function OwnerReportsPage() {
  return <AppShell><ReportsExplorerView mode="owner" /></AppShell>;
}
