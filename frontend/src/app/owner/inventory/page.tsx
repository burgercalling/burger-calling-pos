import { InventoryDashboardView } from "@/components/inventory/inventory-dashboard-view";
import { AppShell } from "@/components/layout/app-shell";

export default function OwnerInventoryPage() {
  return <AppShell><InventoryDashboardView mode="owner" /></AppShell>;
}
