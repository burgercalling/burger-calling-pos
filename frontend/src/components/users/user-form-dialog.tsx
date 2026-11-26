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
import { PermissionSwitches } from "@/components/users/permission-switches";
import { useCreateUser } from "@/hooks/use-users";
import type { Franchise } from "@/types/franchise";

const createUserSchema = z.object({
  franchise_id: z.string().optional(),
  full_name: z.string().trim().min(2).max(150),
  username: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_.-]+$/),
  password: z.string().min(6).max(128),
  role: z.enum(["franchise_owner", "cashier"]),
  permissions: z.array(z.string()),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;
const DEFAULT_CASHIER_PERMS = ["pos:create_order", "pos:print_kot"];
const DEFAULT_OWNER_PERMS = [
  "pos:create_order", "pos:print_kot", "pos:reprint_receipt", "reports:today_sales",
  "reports:outlet_analytics", "inventory:manage", "stock_requests:create", "users:manage_cashiers", "settings:manage_outlet",
];

export function UserFormDialog({ open, onOpenChange, isSuperAdmin, franchises = [] }: { open: boolean; onOpenChange: (open: boolean) => void; isSuperAdmin: boolean; franchises?: Franchise[] }) {
  const createMutation = useCreateUser();
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { franchise_id: "", full_name: "", username: "", password: "", role: "cashier", permissions: DEFAULT_CASHIER_PERMS },
  });

  const selectedRole = watch("role");
  const selectedPermissions = watch("permissions");

  useEffect(() => {
    if (open) {
      reset({ franchise_id: franchises[0]?.id ?? "", full_name: "", username: "", password: "", role: "cashier", permissions: DEFAULT_CASHIER_PERMS });
    }
  }, [open, franchises, reset]);

  const onSubmit = (values: CreateUserFormValues) => {
    createMutation.mutate(
      { franchise_id: isSuperAdmin ? values.franchise_id : undefined, full_name: values.full_name, username: values.username.toLowerCase(), password: values.password, role: isSuperAdmin ? values.role : "cashier", permissions: values.permissions },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isSuperAdmin ? "Create Outlet User" : "Add Outlet Cashier"}</DialogTitle>
          <DialogDescription>Configure login credentials and granular POS permissions.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {createMutation.isError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createMutation.error.detail}</div>}
          {isSuperAdmin && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Franchise Outlet</Label>
                <Select value={watch("franchise_id")} onValueChange={(val) => setValue("franchise_id", val)}>
                  <SelectTrigger><SelectValue placeholder="Select outlet" /></SelectTrigger>
                  <SelectContent>{franchises.map((f) => <SelectItem key={f.id} value={f.id}>[{f.outlet_code}] {f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={selectedRole} onValueChange={(val) => { const r = val as "franchise_owner" | "cashier"; setValue("role", r); setValue("permissions", r === "franchise_owner" ? DEFAULT_OWNER_PERMS : DEFAULT_CASHIER_PERMS); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">Cashier</SelectItem>
                    <SelectItem value="franchise_owner">Franchise Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full Name</Label>
            <Input id="full_name" {...register("full_name")} />
            {errors.full_name && <p className="text-xs text-red-600">{errors.full_name.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" {...register("username")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Initial Password</Label>
              <Input id="password" type="password" {...register("password")} />
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <Label className="text-sm font-semibold">Granular Permissions</Label>
            <PermissionSwitches role={isSuperAdmin ? selectedRole : "cashier"} selectedPermissions={selectedPermissions} onChange={(perms) => setValue("permissions", perms)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
