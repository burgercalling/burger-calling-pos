"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreateInventoryItem } from "@/hooks/use-inventory";
import type { Franchise } from "@/types/franchise";
import type { InventoryUnit } from "@/types/inventory";

const createItemSchema = z.object({
  broadcast_all_active: z.boolean(),
  franchise_id: z.string().optional(),
  item_name: z.string().trim().min(2).max(150),
  unit: z.enum(["pcs", "pack", "kg", "liter", "box"]),
  opening_stock: z.coerce.number().min(0),
  reorder_level: z.coerce.number().min(0),
});

type FormValues = z.infer<typeof createItemSchema>;

export function CreateInventoryItemDialog({ open, onOpenChange, franchises }: { open: boolean; onOpenChange: (open: boolean) => void; franchises: Franchise[] }) {
  const createMutation = useCreateInventoryItem();
  const { register, handleSubmit, setValue, watch, reset } = useForm<FormValues>({
    resolver: zodResolver(createItemSchema),
    defaultValues: { broadcast_all_active: false, franchise_id: franchises[0]?.id ?? "", item_name: "", unit: "pcs", opening_stock: 0, reorder_level: 20 },
  });
  const broadcastAll = watch("broadcast_all_active");

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(
      { broadcast_all_active: values.broadcast_all_active, franchise_id: values.broadcast_all_active ? null : values.franchise_id, item_name: values.item_name, unit: values.unit, opening_stock: values.opening_stock, reorder_level: values.reorder_level },
      { onSuccess: () => { reset(); onOpenChange(false); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Supply / Inventory Item</DialogTitle>
          <DialogDescription>Seed supply tracking for one outlet or broadcast across all active outlets.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {createMutation.isError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createMutation.error.detail}</div>}
          <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5">
            <div><Label className="text-sm font-medium">Broadcast to All Active Outlets</Label><p className="text-xs text-stone-500">Creates this supply item for every active franchise</p></div>
            <Switch checked={broadcastAll} onCheckedChange={(checked) => setValue("broadcast_all_active", checked)} />
          </div>
          {!broadcastAll && (
            <div className="space-y-1.5">
              <Label>Target Outlet</Label>
              <Select value={watch("franchise_id")} onValueChange={(val) => setValue("franchise_id", val)}>
                <SelectTrigger><SelectValue placeholder="Select outlet" /></SelectTrigger>
                <SelectContent>{franchises.map((f) => <SelectItem key={f.id} value={f.id}>[{f.outlet_code}] {f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="inv-item-name">Supply Item Name</Label><Input id="inv-item-name" {...register("item_name")} /></div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={watch("unit")} onValueChange={(val) => setValue("unit", val as InventoryUnit)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcs">pcs</SelectItem><SelectItem value="pack">pack</SelectItem>
                  <SelectItem value="kg">kg</SelectItem><SelectItem value="liter">liter</SelectItem><SelectItem value="box">box</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label htmlFor="opening-stock">Opening Stock</Label><Input id="opening-stock" type="number" step="0.01" min="0" {...register("opening_stock")} /></div>
            <div className="space-y-1.5"><Label htmlFor="reorder-level">Reorder Warning Level</Label><Input id="reorder-level" type="number" step="0.01" min="0" {...register("reorder_level")} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Supply Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
