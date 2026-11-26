"use client";

import { AlertTriangle, Building2, Loader2, PackageCheck, TrendingUp } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMasterDashboard } from "@/hooks/use-analytics";
import { formatINR } from "@/types/menu";

export default function SuperAdminDashboardPage() {
  const { data, isLoading } = useMasterDashboard();

  return (
    <AppShell>
      {isLoading || !data ? (
        <div className="flex items-center justify-center py-24 text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading network command center...</div>
      ) : (
        <div className="mx-auto max-w-7xl space-y-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><h1 className="text-2xl font-bold tracking-tight text-stone-900">Burger Calling — Master Network Dashboard</h1><p className="text-sm text-stone-500">Real-time multi-franchise telemetry for {data.bill_date}</p></div>
            <div className="flex gap-2">
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
            <Card><CardHeader><CardTitle className="text-base">Outlet Revenue Leaderboard (Today)</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Outlet</TableHead><TableHead>City</TableHead><TableHead>Orders</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader><TableBody>{data.outlet_leaderboard.map((row) => <TableRow key={row.franchise_id}><TableCell className="font-medium"><Badge variant="outline" className="mr-2">{row.outlet_code}</Badge>{row.outlet_name}</TableCell><TableCell>{row.city}</TableCell><TableCell>{row.today_orders}</TableCell><TableCell className="text-right font-bold">{formatINR(row.today_revenue)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Recent Network Orders</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Bill #</TableHead><TableHead>Outlet</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{data.recent_orders.map((o) => <TableRow key={o.id}><TableCell className="font-mono text-xs">{o.bill_number}</TableCell><TableCell>{o.outlet_code}</TableCell><TableCell className="text-xs uppercase">{o.payment_mode}</TableCell><TableCell className="text-right font-semibold">{formatINR(o.grand_total)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
