import type { FranchiseSummary, UserRole } from "@/types/auth";

export interface ManagedUser {
  id: string;
  franchise_id: string | null;
  full_name: string;
  username: string;
  role: UserRole;
  permissions: string[];
  last_login_at: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  franchise: FranchiseSummary | null;
}

export interface CreateUserPayload {
  franchise_id?: string | null;
  full_name: string;
  username: string;
  password: string;
  role: Exclude<UserRole, "super_admin">;
  permissions?: string[];
}

export interface UpdateUserPayload {
  full_name?: string;
  is_active?: boolean;
  permissions?: string[];
}

export interface PaginatedUsersResponse {
  items: ManagedUser[];
  total: number;
  page: number;
  page_size: number;
}

export interface PermissionOption {
  key: string;
  label: string;
  description: string;
  cashierOnlyToggleable: boolean;
}

export const POS_PERMISSIONS: PermissionOption[] = [
  { key: "pos:create_order", label: "Create POS Orders", description: "Ring up items and settle customer bills", cashierOnlyToggleable: true },
  { key: "pos:print_kot", label: "Enable KOT Printing", description: "Print Kitchen Order Ticket alongside receipt", cashierOnlyToggleable: true },
  { key: "pos:reprint_receipt", label: "Allow Receipt Reprint", description: "Reprint previously settled thermal bills", cashierOnlyToggleable: true },
  { key: "reports:today_sales", label: "View Today's Sales", description: "View current shift & today's outlet revenue", cashierOnlyToggleable: true },
  { key: "reports:outlet_analytics", label: "Outlet Analytics & Reports", description: "Access multi-day sales & item mix reports", cashierOnlyToggleable: false },
  { key: "inventory:manage", label: "Manage Outlet Inventory", description: "Adjust unit stock & submit stock requests", cashierOnlyToggleable: false },
  { key: "stock_requests:create", label: "Create Stock Requests", description: "Submit replenishment requests to admin", cashierOnlyToggleable: false },
  { key: "users:manage_cashiers", label: "Manage Outlet Cashiers", description: "Create, disable, and configure cashier access", cashierOnlyToggleable: false },
  { key: "settings:manage_outlet", label: "Manage Outlet Settings", description: "Configure printer width, KOT defaults & footer", cashierOnlyToggleable: false },
];
