"use client";

import { Loader2, Plus, Trash2, Utensils } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInventoryItems } from "@/hooks/use-inventory";
import { useProductRecipe, useUpdateProductRecipe } from "@/hooks/use-menu";
import type { Product } from "@/types/menu";

interface RecipeRowDraft {
  ingredient_name: string;
  quantity_required: string;
  unit: string;
  isCustom?: boolean;
}

const RECIPE_UNITS = ["pcs", "g", "kg", "ml", "liter", "pack", "box"];

export function RecipeEditorDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}) {
  const recipeQuery = useProductRecipe(open && product ? product.id : null);
  const inventoryQuery = useInventoryItems({ page_size: 200 });
  const saveMutation = useUpdateProductRecipe();

  const [rows, setRows] = useState<RecipeRowDraft[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inventoryOptions = useMemo(() => {
    const seen = new Map<string, { name: string; unit: string }>();
    for (const item of inventoryQuery.data?.items ?? []) {
      const key = item.item_name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, { name: item.item_name.trim(), unit: item.unit });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [inventoryQuery.data]);

  const inventoryNameSet = useMemo(
    () => new Set(inventoryOptions.map((opt) => opt.name.toLowerCase())),
    [inventoryOptions]
  );

  useEffect(() => {
    const sourceRows = recipeQuery.data ?? (open && product?.recipes ? product.recipes : null);
    if (sourceRows) {
      setRows(
        sourceRows.map((r) => {
          const name = r.ingredient_name.trim();
          const inInv = inventoryNameSet.has(name.toLowerCase());
          return {
            ingredient_name: name,
            quantity_required: String(r.quantity_required),
            unit: r.unit,
            isCustom: name.length > 0 && inventoryOptions.length > 0 && !inInv,
          };
        })
      );
    } else {
      setRows([]);
    }
    setErrorMsg(null);
  }, [recipeQuery.data, open, product, inventoryNameSet, inventoryOptions.length]);

  const addRow = () => {
    const first = inventoryOptions[0];
    setRows((prev) => [
      ...prev,
      {
        ingredient_name: first ? first.name : "",
        quantity_required: "1",
        unit: first ? first.unit : "pcs",
        isCustom: !first,
      },
    ]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, patch: Partial<RecipeRowDraft>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handleInventorySelect = (idx: number, selectedValue: string) => {
    if (selectedValue === "__custom__") {
      updateRow(idx, { ingredient_name: "", isCustom: true });
      return;
    }
    const matched = inventoryOptions.find((opt) => opt.name === selectedValue);
    updateRow(idx, {
      ingredient_name: selectedValue,
      unit: matched?.unit ?? rows[idx]?.unit ?? "pcs",
      isCustom: false,
    });
  };

  const handleSave = () => {
    if (!product) return;
    setErrorMsg(null);
    const cleaned: { ingredient_name: string; quantity_required: number; unit: string }[] = [];
    for (const row of rows) {
      const name = row.ingredient_name.trim();
      const qty = Number.parseFloat(row.quantity_required);
      if (!name) continue;
      if (Number.isNaN(qty) || qty <= 0) {
        setErrorMsg(`Quantity for "${name}" must be greater than 0.`);
        return;
      }
      cleaned.push({ ingredient_name: name, quantity_required: qty, unit: row.unit });
    }

    saveMutation.mutate(
      { productId: product.id, items: cleaned },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setErrorMsg(err.detail),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-orange-600" />
            Recipe / BOM — {product?.name}
          </DialogTitle>
          <DialogDescription>
            Choose ingredients from your Inventory list (or enter a custom name). Whenever this item is sold on POS, matching outlet stock deducts automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {errorMsg && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          {recipeQuery.isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-stone-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading recipe ingredients...
            </div>
          ) : (
            <>
              {rows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-stone-300 py-8 text-center text-sm text-stone-500">
                  No ingredients configured yet. Add ingredients below to enable automatic stock deduction.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {rows.map((row, idx) => {
                    const matchedOpt = inventoryOptions.find(
                      (opt) => opt.name.toLowerCase() === row.ingredient_name.trim().toLowerCase()
                    );
                    const selectValue = row.isCustom
                      ? "__custom__"
                      : matchedOpt
                      ? matchedOpt.name
                      : "__custom__";

                    return (
                      <div key={idx} className="grid grid-cols-12 items-start gap-2">
                        <div className="col-span-6 space-y-1.5">
                          {inventoryOptions.length > 0 ? (
                            <Select
                              value={selectValue}
                              onValueChange={(val) => handleInventorySelect(idx, val)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choose ingredient from inventory" />
                              </SelectTrigger>
                              <SelectContent>
                                {inventoryOptions.map((opt) => (
                                  <SelectItem key={opt.name} value={opt.name}>
                                    {opt.name} ({opt.unit})
                                  </SelectItem>
                                ))}
                                <SelectItem value="__custom__">+ Custom ingredient...</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : null}

                          {(row.isCustom || inventoryOptions.length === 0 || !matchedOpt) && (
                            <Input
                              placeholder="Ingredient (e.g. Burger Bun)"
                              value={row.ingredient_name}
                              onChange={(e) =>
                                updateRow(idx, { ingredient_name: e.target.value, isCustom: true })
                              }
                            />
                          )}
                        </div>

                        <Input
                          className="col-span-3"
                          type="number"
                          step="0.001"
                          min="0.001"
                          placeholder="Qty"
                          value={row.quantity_required}
                          onChange={(e) => updateRow(idx, { quantity_required: e.target.value })}
                        />

                        <div className="col-span-2">
                          <Select value={row.unit} onValueChange={(v) => updateRow(idx, { unit: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {RECIPE_UNITS.map((u) => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="col-span-1 text-red-600 hover:bg-red-50"
                          onClick={() => removeRow(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-full">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Ingredient
              </Button>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Recipe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
