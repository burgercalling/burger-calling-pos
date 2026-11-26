"use client";

import { AlertTriangle, ArrowRight, Loader2, Package, ReceiptText } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOutletDashboard } from "@/hooks/use-analytics";
import { formatINR } from "@/types/menu";

export default function OwnerDashboardPage() {
  const { data, isLoading } = useOutletDashboard();

  return (
    <AppShell>
      {isLoading || !data ? (
        <div className="flex items-center justify-center py-24 text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading outlet dashboard...</div>
      ) : (
        <div className="mx-auto max-w-7xl space-y-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><h1 className="text-2xl font-bold tracking-tight text-stone-900">Outlet Dashboard</h1><p className="text-sm text-stone-500">Live sales for {data.bill_date}</p></div>
            <div className="flex gap-2">
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
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="h-4 w-4 text-orange-600" />Recent 10 Orders</CardTitle><Button asChild size="sm" variant="ghost"><Link href="/owner/reports">Full Reports <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button></CardHeader>
              <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Bill #</TableHead><TableHead>Type</TableHead><TableHead>Payment</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{data.recent_orders.map((o) => <TableRow key={o.id}><TableCell className="font-mono text-xs">{o.bill_number}</TableCell><TableCell className="text-xs uppercase">{o.order_type.replace("_", " ")}</TableCell><TableCell><Badge variant="outline" className="uppercase">{o.payment_mode}</Badge></TableCell><TableCell className="text-right font-semibold">{formatINR(o.grand_total)}</TableCell></TableRow>)}</TableBody></Table></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-600" />Low Stock Supplies</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">{data.low_stock_alerts.length === 0 ? <p className="text-sm text-stone-500">All supplies are healthy.</p> : data.low_stock_alerts.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm"><span className="flex items-center gap-1.5 font-medium"><Package className="h-3.5 w-3.5 text-amber-700" />{item.item_name}</span><span className="font-mono text-xs font-bold text-amber-900">{item.current_stock} / {item.reorder_level} {item.unit}</span></div>)}</CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
