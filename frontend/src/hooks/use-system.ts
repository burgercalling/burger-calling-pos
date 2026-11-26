"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiFetch, apiUpload } from "@/lib/api";
import type { ActivityLogEntry, AuditLogEntry, PosSetting, RestoreResult } from "@/types/system";

export function useGlobalSettings() {
  return useQuery<PosSetting, ApiError>({
    queryKey: ["settings", "global"],
    queryFn: () => apiFetch<PosSetting>("/settings/global"),
  });
}

export function useUpdateGlobalSettings() {
  const qc = useQueryClient();
  return useMutation<PosSetting, ApiError, Partial<PosSetting>>({
    mutationFn: (payload) => apiFetch<PosSetting>("/settings/global", { method: "PATCH", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "global"] }),
  });
}

export function useAuditLogs(params: { search?: string; action?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.action) qs.set("action", params.action);
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", "25");

  return useQuery<{ items: AuditLogEntry[]; total: number; page: number; page_size: number }, ApiError>({
    queryKey: ["logs", "audit", params],
    queryFn: () => apiFetch(`/logs/audit?${qs.toString()}`),
  });
}

export function useActivityLogs(params: { search?: string; event_type?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.event_type) qs.set("event_type", params.event_type);
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", "30");

  return useQuery<{ items: ActivityLogEntry[]; total: number; page: number; page_size: number }, ApiError>({
    queryKey: ["logs", "activity", params],
    queryFn: () => apiFetch(`/logs/activity?${qs.toString()}`),
    refetchInterval: 15_000,
  });
}

export function useRestoreDatabase() {
  const qc = useQueryClient();
  return useMutation<RestoreResult, ApiError, File>({
    mutationFn: (file) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiUpload<RestoreResult>("/system/restore", formData);
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}
