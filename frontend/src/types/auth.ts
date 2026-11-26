export type UserRole = "super_admin" | "franchise_owner" | "cashier";
export type FranchiseModelType = "Signature Restaurant" | "Express Kiosk" | "Mini Outlet";

export interface FranchiseSummary {
  id: string;
  outlet_code: string;
  name: string;
  model_type: FranchiseModelType;
  city: string;
}

export interface AuthUser {
  id: string;
  franchise_id: string | null;
  full_name: string;
  username: string;
  role: UserRole;
  permissions: string[];
  last_login_at: string | null;
  is_active: boolean;
  franchise: FranchiseSummary | null;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  message: string;
}
