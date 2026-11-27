"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api";
import type { InventoryChangeType, InventoryItem, InventoryUnit, PaginatedInventoryItemsResponse, PaginatedInventoryTransactionsResponse } from "@/types/inventory";

export function useInventoryItems(params: { franchise_id?: string; low_stock_only?: boolean; search?: string; page?: number; page_size?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.franchise_id) qs.set("franchise_id", params.franchise_id);
  if (params.low_stock_only) qs.set("low_stock_only", "true");
  if (params.search) qs.set("search", params.search);
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(params.page_size ?? 50));

  return useQuery<PaginatedInventoryItemsResponse, ApiError>({
    queryKey: ["inventory-items", params],
    queryFn: () => apiFetch<PaginatedInventoryItemsResponse>(`/inventory/items?${qs.toString()}`),
  });
}

export function useCreateInventoryItem() {
  const qc = useQueryClient();
  return useMutation<{ created_count: number; skipped_count: number; items: InventoryItem[] }, ApiError, { franchise_id?: string | null; broadcast_all_active: boolean; item_name: string; unit: InventoryUnit; opening_stock: number; reorder_level: number }>({
    mutationFn: (payload) => apiFetch("/inventory/items", { method: "POST", body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      qc.invalidateQueries({ queryKey: ["inventory-transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useAdjustInventoryStock() {
  const qc = useQueryClient();
  return useMutation<InventoryItem, ApiError, { itemId: string; change_type: "manual_adjust" | "wastage" | "correction" | "return"; quantity_delta: number; remarks: string }>({
    mutationFn: ({ itemId, ...body }) => apiFetch<InventoryItem>(`/inventory/items/${itemId}/adjust`, { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      qc.invalidateQueries({ queryKey: ["inventory-transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useInventoryTransactions(params: { franchise_id?: string; inventory_item_id?: string; change_type?: InventoryChangeType; page?: number; page_size?: number; enabled?: boolean } = {}) {
  const { enabled = true, ...filters } = params;
  const qs = new URLSearchParams();
  if (filters.franchise_id) qs.set("franchise_id", filters.franchise_id);
  if (filters.inventory_item_id) qs.set("inventory_item_id", filters.inventory_item_id);
  if (filters.change_type) qs.set("change_type", filters.change_type);
  qs.set("page", String(filters.page ?? 1));
  qs.set("page_size", String(filters.page_size ?? 30));

  return useQuery<PaginatedInventoryTransactionsResponse, ApiError>({
    queryKey: ["inventory-transactions", filters],
    queryFn: () => apiFetch<PaginatedInventoryTransactionsResponse>(`/inventory/transactions?${qs.toString()}`),
    enabled,
  });
}
