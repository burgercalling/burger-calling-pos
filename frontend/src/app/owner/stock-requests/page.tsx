"use client";

import { Loader2, Plus, Printer } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PrintReportFooter, PrintReportHeader } from "@/components/print/print-report-chrome";
import { printBusinessReport } from "@/lib/print";
import { NewStockRequestDialog } from "@/components/stock-requests/new-stock-request-dialog";
import { StockRequestStatusStepper } from "@/components/stock-requests/status-stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStockRequests } from "@/hooks/use-stock-requests";

export default function OwnerStockRequestsPage() {
  const [newOpen, setNewOpen] = useState(false);
  const requestsQuery = useStockRequests();
  const requests = requestsQuery.data?.items ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <PrintReportHeader reportName="Outlet Stock Requests Report" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight text-stone-900">Outlet Stock Requests</h1><p className="text-sm text-stone-500">Request supplies and track real-time dispatch &amp; delivery status.</p></div>
          <div className="no-print flex gap-2"><Button type="button" variant="outline" onClick={() => printBusinessReport()}><Printer className="mr-2 h-4 w-4" />Print</Button><Button onClick={() => setNewOpen(true)} className="bg-orange-600 hover:bg-orange-700"><Plus className="mr-2 h-4 w-4" />New Stock Request</Button></div>
        </div>
        {requestsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16 text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading requests...</div>
        ) : requests.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-sm text-stone-500">No stock requests submitted yet.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {requests.map((sr) => (
              <Card key={sr.id} className="border-stone-200">
                <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><CardTitle className="font-mono text-base">{sr.request_number}</CardTitle><p className="text-xs text-stone-500">Submitted {new Date(sr.created_at).toLocaleString("en-IN")}</p></div>
                  <StockRequestStatusStepper status={sr.status} />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="divide-y divide-stone-100 rounded-lg border border-stone-200 text-sm">
                    {sr.items.map((item) => <div key={item.id} className="flex items-center justify-between px-3 py-2"><span className="font-medium text-stone-800">{item.item_name_snapshot}</span><span className="font-mono text-xs text-stone-600">Req: {item.requested_qty} {item.unit_snapshot}{item.approved_qty !== null && ` · Appr: ${item.approved_qty} ${item.unit_snapshot}`}</span></div>)}
                  </div>
                  {sr.admin_notes && <p className="rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-700"><strong>Admin Note:</strong> {sr.admin_notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <NewStockRequestDialog open={newOpen} onOpenChange={setNewOpen} />
        <PrintReportFooter />
      </div>
    </AppShell>
  );
}
