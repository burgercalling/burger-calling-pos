"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api";
import type { PaginatedStockRequestsResponse, StockRequest, StockRequestStatus } from "@/types/stock-request";

export function useStockRequests(params: { franchise_id?: string; status?: StockRequestStatus; page?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.franchise_id) qs.set("franchise_id", params.franchise_id);
  if (params.status) qs.set("status", params.status);
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", "30");

  return useQuery<PaginatedStockRequestsResponse, ApiError>({
    queryKey: ["stock-requests", params],
    queryFn: () => apiFetch<PaginatedStockRequestsResponse>(`/stock-requests?${qs.toString()}`),
  });
}

export function useCreateStockRequest() {
  const qc = useQueryClient();
  return useMutation<StockRequest, ApiError, { items: { inventory_item_id: string; requested_qty: number }[]; remarks?: string }>({
    mutationFn: (payload) => apiFetch<StockRequest>("/stock-requests", { method: "POST", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-requests"] }),
  });
}

export function useReviewStockRequest() {
  const qc = useQueryClient();
  return useMutation<StockRequest, ApiError, { id: string; decision: "approved" | "rejected"; admin_notes?: string; items?: { item_id: string; approved_qty: number }[] }>({
    mutationFn: ({ id, ...body }) => apiFetch<StockRequest>(`/stock-requests/${id}/review`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-requests"] }),
  });
}

export function useAdvanceStockRequestStatus() {
  const qc = useQueryClient();
  return useMutation<StockRequest, ApiError, { id: string; next_status: "packed" | "dispatched" | "delivered"; admin_notes?: string }>({
    mutationFn: ({ id, ...body }) => apiFetch<StockRequest>(`/stock-requests/${id}/status`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-requests"] });
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      qc.invalidateQueries({ queryKey: ["inventory-transactions"] });
    },
  });
}
