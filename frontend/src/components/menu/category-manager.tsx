"use client";

import { ArrowUpDown, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from "@/hooks/use-menu";

export function CategoryManager() {
  const [newName, setNewName] = useState("");
  const [newOrder, setNewOrder] = useState("0");
  const [actionError, setActionError] = useState<string | null>(null);
  const categoriesQuery = useCategories(false);
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const categories = categoriesQuery.data ?? [];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!newName.trim()) return;
    createMutation.mutate(
      { name: newName.trim(), display_order: Number.parseInt(newOrder, 10) || 0 },
      { onSuccess: () => { setNewName(""); setNewOrder(String((categories.length + 1) * 10)); }, onError: (err) => setActionError(err.detail) }
    );
  };

  return (
    <Card className="border-stone-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><ArrowUpDown className="h-4 w-4 text-orange-600" />Menu Categories &amp; Sort Order</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category name (e.g. Classic Burgers)" className="min-w-[220px] flex-1" />
          <Input type="number" min={0} value={newOrder} onChange={(e) => setNewOrder(e.target.value)} placeholder="Order" className="w-24" />
          <Button type="submit" disabled={createMutation.isPending || !newName.trim()} className="bg-orange-600 hover:bg-orange-700">
            {createMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Add Category
          </Button>
        </form>
        {actionError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{actionError}</div>}
        {categoriesQuery.isLoading ? (
          <div className="py-6 text-center text-sm text-stone-500">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="py-6 text-center text-sm text-stone-500">No categories created yet.</div>
        ) : (
          <div className="divide-y divide-stone-100 rounded-lg border border-stone-200">
            {categories.map((cat) => (
              <div key={cat.id} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
                <span className="font-medium text-stone-900">{cat.name}</span>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-stone-500">Order</label>
                  <Input
                    type="number"
                    min={0}
                    defaultValue={cat.display_order}
                    className="h-8 w-20 text-center"
                    onBlur={(e) => {
                      const nextOrder = Number.parseInt(e.target.value, 10);
                      if (!Number.isNaN(nextOrder) && nextOrder !== cat.display_order) {
                        setActionError(null);
                        updateMutation.mutate({ id: cat.id, payload: { display_order: nextOrder } }, { onError: (err) => setActionError(err.detail) });
                      }
                    }}
                  />
                  <Button type="button" size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" disabled={deleteMutation.isPending} onClick={() => { setActionError(null); deleteMutation.mutate({ id: cat.id }, { onError: (err) => setActionError(err.detail) }); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
