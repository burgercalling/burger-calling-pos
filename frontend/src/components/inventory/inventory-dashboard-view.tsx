"use client";

import { AlertTriangle, Boxes, CheckCircle2, Download, History, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { AdjustStockDialog } from "@/components/inventory/adjust-stock-dialog";
import { CreateInventoryItemDialog } from "@/components/inventory/create-inventory-item-dialog";
import { MovementLedgerDrawer } from "@/components/inventory/movement-ledger-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebounce } from "@/hooks/use-debounce";
import { useFranchises } from "@/hooks/use-franchises";
import { useInventoryItems } from "@/hooks/use-inventory";
import type { InventoryItem } from "@/types/inventory";

export function InventoryDashboardView({ mode }: { mode: "superadmin" | "owner" }) {
  const isSuperAdmin = mode === "superadmin";
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 280);
  const [franchiseId, setFranchiseId] = useState<string>("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [ledgerItem, setLedgerItem] = useState<InventoryItem | null>(null);

  const franchisesQuery = useFranchises({ is_active: true, page_size: 100 });
  const inventoryQuery = useInventoryItems({
    franchise_id: isSuperAdmin && franchiseId !== "all" ? franchiseId : undefined,
    low_stock_only: lowStockOnly,
    search: debouncedSearch || undefined,
    page: 1,
    page_size: 100,
  });

  const items = inventoryQuery.data?.items ?? [];
  const franchises = franchisesQuery.data?.items ?? [];

  const stats = useMemo(() => {
    let low = 0;
    for (const i of items) {
      if (Number.parseFloat(i.current_stock) <= Number.parseFloat(i.reorder_level)) low += 1;
    }
    return { total: items.length, low, healthy: items.length - low };
  }, [items]);

  const handleExportCsv = () => {
    const header = ["Supply Item", "Outlet", "Current Stock", "Unit", "Reorder Level", "Status"];
    const rows = items.map((i) => {
      const isLow = Number.parseFloat(i.current_stock) <= Number.parseFloat(i.reorder_level);
      return [
        `"${i.item_name.replace(/"/g, '""')}"`,
        i.franchise ? `${i.franchise.outlet_code} - ${i.franchise.name}` : "",
        i.current_stock,
        i.unit,
        i.reorder_level,
        isLow ? "Low Stock" : "Healthy",
      ].join(",");
    });
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-snapshot.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">Outlet Supply Inventory</h1>
          <p className="text-sm text-stone-500">
            Track unit-level supplies, automatic BOM sale deductions, low-stock alerts, and movement ledgers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleExportCsv} disabled={items.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          {isSuperAdmin && (
            <Button onClick={() => setCreateOpen(true)} className="bg-orange-600 hover:bg-orange-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Supply Item
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-stone-500">Tracked Supplies</CardTitle></CardHeader><CardContent className="flex items-center justify-between"><p className="text-2xl font-bold">{stats.total}</p><Boxes className="h-5 w-5 text-stone-500" /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-stone-500">Healthy Stock</CardTitle></CardHeader><CardContent className="flex items-center justify-between"><p className="text-2xl font-bold text-emerald-700">{stats.healthy}</p><CheckCircle2 className="h-5 w-5 text-emerald-600" /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-stone-500">Low Stock Alerts</CardTitle></CardHeader><CardContent className="flex items-center justify-between"><p className="text-2xl font-bold text-amber-700">{stats.low}</p><AlertTriangle className="h-5 w-5 text-amber-600" /></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search supply item..." className="pl-9" />
        </div>
        {isSuperAdmin && (
          <Select value={franchiseId} onValueChange={setFranchiseId}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="All Outlets" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outlets</SelectItem>
              {franchises.map((f) => <SelectItem key={f.id} value={f.id}>[{f.outlet_code}] {f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 dark:border-stone-800 dark:bg-stone-900">
          <Switch checked={lowStockOnly} onCheckedChange={setLowStockOnly} />
          <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Low Stock Only</span>
        </div>
      </div>

      <Card className="border-stone-200 dark:border-stone-800">
        <CardContent className="overflow-x-auto p-0">
          {inventoryQuery.isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
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
                      <TableCell className="font-medium text-stone-900 dark:text-stone-100">{item.item_name}</TableCell>
                      {isSuperAdmin && (
                        <TableCell>
                          {item.franchise ? <Badge variant="outline">{item.franchise.outlet_code} · {item.franchise.name}</Badge> : "—"}
                        </TableCell>
                      )}
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
                          <Button type="button" size="sm" variant="outline" onClick={() => setAdjustItem(item)}>
                            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                            Adjust
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setLedgerItem(item)}>
                            <History className="mr-1.5 h-3.5 w-3.5" />
                            Ledger
                          </Button>
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
