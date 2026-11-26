"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api";
import type { Franchise, FranchiseCreatePayload, FranchiseUpdatePayload, PaginatedFranchisesResponse } from "@/types/franchise";

export interface FranchiseQueryParams {
  search?: string;
  is_active?: boolean | null;
  page?: number;
  page_size?: number;
}

export function useFranchises(params: FranchiseQueryParams = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.is_active !== undefined && params.is_active !== null) qs.set("is_active", String(params.is_active));
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(params.page_size ?? 20));

  return useQuery<PaginatedFranchisesResponse, ApiError>({
    queryKey: ["franchises", params],
    queryFn: () => apiFetch<PaginatedFranchisesResponse>(`/franchises?${qs.toString()}`),
  });
}

export function useCreateFranchise() {
  const qc = useQueryClient();
  return useMutation<Franchise, ApiError, FranchiseCreatePayload>({
    mutationFn: (payload) => apiFetch<Franchise>("/franchises", { method: "POST", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["franchises"] }),
  });
}

export function useUpdateFranchise() {
  const qc = useQueryClient();
  return useMutation<Franchise, ApiError, { id: string; payload: FranchiseUpdatePayload }>({
    mutationFn: ({ id, payload }) => apiFetch<Franchise>(`/franchises/${id}`, { method: "PATCH", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["franchises"] }),
  });
}

export function useSoftDeleteFranchise() {
  const qc = useQueryClient();
  return useMutation<Franchise, ApiError, string>({
    mutationFn: (id) => apiFetch<Franchise>(`/franchises/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["franchises"] }),
  });
}
