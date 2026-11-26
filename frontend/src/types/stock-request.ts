import type { FranchiseSummary } from "@/types/auth";

export type StockRequestStatus = "pending" | "approved" | "rejected" | "packed" | "dispatched" | "delivered";

export interface StockRequestItem {
  id: string;
  stock_request_id: string;
  inventory_item_id: string;
  item_name_snapshot: string;
  unit_snapshot: string;
  requested_qty: string;
  approved_qty: string | null;
}

export interface StockRequest {
  id: string;
  request_number: string;
  franchise_id: string;
  requested_by_id: string;
  reviewed_by_id: string | null;
  status: StockRequestStatus;
  remarks: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  franchise: FranchiseSummary | null;
  requested_by: { id: string; full_name: string; username: string } | null;
  reviewed_by: { id: string; full_name: string; username: string } | null;
  items: StockRequestItem[];
}

export interface PaginatedStockRequestsResponse {
  items: StockRequest[];
  total: number;
  page: number;
  page_size: number;
}
