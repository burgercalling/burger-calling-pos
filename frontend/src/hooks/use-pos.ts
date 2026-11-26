"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api";
import type { Customer, OrderReceiptPayload, OrderType, PaymentMode, TodayOrdersSummary } from "@/types/pos";

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation<OrderReceiptPayload, ApiError, { order_type: OrderType; payment_mode: PaymentMode; items: { product_id: string; quantity: number }[]; discount_type: "none" | "flat" | "percent"; discount_value: number; customer_phone?: string; customer_name?: string; print_kot: boolean }>({
    mutationFn: (payload) => apiFetch<OrderReceiptPayload>("/pos/orders", { method: "POST", body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos", "today"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useTodayOrders() {
  return useQuery<TodayOrdersSummary, ApiError>({
    queryKey: ["pos", "today"],
    queryFn: () => apiFetch<TodayOrdersSummary>("/pos/orders/today"),
  });
}

export function useReprintOrder() {
  const qc = useQueryClient();
  return useMutation<OrderReceiptPayload, ApiError, string>({
    mutationFn: (orderId) => apiFetch<OrderReceiptPayload>(`/pos/orders/${orderId}/reprint`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos", "today"] }),
  });
}

export function useCustomerLookup(search: string) {
  const trimmed = search.trim();
  return useQuery<Customer[], ApiError>({
    queryKey: ["customers", "lookup", trimmed],
    queryFn: () => apiFetch<Customer[]>(`/customers?search=${encodeURIComponent(trimmed)}&limit=5`),
    enabled: trimmed.length >= 3,
  });
}
