"use client";

import { Activity, AlertTriangle, ArrowRight, Flame, Package, ReceiptText } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOutletDashboard } from "@/hooks/use-analytics";
import { formatINR } from "@/types/menu";
import { ORDER_SOURCE_LABELS } from "@/types/pos";

export default function OwnerDashboardPage() {
  const { data, isLoading } = useOutletDashboard();

  return (
    <AppShell>
      {isLoading || !data ? (
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">Outlet Dashboard</h1>
              <p className="text-sm text-stone-500">Live sales &amp; operations for {data.bill_date}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link href="/owner/inventory">Inventory</Link></Button>
              <Button asChild variant="outline"><Link href="/owner/stock-requests">Request Stock</Link></Button>
              <Button asChild className="bg-orange-600 hover:bg-orange-700"><Link href="/pos">Open Billing POS</Link></Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-stone-500">Today&apos;s Sales</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatINR(data.today_sales)}</p><p className="mt-1 text-xs text-stone-500">{Number.parseFloat(data.sales_delta_percent) >= 0 ? "+" : ""}{data.sales_delta_percent}% vs yesterday ({formatINR(data.yesterday_sales)})</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-stone-500">Today&apos;s Orders</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.today_orders}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-stone-500">Average Order Value</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatINR(data.avg_order_value)}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-stone-500">Low Stock Alerts</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-amber-700">{data.low_stock_alerts.length}</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="h-4 w-4 text-orange-600" />Recent 10 Orders</CardTitle>
                <Button asChild size="sm" variant="ghost"><Link href="/owner/reports">Full Reports <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Bill #</TableHead><TableHead>Source</TableHead><TableHead>Payment</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.recent_orders.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-stone-500">No completed orders yet today.</TableCell></TableRow>
                    ) : (
                      data.recent_orders.map((o) => {
                        const src = o.order_source || o.order_type;
                        return (
                          <TableRow key={o.id}>
                            <TableCell className="font-mono text-xs">
                              {o.bill_number}
                              {o.external_order_number && (
                                <span className="ml-1.5 text-[10px] text-stone-500">({o.external_order_number})</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {ORDER_SOURCE_LABELS[src] ?? src}
                              </Badge>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="uppercase">{o.payment_mode}</Badge></TableCell>
                            <TableCell className="text-right font-semibold">{formatINR(o.grand_total)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-600" />Low Stock Supplies</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                {data.low_stock_alerts.length === 0 ? (
                  <p className="text-sm text-stone-500">All supplies are healthy.</p>
                ) : (
                  data.low_stock_alerts.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm">
                      <span className="flex items-center gap-1.5 font-medium text-stone-900"><Package className="h-3.5 w-3.5 text-amber-700" />{item.item_name}</span>
                      <span className="font-mono text-xs font-bold text-amber-900">{item.current_stock} / {item.reorder_level} {item.unit}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Flame className="h-4 w-4 text-orange-600" />Best Selling Products (7 Days)</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                {(data.best_selling_products ?? []).length === 0 ? (
                  <p className="text-sm text-stone-500">No product sales recorded in the last 7 days.</p>
                ) : (
                  data.best_selling_products.map((prod, idx) => (
                    <div key={prod.product_id} className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 text-sm dark:border-stone-800">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">#{idx + 1}</Badge>
                        <span className="font-medium">{prod.product_name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-orange-700">{formatINR(prod.total_revenue)}</p>
                        <p className="text-[11px] text-stone-500">{prod.qty_sold} sold</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-blue-600" />Recent Activity</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(data.recent_activity ?? []).length === 0 ? (
                  <p className="text-sm text-stone-500">No recent activity logged.</p>
                ) : (
                  data.recent_activity.map((act) => (
                    <div key={act.id} className="flex items-start justify-between gap-2 border-b border-stone-100 pb-2 text-xs last:border-0 dark:border-stone-800">
                      <span className="text-stone-700 dark:text-stone-300">{act.description}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">{act.event_type}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
