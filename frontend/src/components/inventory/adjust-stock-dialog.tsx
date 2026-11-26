"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdjustInventoryStock } from "@/hooks/use-inventory";
import type { InventoryItem } from "@/types/inventory";

const adjustSchema = z.object({
  change_type: z.enum(["manual_adjust", "wastage"]),
  direction: z.enum(["add", "deduct"]),
  quantity: z.coerce.number().positive(),
  remarks: z.string().trim().min(3).max(500),
});

type AdjustFormValues = z.infer<typeof adjustSchema>;

export function AdjustStockDialog({ item, onOpenChange }: { item: InventoryItem | null; onOpenChange: (open: boolean) => void }) {
  const adjustMutation = useAdjustInventoryStock();
  const { register, handleSubmit, setValue, watch, reset } = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { change_type: "manual_adjust", direction: "add", quantity: 1, remarks: "" },
  });

  useEffect(() => {
    if (item) reset({ change_type: "manual_adjust", direction: "add", quantity: 1, remarks: "" });
  }, [item, reset]);

  const changeType = watch("change_type");
  const direction = watch("direction");
  const quantity = watch("quantity") || 0;
  const currentNum = item ? Number.parseFloat(item.current_stock) : 0;
  const projectedBalance = currentNum + (changeType === "wastage" || direction === "deduct" ? -quantity : quantity);

  const onSubmit = (values: AdjustFormValues) => {
    if (!item) return;
    const delta = values.change_type === "wastage" || values.direction === "deduct" ? -Math.abs(values.quantity) : Math.abs(values.quantity);
    adjustMutation.mutate({ itemId: item.id, change_type: values.change_type, quantity_delta: delta, remarks: values.remarks }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock: {item?.item_name}</DialogTitle>
          <DialogDescription>Current Balance: <strong>{item?.current_stock} {item?.unit}</strong></DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {adjustMutation.isError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{adjustMutation.error.detail}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Adjustment Type</Label>
              <Select value={changeType} onValueChange={(val) => { const t = val as "manual_adjust" | "wastage"; setValue("change_type", t); if (t === "wastage") setValue("direction", "deduct"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="manual_adjust">Manual Adjust</SelectItem><SelectItem value="wastage">Wastage / Spoilage</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Action</Label>
              <Select value={changeType === "wastage" ? "deduct" : direction} disabled={changeType === "wastage"} onValueChange={(val) => setValue("direction", val as "add" | "deduct")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="add">+ Add Stock</SelectItem><SelectItem value="deduct">- Deduct Stock</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="adj-qty">Quantity ({item?.unit})</Label><Input id="adj-qty" type="number" step="0.01" min="0.01" {...register("quantity")} /></div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
            Projected Balance: <strong className={projectedBalance < 0 ? "text-red-600" : "text-stone-900"}>{projectedBalance.toFixed(2)} {item?.unit}</strong>
          </div>
          <div className="space-y-1.5"><Label htmlFor="adj-remarks">Remarks (Mandatory)</Label><Textarea id="adj-remarks" rows={2} {...register("remarks")} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={adjustMutation.isPending || projectedBalance < 0} className="bg-orange-600 hover:bg-orange-700">
              {adjustMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply Adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
