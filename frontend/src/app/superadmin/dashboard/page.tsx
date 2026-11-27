"use client";

import { Activity, AlertTriangle, Printer, Building2, Flame, PackageCheck, TrendingUp } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PrintReportFooter, PrintReportHeader } from "@/components/print/print-report-chrome";
import { printBusinessReport } from "@/lib/print";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMasterDashboard } from "@/hooks/use-analytics";
import { formatINR } from "@/types/menu";
import { ORDER_SOURCE_LABELS } from "@/types/pos";

export default function SuperAdminDashboardPage() {
  const { data, isLoading } = useMasterDashboard();

  return (
    <AppShell>
      {isLoading || !data ? (
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          <Skeleton className="h-10 w-80" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          <PrintReportHeader reportName="Master Network Daily Closing & Dashboard Report" subtitle={`Date: ${data.bill_date}`} />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                Burger Calling — Master Network Dashboard
              </h1>
              <p className="text-sm text-stone-500">Real-time multi-franchise telemetry for {data.bill_date}</p>
            </div>
            <div className="no-print flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => printBusinessReport()}><Printer className="mr-2 h-4 w-4" />Print Summary</Button>
              <Button asChild variant="outline"><Link href="/superadmin/menu">Manage Menu</Link></Button>
              <Button asChild variant="outline"><Link href="/superadmin/stock-requests">Stock Queue</Link></Button>
              <Button asChild className="bg-orange-600 hover:bg-orange-700"><Link href="/superadmin/reports">All Reports</Link></Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-stone-500">Network Today&apos;s Sales</CardTitle></CardHeader><CardContent className="flex items-center justify-between"><p className="text-2xl font-bold">{formatINR(data.network_today_sales)}</p><TrendingUp className="h-5 w-5 text-emerald-600" /></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-stone-500">Active Outlets</CardTitle></CardHeader><CardContent className="flex items-center justify-between"><p className="text-2xl font-bold">{data.active_outlets_count}</p><Building2 className="h-5 w-5 text-orange-600" /></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-stone-500">Pending Stock Requests</CardTitle></CardHeader><CardContent className="flex items-center justify-between"><p className="text-2xl font-bold">{data.pending_stock_requests_count}</p><PackageCheck className="h-5 w-5 text-blue-600" /></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-stone-500">Network Low Stock Alerts</CardTitle></CardHeader><CardContent className="flex items-center justify-between"><p className="text-2xl font-bold text-amber-700">{data.low_stock_alerts_count}</p><AlertTriangle className="h-5 w-5 text-amber-600" /></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Outlet Revenue Leaderboard (Today)</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Outlet</TableHead><TableHead>City</TableHead><TableHead>Orders</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.outlet_leaderboard.map((row) => (
                      <TableRow key={row.franchise_id}>
                        <TableCell className="font-medium"><Badge variant="outline" className="mr-2">{row.outlet_code}</Badge>{row.outlet_name}</TableCell>
                        <TableCell>{row.city}</TableCell>
                        <TableCell>{row.today_orders}</TableCell>
                        <TableCell className="text-right font-bold">{formatINR(row.today_revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Recent Network Orders</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Bill #</TableHead><TableHead>Outlet</TableHead><TableHead>Source</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.recent_orders.map((o) => {
                      const src = o.order_source || o.order_type;
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-xs">{o.bill_number}</TableCell>
                          <TableCell>{o.outlet_code}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {ORDER_SOURCE_LABELS[src] ?? src}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs uppercase">{o.payment_mode}</TableCell>
                          <TableCell className="text-right font-semibold">{formatINR(o.grand_total)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Flame className="h-4 w-4 text-orange-600" />Best Selling Products (Network · 7 Days)</CardTitle></CardHeader>
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
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-blue-600" />Recent Network Activity</CardTitle></CardHeader>
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
          <PrintReportFooter />
        </div>
      )}
    </AppShell>
  );
}
