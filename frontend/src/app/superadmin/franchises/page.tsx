"use client";

import { Building2, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";

import { FranchiseFormDialog } from "@/components/franchises/franchise-form-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useFranchises, useSoftDeleteFranchise, useUpdateFranchise } from "@/hooks/use-franchises";
import type { Franchise } from "@/types/franchise";

export default function SuperAdminFranchisesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<boolean | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFranchise, setEditingFranchise] = useState<Franchise | null>(null);

  const franchisesQuery = useFranchises({ search: search || undefined, is_active: statusFilter, page: 1, page_size: 50 });
  const updateMutation = useUpdateFranchise();
  const deleteMutation = useSoftDeleteFranchise();
  const franchises = franchisesQuery.data?.items ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight text-stone-900">Franchise Outlets</h1><p className="text-sm text-stone-500">Create outlets, assign unique bill codes, and suspend or activate locations.</p></div>
          <Button onClick={() => { setEditingFranchise(null); setDialogOpen(true); }} className="bg-orange-600 hover:bg-orange-700"><Plus className="mr-2 h-4 w-4" />New Franchise Outlet</Button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by outlet name, code, or city..." className="pl-9" /></div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant={statusFilter === null ? "default" : "outline"} onClick={() => setStatusFilter(null)}>All</Button>
            <Button type="button" size="sm" variant={statusFilter === true ? "default" : "outline"} onClick={() => setStatusFilter(true)}>Active</Button>
            <Button type="button" size="sm" variant={statusFilter === false ? "default" : "outline"} onClick={() => setStatusFilter(false)}>Suspended</Button>
          </div>
        </div>
        {franchisesQuery.isLoading ? (
          <div className="flex items-center justify-center py-16 text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading outlets...</div>
        ) : franchises.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-sm text-stone-500">No franchise outlets found.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {franchises.map((outlet) => (
              <Card key={outlet.id} className="flex flex-col justify-between border-stone-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-stone-900 font-mono text-sm text-white hover:bg-stone-900">{outlet.outlet_code}</Badge>
                      <Badge variant={outlet.is_active ? "default" : "destructive"} className={outlet.is_active ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : ""}>{outlet.is_active ? "Active" : "Suspended"}</Badge>
                    </div>
                    <Switch checked={outlet.is_active} disabled={updateMutation.isPending} onCheckedChange={(checked) => updateMutation.mutate({ id: outlet.id, payload: { is_active: checked } })} />
                  </div>
                  <CardTitle className="pt-2 text-lg leading-snug">{outlet.name}</CardTitle>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-orange-700"><Building2 className="h-3.5 w-3.5" />{outlet.model_type}</p>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-stone-600">
                  <div className="space-y-1"><p className="font-medium text-stone-800">{outlet.city}</p><p className="line-clamp-2 text-xs text-stone-500">{outlet.address}</p><p className="text-xs">{outlet.phone}</p></div>
                  <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-3">
                    <Button type="button" size="sm" variant="outline" onClick={() => { setEditingFranchise(outlet); setDialogOpen(true); }}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
                    <Button type="button" size="sm" variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(outlet.id)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <FranchiseFormDialog open={dialogOpen} onOpenChange={setDialogOpen} franchise={editingFranchise} />
      </div>
    </AppShell>
  );
}
