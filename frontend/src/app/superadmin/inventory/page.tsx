import { InventoryDashboardView } from "@/components/inventory/inventory-dashboard-view";
import { AppShell } from "@/components/layout/app-shell";

export default function SuperAdminInventoryPage() {
  return <AppShell><InventoryDashboardView mode="superadmin" /></AppShell>;
}
