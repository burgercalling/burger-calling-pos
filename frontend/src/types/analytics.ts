export interface RecentOrderRow {
  id: string;
  bill_number: string;
  outlet_code: string | null;
  outlet_name: string | null;
  order_type: string;
  order_source: string;
  external_order_number: string | null;
  payment_mode: string;
  grand_total: string;
  created_at: string;
}

export interface LowStockAlertRow {
  id: string;
  franchise_id: string;
  outlet_code: string;
  outlet_name: string;
  item_name: string;
  unit: string;
  current_stock: string;
  reorder_level: string;
}

export interface BestSellingProductRow {
  product_id: string;
  product_name: string;
  qty_sold: number;
  total_revenue: string;
}

export interface RecentActivityRow {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
}

export interface OutletDashboardData {
  bill_date: string;
  today_sales: string;
  today_orders: number;
  avg_order_value: string;
  yesterday_sales: string;
  sales_delta_percent: string;
  recent_orders: RecentOrderRow[];
  low_stock_alerts: LowStockAlertRow[];
  best_selling_products: BestSellingProductRow[];
  recent_activity: RecentActivityRow[];
}

export interface OutletLeaderboardRow {
  franchise_id: string;
  outlet_code: string;
  outlet_name: string;
  city: string;
  today_orders: number;
  today_revenue: string;
}

export interface MasterDashboardData {
  bill_date: string;
  network_today_sales: string;
  network_today_orders: number;
  active_outlets_count: number;
  pending_stock_requests_count: number;
  low_stock_alerts_count: number;
  outlet_leaderboard: OutletLeaderboardRow[];
  network_low_stock_alerts: LowStockAlertRow[];
  recent_orders: RecentOrderRow[];
  best_selling_products: BestSellingProductRow[];
  recent_activity: RecentActivityRow[];
}

export interface DailySalesRow {
  bill_date: string;
  order_count: number;
  gross_sales: string;
  discounts: string;
  net_sales: string;
}

export interface MonthlySalesRow {
  month: string;
  order_count: number;
  revenue: string;
  growth_percent: string | null;
}

export interface ProductSalesRow {
  product_id: string;
  product_name: string;
  category_name: string;
  item_type: string;
  qty_sold: number;
  total_revenue: string;
}

export interface SlowMovingProductRow {
  product_id: string;
  product_name: string;
  category_name: string;
  price: string;
  qty_sold: number;
  total_revenue: string;
}

export interface PaymentSalesRow {
  payment_mode: string;
  order_count: number;
  total_amount: string;
  share_percent: string;
}

export interface OrderSourceSalesRow {
  order_source: string;
  order_count: number;
  total_amount: string;
  share_percent: string;
}

export interface InventoryReportRow {
  inventory_item_id: string;
  outlet_code: string;
  outlet_name: string;
  item_name: string;
  unit: string;
  current_stock: string;
  reorder_level: string;
  is_low_stock: boolean;
  total_inward: string;
  total_outward: string;
}

export interface StockRequestReportRow {
  request_number: string;
  outlet_code: string;
  outlet_name: string;
  status: string;
  requested_qty_total: string;
  approved_qty_total: string;
  created_at: string;
  delivered_at: string | null;
}
