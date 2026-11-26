"use client";

import { History, Loader2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useInventoryTransactions } from "@/hooks/use-inventory";
import type { InventoryChangeType, InventoryItem } from "@/types/inventory";

const CHANGE_TYPE_LABELS: Record<InventoryChangeType, string> = {
  opening_stock: "Opening Stock",
  manual_adjust: "Manual Adjust",
  request_delivered: "Stock Delivered",
  wastage: "Wastage",
};

export function MovementLedgerDrawer({ item, onOpenChange }: { item: InventoryItem | null; onOpenChange: (open: boolean) => void }) {
  const [changeType, setChangeType] = useState<string>("all");
  const txQuery = useInventoryTransactions({
    inventory_item_id: item?.id,
    change_type: changeType !== "all" ? (changeType as InventoryChangeType) : undefined,
    page: 1, page_size: 50, enabled: Boolean(item),
  });
  const transactions = txQuery.data?.items ?? [];

  return (
    <Sheet open={Boolean(item)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><History className="h-5 w-5 text-orange-600" />Movement History: {item?.item_name}</SheetTitle>
          <SheetDescription>Current balance: <strong>{item?.current_stock} {item?.unit}</strong></SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <Select value={changeType} onValueChange={setChangeType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Movement Types</SelectItem>
              <SelectItem value="opening_stock">Opening Stock</SelectItem>
              <SelectItem value="manual_adjust">Manual Adjust</SelectItem>
              <SelectItem value="request_delivered">Stock Delivered</SelectItem>
              <SelectItem value="wastage">Wastage</SelectItem>
            </SelectContent>
          </Select>
          {txQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading ledger...</div>
          ) : transactions.length === 0 ? (
            <div className="rounded-lg border border-stone-200 py-10 text-center text-sm text-stone-500">No stock movements recorded yet.</div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const isPositive = Number.parseFloat(tx.quantity_delta) >= 0;
                return (
                  <div key={tx.id} className="rounded-lg border border-stone-200 bg-white p-3.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline">{CHANGE_TYPE_LABELS[tx.change_type]}</Badge>
                      <span className={`font-mono text-sm font-bold ${isPositive ? "text-emerald-700" : "text-red-600"}`}>
                        {isPositive ? `+${tx.quantity_delta}` : tx.quantity_delta} {item?.unit}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-stone-800">{tx.remarks}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
                      <span>By {tx.performed_by?.full_name ?? "System"} · Balance: <strong>{tx.balance_after} {item?.unit}</strong></span>
                      <span>{new Date(tx.created_at).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
