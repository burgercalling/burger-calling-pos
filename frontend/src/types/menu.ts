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

export interface Product {
  id: string;
  category_id: string;
  sku: string | null;
  name: string;
  description: string | null;
  price: string;
  image_url: string | null;
  item_type: ProductItemType;
  is_available: boolean;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  category: { id: string; name: string } | null;
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

export function formatINR(value: string | number): string {
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(num);
}
