"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api";
import type { UserRole } from "@/types/auth";
import type { CreateUserPayload, ManagedUser, PaginatedUsersResponse, UpdateUserPayload } from "@/types/user";

export interface UsersQueryParams {
  franchise_id?: string;
  role?: UserRole;
  search?: string;
  is_active?: boolean | null;
  page?: number;
  page_size?: number;
}

export function useUsers(params: UsersQueryParams = {}) {
  const qs = new URLSearchParams();
  if (params.franchise_id) qs.set("franchise_id", params.franchise_id);
  if (params.role) qs.set("role", params.role);
  if (params.search) qs.set("search", params.search);
  if (params.is_active !== undefined && params.is_active !== null) qs.set("is_active", String(params.is_active));
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(params.page_size ?? 20));

  return useQuery<PaginatedUsersResponse, ApiError>({
    queryKey: ["users", params],
    queryFn: () => apiFetch<PaginatedUsersResponse>(`/users?${qs.toString()}`),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation<ManagedUser, ApiError, CreateUserPayload>({
    mutationFn: (payload) => apiFetch<ManagedUser>("/users", { method: "POST", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation<ManagedUser, ApiError, { id: string; payload: UpdateUserPayload }>({
    mutationFn: ({ id, payload }) => apiFetch<ManagedUser>(`/users/${id}`, { method: "PATCH", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUserPermissions() {
  const qc = useQueryClient();
  return useMutation<ManagedUser, ApiError, { id: string; permissions: string[] }>({
    mutationFn: ({ id, permissions }) => apiFetch<ManagedUser>(`/users/${id}/permissions`, { method: "PATCH", body: { permissions } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useResetUserPassword() {
  return useMutation<{ message: string }, ApiError, { id: string; new_password: string }>({
    mutationFn: ({ id, new_password }) => apiFetch<{ message: string }>(`/users/${id}/reset-password`, { method: "POST", body: { new_password } }),
  });
}

export function useSoftDeleteUser() {
  const qc = useQueryClient();
  return useMutation<ManagedUser, ApiError, string>({
    mutationFn: (id) => apiFetch<ManagedUser>(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
