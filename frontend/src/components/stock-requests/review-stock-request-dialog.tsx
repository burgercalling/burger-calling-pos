"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useReviewStockRequest } from "@/hooks/use-stock-requests";
import type { StockRequest } from "@/types/stock-request";

export function ReviewStockRequestDialog({ stockRequest, onOpenChange }: { stockRequest: StockRequest | null; onOpenChange: (open: boolean) => void }) {
  const reviewMutation = useReviewStockRequest();
  const [approvedMap, setApprovedMap] = useState<Record<string, string>>({});
  const [adminNotes, setAdminNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (stockRequest) {
      const initial: Record<string, string> = {};
      for (const item of stockRequest.items) initial[item.id] = item.requested_qty;
      setApprovedMap(initial);
      setAdminNotes("");
      setLocalError(null);
    }
  }, [stockRequest]);

  const submitDecision = (decision: "approved" | "rejected") => {
    if (!stockRequest) return;
    setLocalError(null);
    if (decision === "rejected" && adminNotes.trim().length < 3) {
      setLocalError("Please enter admin notes explaining the rejection.");
      return;
    }
    reviewMutation.mutate(
      {
        id: stockRequest.id, decision, admin_notes: adminNotes.trim() || undefined,
        items: decision === "approved" ? stockRequest.items.map((item) => ({ item_id: item.id, approved_qty: Number.parseFloat(approvedMap[item.id] ?? "0") || 0 })) : undefined,
      },
      { onSuccess: () => onOpenChange(false), onError: (err) => setLocalError(err.detail) }
    );
  };

  return (
    <Dialog open={Boolean(stockRequest)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Review Request: {stockRequest?.request_number}</DialogTitle>
          <DialogDescription>{stockRequest?.franchise?.outlet_code} · {stockRequest?.franchise?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {localError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{localError}</div>}
          <div className="divide-y divide-stone-100 rounded-lg border border-stone-200">
            {stockRequest?.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                <div><p className="text-sm font-medium text-stone-900">{item.item_name_snapshot}</p><p className="text-xs text-stone-500">Requested: {item.requested_qty} {item.unit_snapshot}</p></div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-stone-500">Approve Qty</Label>
                  <Input type="number" min="0" step="0.01" value={approvedMap[item.id] ?? ""} onChange={(e) => setApprovedMap((p) => ({ ...p, [item.id]: e.target.value }))} className="h-8 w-24" />
                  <span className="w-10 text-xs text-stone-500">{item.unit_snapshot}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5"><Label htmlFor="admin-notes">Admin Notes (Required for Rejection)</Label><Textarea id="admin-notes" rows={2} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="destructive" disabled={reviewMutation.isPending} onClick={() => submitDecision("rejected")}>Reject Request</Button>
          <Button type="button" disabled={reviewMutation.isPending} onClick={() => submitDecision("approved")} className="bg-emerald-600 hover:bg-emerald-700">
            {reviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
