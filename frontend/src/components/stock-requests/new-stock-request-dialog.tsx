"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useInventoryItems } from "@/hooks/use-inventory";
import { useCreateStockRequest } from "@/hooks/use-stock-requests";

export function NewStockRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const inventoryQuery = useInventoryItems({ page_size: 200 });
  const createMutation = useCreateStockRequest();
  const [lines, setLines] = useState([{ inventory_item_id: "", requested_qty: "10" }]);
  const [remarks, setRemarks] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const inventoryItems = inventoryQuery.data?.items ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const parsed = lines.map((l) => ({ inventory_item_id: l.inventory_item_id, requested_qty: Number.parseFloat(l.requested_qty) }));
    if (parsed.some((p) => !p.inventory_item_id || Number.isNaN(p.requested_qty) || p.requested_qty <= 0)) {
      setLocalError("Select a supply item and enter a positive quantity for every row.");
      return;
    }
    if (new Set(parsed.map((p) => p.inventory_item_id)).size !== parsed.length) {
      setLocalError("Duplicate supply items selected.");
      return;
    }
    createMutation.mutate(
      { items: parsed, remarks: remarks.trim() || undefined },
      { onSuccess: () => { setLines([{ inventory_item_id: "", requested_qty: "10" }]); setRemarks(""); onOpenChange(false); }, onError: (err) => setLocalError(err.detail) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New Stock Replenishment Request</DialogTitle>
          <DialogDescription>Request supplies from the central warehouse for your outlet.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {localError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{localError}</div>}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Supply Items</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setLines((p) => [...p, { inventory_item_id: "", requested_qty: "10" }])}><Plus className="mr-1 h-3.5 w-3.5" />Add Row</Button>
            </div>
            {lines.map((line, idx) => {
              const selected = inventoryItems.find((i) => i.id === line.inventory_item_id);
              return (
                <div key={idx} className="flex items-center gap-2">
                  <Select value={line.inventory_item_id} onValueChange={(val) => setLines((p) => p.map((r, i) => (i === idx ? { ...r, inventory_item_id: val } : r)))}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select supply item..." /></SelectTrigger>
                    <SelectContent>{inventoryItems.map((item) => <SelectItem key={item.id} value={item.id}>{item.item_name} (Stock: {item.current_stock} {item.unit})</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" min="0.01" step="0.01" value={line.requested_qty} onChange={(e) => setLines((p) => p.map((r, i) => (i === idx ? { ...r, requested_qty: e.target.value } : r)))} className="w-28" />
                  <span className="w-12 text-xs text-stone-500">{selected?.unit ?? ""}</span>
                  {lines.length > 1 && <Button type="button" size="icon" variant="ghost" className="text-red-600" onClick={() => setLines((p) => p.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              );
            })}
          </div>
          <div className="space-y-1.5"><Label htmlFor="sr-remarks">Outlet Remarks (Optional)</Label><Textarea id="sr-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
