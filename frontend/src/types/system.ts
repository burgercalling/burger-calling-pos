import type { PrinterWidthMode } from "@/types/pos";

export interface PosSetting {
  id: string;
  franchise_id: string | null;
  brand_name: string;
  logo_url: string | null;
  receipt_footer: string;
  tax_enabled: boolean;
  tax_label: string;
  tax_rate: string;
  gstin: string | null;
  currency_code: string;
  currency_symbol: string;
  date_format: string;
  timezone: string;
  printer_width_mode: PrinterWidthMode;
  default_kot_enabled: boolean;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  franchise_id: string | null;
  outlet_code: string | null;
  outlet_name: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_username: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  franchise_id: string | null;
  outlet_code: string | null;
  outlet_name: string | null;
  user_id: string | null;
  user_name: string | null;
  user_username: string | null;
  event_type: string;
  description: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface RestoreResult {
  message: string;
  schema_version: string;
  restored_counts: Record<string, number>;
}
