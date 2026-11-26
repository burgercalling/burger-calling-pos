"use client";

import { AlertTriangle, History, Loader2, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { AdjustStockDialog } from "@/components/inventory/adjust-stock-dialog";
import { CreateInventoryItemDialog } from "@/components/inventory/create-inventory-item-dialog";
import { MovementLedgerDrawer } from "@/components/inventory/movement-ledger-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFranchises } from "@/hooks/use-franchises";
import { useInventoryItems } from "@/hooks/use-inventory";
import type { InventoryItem } from "@/types/inventory";

export function InventoryDashboardView({ mode }: { mode: "superadmin" | "owner" }) {
  const isSuperAdmin = mode === "superadmin";
  const [search, setSearch] = useState("");
  const [franchiseId, setFranchiseId] = useState<string>("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [ledgerItem, setLedgerItem] = useState<InventoryItem | null>(null);

  const franchisesQuery = useFranchises({ is_active: true, page_size: 100 });
  const inventoryQuery = useInventoryItems({
    franchise_id: isSuperAdmin && franchiseId !== "all" ? franchiseId : undefined,
    low_stock_only: lowStockOnly,
    search: search || undefined,
    page: 1, page_size: 100,
  });

  const items = inventoryQuery.data?.items ?? [];
  const franchises = franchisesQuery.data?.items ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Outlet Supply Inventory</h1>
          <p className="text-sm text-stone-500">Track unit-level supplies, low-stock alerts, and immutable movement ledgers.</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setCreateOpen(true)} className="bg-orange-600 hover:bg-orange-700"><Plus className="mr-2 h-4 w-4" />Add Supply Item</Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search supply item..." className="pl-9" />
        </div>
        {isSuperAdmin && (
          <Select value={franchiseId} onValueChange={setFranchiseId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All Outlets" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outlets</SelectItem>
              {franchises.map((f) => <SelectItem key={f.id} value={f.id}>[{f.outlet_code}] {f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2">
          <Switch checked={lowStockOnly} onCheckedChange={setLowStockOnly} />
          <span className="text-sm font-medium text-stone-700">Low Stock Only</span>
        </div>
      </div>

      <Card className="border-stone-200">
        <CardContent className="p-0">
          {inventoryQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading inventory...</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-stone-500">No supply items found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supply Item</TableHead>
                  {isSuperAdmin && <TableHead>Outlet</TableHead>}
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Reorder Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isLow = Number.parseFloat(item.current_stock) <= Number.parseFloat(item.reorder_level);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-stone-900">{item.item_name}</TableCell>
                      {isSuperAdmin && <TableCell>{item.franchise ? <Badge variant="outline">{item.franchise.outlet_code} · {item.franchise.name}</Badge> : "—"}</TableCell>}
                      <TableCell className="font-mono font-semibold">{item.current_stock} {item.unit}</TableCell>
                      <TableCell className="font-mono text-stone-500">{item.reorder_level} {item.unit}</TableCell>
                      <TableCell>
                        {isLow ? (
                          <Badge className="gap-1 bg-amber-100 text-amber-900 hover:bg-amber-100"><AlertTriangle className="h-3 w-3" />Low Stock</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Healthy</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setAdjustItem(item)}><SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />Adjust</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setLedgerItem(item)}><History className="mr-1.5 h-3.5 w-3.5" />Ledger</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isSuperAdmin && <CreateInventoryItemDialog open={createOpen} onOpenChange={setCreateOpen} franchises={franchises} />}
      <AdjustStockDialog item={adjustItem} onOpenChange={(open) => { if (!open) setAdjustItem(null); }} />
      <MovementLedgerDrawer item={ledgerItem} onOpenChange={(open) => { if (!open) setLedgerItem(null); }} />
    </div>
  );
}
