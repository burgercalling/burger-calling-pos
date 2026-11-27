"use client";

import { History, Loader2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useInventoryTransactions } from "@/hooks/use-inventory";
import type { InventoryChangeType, InventoryItem } from "@/types/inventory";

const CHANGE_TYPE_LABELS: Record<InventoryChangeType, string> = {
  opening_stock: "Initial Stock",
  manual_adjust: "Manual Adjustment",
  request_delivered: "Stock Request",
  wastage: "Wastage",
  sale_deduction: "Sale (BOM)",
  correction: "Correction",
  return: "Return",
};

export function MovementLedgerDrawer({ item, onOpenChange }: { item: InventoryItem | null; onOpenChange: (open: boolean) => void }) {
  const [changeType, setChangeType] = useState<string>("all");
  const txQuery = useInventoryTransactions({
    inventory_item_id: item?.id,
    change_type: changeType !== "all" ? (changeType as InventoryChangeType) : undefined,
    page: 1,
    page_size: 50,
    enabled: Boolean(item),
  });
  const transactions = txQuery.data?.items ?? [];

  return (
    <Sheet open={Boolean(item)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-orange-600" />
            Movement History: {item?.item_name}
          </SheetTitle>
          <SheetDescription>
            Current balance: <strong>{item?.current_stock} {item?.unit}</strong>
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <Select value={changeType} onValueChange={setChangeType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Movement Types</SelectItem>
              <SelectItem value="request_delivered">Stock Request</SelectItem>
              <SelectItem value="sale_deduction">Sale (BOM)</SelectItem>
              <SelectItem value="manual_adjust">Manual Adjustment</SelectItem>
              <SelectItem value="correction">Correction</SelectItem>
              <SelectItem value="return">Return</SelectItem>
              <SelectItem value="wastage">Wastage</SelectItem>
              <SelectItem value="opening_stock">Initial Stock</SelectItem>
            </SelectContent>
          </Select>

          {txQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-stone-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading ledger...
            </div>
          ) : transactions.length === 0 ? (
            <div className="rounded-lg border border-stone-200 py-10 text-center text-sm text-stone-500">
              No stock movements recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const isPositive = Number.parseFloat(tx.quantity_delta) >= 0;
                return (
                  <div key={tx.id} className="rounded-lg border border-stone-200 bg-white p-3.5 shadow-xs dark:border-stone-800 dark:bg-stone-900">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{CHANGE_TYPE_LABELS[tx.change_type] ?? tx.change_type}</Badge>
                        {tx.reference_type && (
                          <span className="font-mono text-[10px] text-stone-400">
                            {tx.reference_type}
                          </span>
                        )}
                      </div>
                      <span className={`font-mono text-sm font-bold ${isPositive ? "text-emerald-700" : "text-red-600"}`}>
                        {isPositive ? `+${tx.quantity_delta}` : tx.quantity_delta} {item?.unit}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-stone-800 dark:text-stone-200">{tx.remarks}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
                      <span>
                        By {tx.performed_by?.full_name ?? "System"} ·{" "}
                        {tx.previous_stock !== null ? `${tx.previous_stock} → ` : ""}
                        <strong>{tx.balance_after} {item?.unit}</strong>
                      </span>
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
