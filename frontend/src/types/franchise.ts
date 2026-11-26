import type { FranchiseModelType } from "@/types/auth";

export interface Franchise {
  id: string;
  outlet_code: string;
  name: string;
  model_type: FranchiseModelType;
  city: string;
  address: string;
  phone: string;
  email: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FranchiseCreatePayload {
  outlet_code: string;
  name: string;
  model_type: FranchiseModelType;
  city: string;
  address: string;
  phone: string;
  email?: string | null;
}

export interface FranchiseUpdatePayload {
  name?: string;
  model_type?: FranchiseModelType;
  city?: string;
  address?: string;
  phone?: string;
  email?: string | null;
  is_active?: boolean;
}

export interface PaginatedFranchisesResponse {
  items: Franchise[];
  total: number;
  page: number;
  page_size: number;
}
