export type OrderType = "dine_in" | "takeaway" | "swiggy" | "zomato";
export type PaymentMode = "cash" | "upi" | "card" | "split";
export type PrinterWidthMode = "auto" | "80mm" | "58mm";

export const ORDER_SOURCE_LABELS: Record<string, string> = {
  dine_in: "Dine In",
  takeaway: "Take Away",
  swiggy: "Swiggy",
  zomato: "Zomato",
};

export interface Customer {
  id: string;
  franchise_id: string;
  name: string | null;
  phone: string;
  total_orders: number;
  total_spent: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name_snapshot: string;
  unit_price: string;
  quantity: number;
  line_total: string;
}

export interface Order {
  id: string;
  bill_number: string;
  bill_date: string;
  daily_sequence: number;
  franchise_id: string;
  cashier_id: string;
  customer_id: string | null;
  order_type: OrderType;
  order_source: string;
  external_order_number: string | null;
  customer_name_snapshot: string | null;
  table_number: string | null;
  payment_mode: PaymentMode;
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  grand_total: string;
  kot_printed: boolean;
  reprint_count: number;
  status: "completed" | "voided";
  created_at: string;
  customer: Customer | null;
  items: OrderItem[];
}

export interface ReceiptSettings {
  brand_name: string;
  logo_url: string | null;
  receipt_footer: string;
  tax_enabled: boolean;
  tax_label: string;
  tax_rate: string;
  gstin: string | null;
  currency_symbol: string;
  printer_width_mode: PrinterWidthMode;
  outlet_name: string;
  outlet_code: string;
  outlet_address: string;
  outlet_phone: string;
}

export interface OrderReceiptPayload {
  order: Order;
  cashier_name: string;
  is_duplicate: boolean;
  receipt_settings: ReceiptSettings;
}

export interface TodayOrdersSummary {
  bill_date: string;
  total_orders: number;
  total_revenue: string;
  cash_total: string;
  upi_total: string;
  card_total: string;
  split_total: string;
  orders: Order[];
}
