"use client";

import { useQuery } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api";
import type {
  DailySalesRow,
  InventoryReportRow,
  MasterDashboardData,
  MonthlySalesRow,
  OutletDashboardData,
  PaymentSalesRow,
  ProductSalesRow,
  StockRequestReportRow,
} from "@/types/analytics";

export function useOutletDashboard(franchiseId?: string) {
  const qs = franchiseId ? `?franchise_id=${franchiseId}` : "";
  return useQuery<OutletDashboardData, ApiError>({
    queryKey: ["dashboard", "outlet", franchiseId ?? "self"],
    queryFn: () => apiFetch<OutletDashboardData>(`/dashboard/outlet${qs}`),
    refetchInterval: 30_000,
  });
}

export function useMasterDashboard() {
  return useQuery<MasterDashboardData, ApiError>({
    queryKey: ["dashboard", "master"],
    queryFn: () => apiFetch<MasterDashboardData>("/dashboard/master"),
    refetchInterval: 30_000,
  });
}

export interface ReportFilterParams {
  start_date: string;
  end_date: string;
  franchise_id?: string;
}

function buildReportQuery(params: ReportFilterParams, format: "json" | "csv" = "json") {
  const qs = new URLSearchParams({ start_date: params.start_date, end_date: params.end_date, format });
  if (params.franchise_id) qs.set("franchise_id", params.franchise_id);
  return qs.toString();
}

export function getReportCsvUrl(reportPath: string, params: ReportFilterParams): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
  return `${base}/reports/${reportPath}?${buildReportQuery(params, "csv")}`;
}

export function useDailySalesReport(params: ReportFilterParams, enabled = true) {
  return useQuery<DailySalesRow[], ApiError>({
    queryKey: ["reports", "daily-sales", params],
    queryFn: () => apiFetch<DailySalesRow[]>(`/reports/daily-sales?${buildReportQuery(params)}`),
    enabled,
  });
}

export function useMonthlySalesReport(params: ReportFilterParams, enabled = true) {
  return useQuery<MonthlySalesRow[], ApiError>({
    queryKey: ["reports", "monthly-sales", params],
    queryFn: () => apiFetch<MonthlySalesRow[]>(`/reports/monthly-sales?${buildReportQuery(params)}`),
    enabled,
  });
}

export function useProductSalesReport(params: ReportFilterParams, enabled = true) {
  return useQuery<ProductSalesRow[], ApiError>({
    queryKey: ["reports", "product-sales", params],
    queryFn: () => apiFetch<ProductSalesRow[]>(`/reports/product-sales?${buildReportQuery(params)}`),
    enabled,
  });
}

export function usePaymentSalesReport(params: ReportFilterParams, enabled = true) {
  return useQuery<PaymentSalesRow[], ApiError>({
    queryKey: ["reports", "payment-sales", params],
    queryFn: () => apiFetch<PaymentSalesRow[]>(`/reports/payment-sales?${buildReportQuery(params)}`),
    enabled,
  });
}

export function useInventoryReport(params: ReportFilterParams, enabled = true) {
  return useQuery<InventoryReportRow[], ApiError>({
    queryKey: ["reports", "inventory", params],
    queryFn: () => apiFetch<InventoryReportRow[]>(`/reports/inventory?${buildReportQuery(params)}`),
    enabled,
  });
}

export function useStockRequestReport(params: ReportFilterParams, enabled = true) {
  return useQuery<StockRequestReportRow[], ApiError>({
    queryKey: ["reports", "stock-requests", params],
    queryFn: () => apiFetch<StockRequestReportRow[]>(`/reports/stock-requests?${buildReportQuery(params)}`),
    enabled,
  });
}
