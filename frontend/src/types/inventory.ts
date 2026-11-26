import type { FranchiseSummary } from "@/types/auth";

export type InventoryUnit = "pcs" | "pack" | "kg" | "liter" | "box";
export type InventoryChangeType = "opening_stock" | "manual_adjust" | "request_delivered" | "wastage";

export interface InventoryItem {
  id: string;
  franchise_id: string;
  item_name: string;
  unit: InventoryUnit;
  current_stock: string;
  reorder_level: string;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  franchise: FranchiseSummary | null;
}

export interface PaginatedInventoryItemsResponse {
  items: InventoryItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface InventoryTransaction {
  id: string;
  inventory_item_id: string;
  franchise_id: string;
  performed_by_id: string;
  change_type: InventoryChangeType;
  quantity_delta: string;
  balance_after: string;
  remarks: string;
  created_at: string;
  inventory_item: { id: string; item_name: string; unit: InventoryUnit } | null;
  performed_by: { id: string; full_name: string; username: string } | null;
}

export interface PaginatedInventoryTransactionsResponse {
  items: InventoryTransaction[];
  total: number;
  page: number;
  page_size: number;
}
