"use client";

import { ArrowRight, CheckCircle2, ClipboardCheck, Loader2, Printer } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PrintReportFooter, PrintReportHeader } from "@/components/print/print-report-chrome";
import { printBusinessReport } from "@/lib/print";
import { ReviewStockRequestDialog } from "@/components/stock-requests/review-stock-request-dialog";
import { StockRequestStatusStepper } from "@/components/stock-requests/status-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdvanceStockRequestStatus, useStockRequests } from "@/hooks/use-stock-requests";
import type { StockRequest, StockRequestStatus } from "@/types/stock-request";

const NEXT_STEP_CONFIG: Partial<Record<StockRequestStatus, { next: StockRequestStatus; label: string }>> = {
  approved: { next: "packed", label: "Mark Packed" },
  packed: { next: "dispatched", label: "Mark Dispatched" },
  dispatched: { next: "delivered", label: "Confirm Delivered (Credit Stock)" },
};

const ALL_STATUSES: { value: StockRequestStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "packed", label: "Packed" },
  { value: "dispatched", label: "Dispatched" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export default function SuperAdminStockRequestsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reviewTarget, setReviewTarget] = useState<StockRequest | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const requestsQuery = useStockRequests({ status: statusFilter !== "all" ? (statusFilter as StockRequestStatus) : undefined });
  const advanceMutation = useAdvanceStockRequestStatus();
  const requests = requestsQuery.data?.items ?? [];

  const handleStatusChange = (id: string, nextStatus: StockRequestStatus) => {
    setActionError(null);
    setActionSuccess(null);
    advanceMutation.mutate(
      { id, next_status: nextStatus },
      {
        onSuccess: (updated) => {
          setActionSuccess(`Request ${updated.request_number} updated to ${updated.status.toUpperCase()}${updated.inventory_applied ? " (Inventory credited)" : ""}.`);
        },
        onError: (err) => setActionError(err.detail),
      }
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <PrintReportHeader reportName="Stock Request Fulfillment Report" filtersSummary={`Status Filter: ${statusFilter.toUpperCase()}`} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
              Franchise Stock Fulfillment Queue
            </h1>
            <p className="text-sm text-stone-500">
              Review, update any status, credit outlet inventory on delivery, or reverse/cancel requests safely.
            </p>
          </div>
          <div className="no-print flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => printBusinessReport()}><Printer className="mr-2 h-4 w-4" />Print Report</Button>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
        </div>

        {actionSuccess && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {actionSuccess}
          </div>
        )}
        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {requestsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16 text-stone-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading queue...
          </div>
        ) : requests.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-sm text-stone-500">No stock requests match the selected filter.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {requests.map((sr) => {
              const nextAction = NEXT_STEP_CONFIG[sr.status];
              return (
                <Card key={sr.id} className="border-stone-200 dark:border-stone-800">
                  <CardHeader className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="font-mono text-base">{sr.request_number}</CardTitle>
                        {sr.franchise && (
                          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                            {sr.franchise.outlet_code} · {sr.franchise.name}
                          </Badge>
                        )}
                        {sr.inventory_applied && (
                          <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            <CheckCircle2 className="h-3 w-3" />
                            Inventory Credited
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-stone-500">
                        Requested by {sr.requested_by?.full_name ?? "Owner"} · {new Date(sr.created_at).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <StockRequestStatusStepper status={sr.status} />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="divide-y divide-stone-100 rounded-lg border border-stone-200 text-sm dark:divide-stone-800 dark:border-stone-800">
                      {sr.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-3.5 py-2">
                          <span className="font-medium text-stone-800 dark:text-stone-200">{item.item_name_snapshot}</span>
                          <span className="font-mono text-xs text-stone-600 dark:text-stone-400">
                            Requested: {item.requested_qty} {item.unit_snapshot}
                            {item.approved_qty !== null && ` · Approved: ${item.approved_qty} ${item.unit_snapshot}`}
                          </span>
                        </div>
                      ))}
                    </div>
                    {sr.remarks && <p className="text-xs text-stone-600"><strong>Outlet Remarks:</strong> {sr.remarks}</p>}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3 dark:border-stone-800">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-stone-500">Change Status:</span>
                        <Select
                          value={sr.status}
                          disabled={advanceMutation.isPending}
                          onValueChange={(val) => handleStatusChange(sr.id, val as StockRequestStatus)}
                        >
                          <SelectTrigger className="h-9 w-44 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {sr.status === "pending" && (
                          <Button type="button" onClick={() => setReviewTarget(sr)} className="bg-orange-600 hover:bg-orange-700">
                            <ClipboardCheck className="mr-1.5 h-4 w-4" />
                            Review &amp; Approve / Reject
                          </Button>
                        )}
                        {nextAction && (
                          <Button
                            type="button"
                            disabled={advanceMutation.isPending}
                            onClick={() => handleStatusChange(sr.id, nextAction.next)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            {advanceMutation.isPending ? (
                              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowRight className="mr-1.5 h-4 w-4" />
                            )}
                            {nextAction.label}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        <ReviewStockRequestDialog stockRequest={reviewTarget} onOpenChange={(open) => { if (!open) setReviewTarget(null); }} />
        <PrintReportFooter />
      </div>
    </AppShell>
  );
}
