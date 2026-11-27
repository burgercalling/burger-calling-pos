"use client";

import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getReportCsvUrl,
  getReportXlsxUrl,
  useDailySalesReport,
  useInventoryReport,
  useMonthlySalesReport,
  useOrderSourceSalesReport,
  usePaymentSalesReport,
  useProductSalesReport,
  useSlowMovingProductsReport,
  useStockRequestReport,
} from "@/hooks/use-analytics";
import { useFranchises } from "@/hooks/use-franchises";
import { formatINR } from "@/types/menu";
import { ORDER_SOURCE_LABELS } from "@/types/pos";

type ReportTab =
  | "daily-sales"
  | "monthly-sales"
  | "order-source-sales"
  | "product-sales"
  | "slow-moving-products"
  | "payment-sales"
  | "inventory"
  | "stock-requests";

const TABS: { key: ReportTab; label: string }[] = [
  { key: "daily-sales", label: "Daily Sales" },
  { key: "monthly-sales", label: "Monthly Sales" },
  { key: "order-source-sales", label: "Order Sources" },
  { key: "product-sales", label: "Best Selling" },
  { key: "slow-moving-products", label: "Slow Moving" },
  { key: "payment-sales", label: "Payment Mix" },
  { key: "inventory", label: "Inventory" },
  { key: "stock-requests", label: "Stock Requests" },
];

export function ReportsExplorerView({ mode }: { mode: "superadmin" | "owner" }) {
  const isSuperAdmin = mode === "superadmin";
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);

  const [activeTab, setActiveTab] = useState<ReportTab>("daily-sales");
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [franchiseId, setFranchiseId] = useState<string>("all");

  const franchisesQuery = useFranchises({ is_active: true, page_size: 100 });
  const filterParams = {
    start_date: startDate,
    end_date: endDate,
    franchise_id: isSuperAdmin && franchiseId !== "all" ? franchiseId : undefined,
  };

  const dailyQuery = useDailySalesReport(filterParams, activeTab === "daily-sales");
  const monthlyQuery = useMonthlySalesReport(filterParams, activeTab === "monthly-sales");
  const orderSourceQuery = useOrderSourceSalesReport(filterParams, activeTab === "order-source-sales");
  const productQuery = useProductSalesReport(filterParams, activeTab === "product-sales");
  const slowQuery = useSlowMovingProductsReport(filterParams, activeTab === "slow-moving-products");
  const paymentQuery = usePaymentSalesReport(filterParams, activeTab === "payment-sales");
  const inventoryQuery = useInventoryReport(filterParams, activeTab === "inventory");
  const stockReqQuery = useStockRequestReport(filterParams, activeTab === "stock-requests");

  const maxDailyNet = useMemo(
    () => Math.max(1, ...(dailyQuery.data ?? []).map((r) => Number.parseFloat(r.net_sales) || 0)),
    [dailyQuery.data]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Analytics &amp; Financial Reports
          </h1>
          <p className="text-sm text-stone-500">
            Live PostgreSQL aggregations with Order Source breakdown, Excel (.xlsx), CSV, and print/PDF export.
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print / PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.open(getReportXlsxUrl(activeTab, filterParams), "_blank", "noopener")}
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-700" />
            Export Excel
          </Button>
          <Button
            type="button"
            onClick={() => window.open(getReportCsvUrl(activeTab, filterParams), "_blank", "noopener")}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-3.5 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-stone-500">From</span>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-stone-500">To</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        {isSuperAdmin && (
          <Select value={franchiseId} onValueChange={setFranchiseId}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="All Outlets" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outlets</SelectItem>
              {(franchisesQuery.data?.items ?? []).map((f) => (
                <SelectItem key={f.id} value={f.id}>[{f.outlet_code}] {f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="no-print flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.key}
            type="button"
            size="sm"
            variant={activeTab === t.key ? "default" : "outline"}
            className={activeTab === t.key ? "bg-stone-900 hover:bg-stone-800" : ""}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {activeTab === "daily-sales" && (
        <div className="space-y-4">
          {dailyQuery.data && dailyQuery.data.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Daily Net Sales Trend</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {dailyQuery.data.slice(0, 14).map((row) => {
                  const pct = Math.round(((Number.parseFloat(row.net_sales) || 0) / maxDailyNet) * 100);
                  return (
                    <div key={row.bill_date} className="flex items-center gap-3 text-xs">
                      <span className="w-24 font-mono text-stone-600">{row.bill_date}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-28 text-right font-semibold">{formatINR(row.net_sales)}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="overflow-x-auto p-0">
              {dailyQuery.isLoading ? (
                <div className="space-y-2 p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Orders</TableHead><TableHead>Gross Sales</TableHead><TableHead>Discounts</TableHead><TableHead className="text-right">Net Sales</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(dailyQuery.data ?? []).map((r) => (
                      <TableRow key={r.bill_date}><TableCell className="font-mono">{r.bill_date}</TableCell><TableCell>{r.order_count}</TableCell><TableCell>{formatINR(r.gross_sales)}</TableCell><TableCell>{formatINR(r.discounts)}</TableCell><TableCell className="text-right font-bold">{formatINR(r.net_sales)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "monthly-sales" && (
        <Card><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Orders</TableHead><TableHead>Revenue</TableHead><TableHead className="text-right">MoM Growth</TableHead></TableRow></TableHeader><TableBody>{(monthlyQuery.data ?? []).map((r) => <TableRow key={r.month}><TableCell className="font-mono">{r.month}</TableCell><TableCell>{r.order_count}</TableCell><TableCell className="font-semibold">{formatINR(r.revenue)}</TableCell><TableCell className="text-right">{r.growth_percent !== null ? `${r.growth_percent}%` : "—"}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      )}

      {activeTab === "order-source-sales" && (
        <Card>
          <CardContent className="space-y-4 p-6">
            {orderSourceQuery.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
            ) : (orderSourceQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-stone-500">No orders found in the selected date range.</p>
            ) : (
              (orderSourceQuery.data ?? []).map((r) => (
                <div key={r.order_source} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold uppercase">
                      {ORDER_SOURCE_LABELS[r.order_source] ?? r.order_source} ({r.order_count} orders)
                    </span>
                    <span className="font-bold">{formatINR(r.total_amount)} ({r.share_percent}%)</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-orange-600" style={{ width: `${r.share_percent}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "product-sales" && (
        <Card><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead>Type</TableHead><TableHead>Qty Sold</TableHead><TableHead className="text-right">Total Revenue</TableHead></TableRow></TableHeader><TableBody>{(productQuery.data ?? []).map((r) => <TableRow key={r.product_id}><TableCell className="font-medium">{r.product_name}</TableCell><TableCell>{r.category_name}</TableCell><TableCell><Badge variant="outline" className="uppercase">{r.item_type}</Badge></TableCell><TableCell>{r.qty_sold}</TableCell><TableCell className="text-right font-bold">{formatINR(r.total_revenue)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      )}

      {activeTab === "slow-moving-products" && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            {slowQuery.isLoading ? (
              <div className="space-y-2 p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead>Menu Price</TableHead><TableHead>Qty Sold</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(slowQuery.data ?? []).map((r) => (
                    <TableRow key={r.product_id}>
                      <TableCell className="font-medium">{r.product_name}</TableCell>
                      <TableCell>{r.category_name}</TableCell>
                      <TableCell>{formatINR(r.price)}</TableCell>
                      <TableCell><Badge variant={r.qty_sold === 0 ? "destructive" : "outline"}>{r.qty_sold}</Badge></TableCell>
                      <TableCell className="text-right font-semibold">{formatINR(r.total_revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "payment-sales" && (
        <Card><CardContent className="space-y-4 p-6">{(paymentQuery.data ?? []).map((r) => (<div key={r.payment_mode} className="space-y-1.5"><div className="flex justify-between text-sm"><span className="font-semibold uppercase">{r.payment_mode} ({r.order_count} orders)</span><span className="font-bold">{formatINR(r.total_amount)} ({r.share_percent}%)</span></div><div className="h-3 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${r.share_percent}%` }} /></div></div>))}</CardContent></Card>
      )}

      {activeTab === "inventory" && (
        <Card><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Outlet</TableHead><TableHead>Item</TableHead><TableHead>Current Stock</TableHead><TableHead>Inward</TableHead><TableHead>Outward</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{(inventoryQuery.data ?? []).map((r) => <TableRow key={r.inventory_item_id}><TableCell>{r.outlet_code}</TableCell><TableCell className="font-medium">{r.item_name}</TableCell><TableCell className="font-mono">{r.current_stock} {r.unit}</TableCell><TableCell className="font-mono text-emerald-700">+{r.total_inward}</TableCell><TableCell className="font-mono text-red-600">-{r.total_outward}</TableCell><TableCell><Badge variant={r.is_low_stock ? "destructive" : "outline"}>{r.is_low_stock ? "Low Stock" : "Healthy"}</Badge></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      )}

      {activeTab === "stock-requests" && (
        <Card><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Request #</TableHead><TableHead>Outlet</TableHead><TableHead>Status</TableHead><TableHead>Requested Qty</TableHead><TableHead>Approved Qty</TableHead></TableRow></TableHeader><TableBody>{(stockReqQuery.data ?? []).map((r) => <TableRow key={r.request_number}><TableCell className="font-mono">{r.request_number}</TableCell><TableCell>{r.outlet_code} · {r.outlet_name}</TableCell><TableCell><Badge variant="outline" className="uppercase">{r.status}</Badge></TableCell><TableCell className="font-mono">{r.requested_qty_total}</TableCell><TableCell className="font-mono">{r.approved_qty_total}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      )}
    </div>
  );
}
