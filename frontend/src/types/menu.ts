export type ProductItemType = "regular" | "combo" | "addon";

export interface Category {
  id: string;
  name: string;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductPrice {
  id?: string;
  product_id?: string;
  order_source: string;
  price: string;
}

export interface RecipeItem {
  id?: string;
  product_id?: string;
  ingredient_name: string;
  quantity_required: string | number;
  unit: string;
}

export interface Product {
  id: string;
  category_id: string;
  sku: string | null;
  name: string;
  description: string | null;
  price: string;
  cost_price?: string | null;
  tax_rate?: string | null;
  image_url: string | null;
  item_type: ProductItemType;
  is_available: boolean;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  category: { id: string; name: string } | null;
  recipes?: RecipeItem[];
  prices?: ProductPrice[];
}

export function getProductChannelPrice(product: Product, orderSource: string): number {
  const src = (orderSource || "dine_in").trim().toLowerCase();
  const match = product.prices?.find((p) => p.order_source.trim().toLowerCase() === src);
  const raw = match ? match.price : product.price;
  const parsed = Number.parseFloat(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export interface PaginatedProductsResponse {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
}

export interface MediaUploadResponse {
  image_url: string;
  relative_path: string;
  filename: string;
  folder: string;
  bytes: number;
  content_type: string;
}

export interface BulkImportRow {
  row_number: number;
  category: string;
  name: string;
  description?: string | null;
  price: string | number | null;
  dine_in_price?: string | number | null;
  takeaway_price?: string | number | null;
  swiggy_price?: string | number | null;
  zomato_price?: string | number | null;
  cost_price?: string | number | null;
  image_url?: string | null;
  is_available: boolean;
  sku?: string | null;
  tax_rate?: string | number | null;
  item_type: ProductItemType;
  status: "create" | "update" | "skip" | "error";
  error?: string | null;
}

export interface BulkImportPreviewResponse {
  total_rows: number;
  valid_creates: number;
  valid_updates: number;
  skipped: number;
  errors: number;
  rows: BulkImportRow[];
}

export interface BulkImportCommitResponse {
  imported: number;
  updated: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export interface ZomatoImportRowInput {
  category: string;
  name: string;
  description?: string | null;
  price: number;
  cost_price?: number | null;
  image_url?: string | null;
  is_available: boolean;
  sku?: string | null;
  tax_rate?: number | null;
  item_type: ProductItemType;
}

export function formatINR(value: string | number): string {
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(num);
}
