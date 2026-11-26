"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api";
import type { AuthResponse, AuthUser, LoginPayload } from "@/types/auth";

export const AUTH_QUERY_KEY = ["auth", "me"] as const;

export function useCurrentUser() {
  return useQuery<AuthUser, ApiError>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: () => apiFetch<AuthUser>("/auth/me", { method: "GET" }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useOutletLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation<AuthResponse, ApiError, LoginPayload>({
    mutationFn: (payload) => apiFetch<AuthResponse>("/auth/login", { method: "POST", body: payload }),
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, data.user);
      router.replace(data.user.role === "franchise_owner" ? "/owner/dashboard" : "/pos");
    },
  });
}

export function useSuperAdminLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation<AuthResponse, ApiError, LoginPayload>({
    mutationFn: (payload) => apiFetch<AuthResponse>("/auth/superadmin/login", { method: "POST", body: payload }),
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, data.user);
      router.replace("/superadmin/dashboard");
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation<{ message: string }, ApiError, void>({
    mutationFn: () => apiFetch<{ message: string }>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY });
      queryClient.clear();
      router.replace("/login");
    },
  });
}
