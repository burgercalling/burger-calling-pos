"use client";

import { KeyRound, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PermissionSwitches } from "@/components/users/permission-switches";
import { ResetPasswordDialog } from "@/components/users/reset-password-dialog";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { useFranchises } from "@/hooks/use-franchises";
import { useSoftDeleteUser, useUpdateUser, useUpdateUserPermissions, useUsers } from "@/hooks/use-users";
import type { ManagedUser } from "@/types/user";

export function UserManagementView({ mode }: { mode: "superadmin" | "owner" }) {
  const isSuperAdmin = mode === "superadmin";
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);

  const usersQuery = useUsers({ search: search || undefined, page: 1, page_size: 50 });
  const franchisesQuery = useFranchises({ is_active: true, page: 1, page_size: 100 });
  const updateUserMutation = useUpdateUser();
  const updatePermissionsMutation = useUpdateUserPermissions();
  const deleteUserMutation = useSoftDeleteUser();
  const users = usersQuery.data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">{isSuperAdmin ? "Franchise Users & Cashiers" : "Outlet Cashiers"}</h1>
          <p className="text-sm text-stone-500">{isSuperAdmin ? "Manage franchise owners, cashiers, and per-user POS privileges." : "Create cashiers for your outlet and toggle KOT or receipt reprint permissions."}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-orange-600 hover:bg-orange-700">
          <Plus className="mr-2 h-4 w-4" />
          {isSuperAdmin ? "Add User" : "Add Cashier"}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or username..." className="pl-9" />
      </div>

      {usersQuery.isLoading ? (
        <div className="flex items-center justify-center py-16 text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading accounts...</div>
      ) : users.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-stone-500">No accounts found.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {users.map((user) => (
            <Card key={user.id} className="border-stone-200">
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-lg">{user.full_name}</CardTitle>
                    <Badge variant="outline" className="uppercase">{user.role === "franchise_owner" ? "Owner" : "Cashier"}</Badge>
                    {user.franchise && <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">{user.franchise.outlet_code} · {user.franchise.name}</Badge>}
                  </div>
                  <p className="text-sm text-stone-500">@{user.username}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">{user.is_active ? "Active" : "Disabled"}</span>
                  <Switch checked={user.is_active} disabled={updateUserMutation.isPending} onCheckedChange={(checked) => updateUserMutation.mutate({ id: user.id, payload: { is_active: checked } })} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <PermissionSwitches role={user.role} selectedPermissions={user.permissions} disabled={updatePermissionsMutation.isPending} onChange={(nextPermissions) => updatePermissionsMutation.mutate({ id: user.id, permissions: nextPermissions })} />
                <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-3">
                  <Button type="button" size="sm" variant="outline" onClick={() => setResetTarget(user)}><KeyRound className="mr-1.5 h-3.5 w-3.5" />Reset Password</Button>
                  <Button type="button" size="sm" variant="destructive" disabled={deleteUserMutation.isPending} onClick={() => deleteUserMutation.mutate(user.id)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <UserFormDialog open={createOpen} onOpenChange={setCreateOpen} isSuperAdmin={isSuperAdmin} franchises={isSuperAdmin ? (franchisesQuery.data?.items ?? []) : []} />
      <ResetPasswordDialog user={resetTarget} onOpenChange={(open) => { if (!open) setResetTarget(null); }} />
    </div>
  );
}
