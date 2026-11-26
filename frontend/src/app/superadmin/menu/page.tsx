"use client";

import { Loader2, Pencil, Plus, Search, Trash2, UtensilsCrossed } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { CategoryManager } from "@/components/menu/category-manager";
import { ProductFormDialog } from "@/components/menu/product-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCategories, useDeleteProduct, useProducts, useToggleProductAvailability } from "@/hooks/use-menu";
import { resolveMediaUrl } from "@/lib/api";
import { formatINR, type Product, type ProductItemType } from "@/types/menu";

const ITEM_TYPE_LABELS: Record<ProductItemType, string> = { regular: "Regular", combo: "Combo", addon: "Add-on" };
const ITEM_TYPE_STYLES: Record<ProductItemType, string> = {
  regular: "bg-stone-100 text-stone-800 hover:bg-stone-100",
  combo: "bg-amber-100 text-amber-900 hover:bg-amber-100",
  addon: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
};

export default function MenuManagementPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [itemType, setItemType] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const categoriesQuery = useCategories(false);
  const productsQuery = useProducts({
    category_id: categoryId !== "all" ? categoryId : undefined,
    item_type: itemType !== "all" ? (itemType as ProductItemType) : undefined,
    search: search || undefined,
    page: 1, page_size: 100,
  });
  const toggleAvailability = useToggleProductAvailability();
  const deleteProduct = useDeleteProduct();

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data?.items ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight text-stone-900">Menu &amp; Catalog Management</h1><p className="text-sm text-stone-500">100% Pure Veg catalog: manage categories, combos, add-ons, and live availability.</p></div>
          <Button onClick={() => { setEditingProduct(null); setDialogOpen(true); }} disabled={categories.length === 0} className="bg-orange-600 hover:bg-orange-700"><Plus className="mr-2 h-4 w-4" />Add Product</Button>
        </div>
        <CategoryManager />
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative max-w-sm flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products or SKU..." className="pl-9" /></div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Categories</SelectItem>{categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="regular">Regular</SelectItem><SelectItem value="combo">Combo</SelectItem><SelectItem value="addon">Add-on</SelectItem></SelectContent>
            </Select>
          </div>
          {productsQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading menu items...</div>
          ) : products.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-stone-500">No menu items match the selected filters.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <Card key={product.id} className="flex flex-col justify-between overflow-hidden border-stone-200">
                  <div>
                    <div className="relative h-40 w-full bg-stone-100">
                      {product.image_url ? <img src={resolveMediaUrl(product.image_url) ?? ""} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-stone-400"><UtensilsCrossed className="h-8 w-8" /></div>}
                      <Badge className={`absolute left-2.5 top-2.5 ${ITEM_TYPE_STYLES[product.item_type]}`}>{ITEM_TYPE_LABELS[product.item_type]}</Badge>
                    </div>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div><h3 className="font-semibold leading-snug text-stone-900">{product.name}</h3><p className="text-xs text-stone-500">{product.category?.name ?? "Uncategorized"}{product.sku ? ` · ${product.sku}` : ""}</p></div>
                        <span className="shrink-0 font-bold text-orange-700">{formatINR(product.price)}</span>
                      </div>
                      {product.description && <p className="line-clamp-2 text-xs text-stone-500">{product.description}</p>}
                    </CardContent>
                  </div>
                  <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={product.is_available} disabled={toggleAvailability.isPending} onCheckedChange={(checked) => toggleAvailability.mutate({ id: product.id, is_available: checked })} />
                      <span className={`text-xs font-medium ${product.is_available ? "text-emerald-700" : "text-red-600"}`}>{product.is_available ? "Available" : "Unavailable"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="icon" variant="ghost" onClick={() => { setEditingProduct(product); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="text-red-600 hover:bg-red-50" disabled={deleteProduct.isPending} onClick={() => deleteProduct.mutate(product.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
        <ProductFormDialog open={dialogOpen} onOpenChange={setDialogOpen} categories={categories} product={editingProduct} />
      </div>
    </AppShell>
  );
}
