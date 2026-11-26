"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiFetch, apiUpload } from "@/lib/api";
import type { Category, MediaUploadResponse, PaginatedProductsResponse, Product, ProductItemType } from "@/types/menu";

export type UploadFolder = "products" | "categories" | "logos";

export function useCategories(includeInactive = false) {
  return useQuery<Category[], ApiError>({
    queryKey: ["categories", includeInactive],
    queryFn: () => apiFetch<Category[]>(`/categories?include_inactive=${includeInactive ? "true" : "false"}`),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation<Category, ApiError, { name: string; image_url?: string | null; display_order: number }>({
    mutationFn: (payload) => apiFetch<Category>("/categories", { method: "POST", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation<Category, ApiError, { id: string; payload: { name?: string; image_url?: string | null; display_order?: number; is_active?: boolean } }>({
    mutationFn: ({ id, payload }) => apiFetch<Category>(`/categories/${id}`, { method: "PATCH", body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation<Category, ApiError, { id: string; reassignToId?: string }>({
    mutationFn: ({ id, reassignToId }) => {
      const qs = reassignToId ? `?reassign_to_category_id=${reassignToId}` : "";
      return apiFetch<Category>(`/categories/${id}${qs}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export interface ProductsFilterParams {
  category_id?: string;
  item_type?: ProductItemType;
  search?: string;
  is_available?: boolean | null;
  page?: number;
  page_size?: number;
}

export function useProducts(params: ProductsFilterParams = {}) {
  const qs = new URLSearchParams();
  if (params.category_id) qs.set("category_id", params.category_id);
  if (params.item_type) qs.set("item_type", params.item_type);
  if (params.search) qs.set("search", params.search);
  if (params.is_available !== undefined && params.is_available !== null) qs.set("is_available", String(params.is_available));
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(params.page_size ?? 50));

  return useQuery<PaginatedProductsResponse, ApiError>({
    queryKey: ["products", params],
    queryFn: () => apiFetch<PaginatedProductsResponse>(`/products?${qs.toString()}`),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation<Product, ApiError, { category_id: string; sku?: string | null; name: string; description?: string | null; price: number; image_url?: string | null; item_type: ProductItemType; is_available: boolean }>({
    mutationFn: (payload) => apiFetch<Product>("/products", { method: "POST", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation<Product, ApiError, { id: string; payload: Partial<{ category_id: string; sku: string | null; name: string; description: string | null; price: number; image_url: string | null; item_type: ProductItemType; is_available: boolean }> }>({
    mutationFn: ({ id, payload }) => apiFetch<Product>(`/products/${id}`, { method: "PATCH", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useToggleProductAvailability() {
  const qc = useQueryClient();
  return useMutation<Product, ApiError, { id: string; is_available: boolean }>({
    mutationFn: ({ id, is_available }) => apiFetch<Product>(`/products/${id}/availability`, { method: "PATCH", body: { is_available } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation<Product, ApiError, string>({
    mutationFn: (id) => apiFetch<Product>(`/products/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useMediaUpload(folder: UploadFolder = "products") {
  return useMutation<MediaUploadResponse, ApiError, { file: File; oldPath?: string | null }>({
    mutationFn: ({ file, oldPath }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (oldPath) {
        formData.append("folder", folder);
        formData.append("old_path", oldPath);
        return apiUpload<MediaUploadResponse>("/media/replace", formData, "PUT");
      }
      return apiUpload<MediaUploadResponse>(`/media/${folder}`, formData, "POST");
    },
  });
}
