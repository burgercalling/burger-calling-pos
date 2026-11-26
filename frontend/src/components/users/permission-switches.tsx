"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { UserRole } from "@/types/auth";
import { POS_PERMISSIONS } from "@/types/user";

export function PermissionSwitches({
  role,
  selectedPermissions,
  onChange,
  disabled = false,
}: {
  role: UserRole;
  selectedPermissions: string[];
  onChange: (nextPermissions: string[]) => void;
  disabled?: boolean;
}) {
  const availableOptions = role === "cashier" ? POS_PERMISSIONS.filter((p) => p.cashierOnlyToggleable) : POS_PERMISSIONS;

  const handleToggle = (key: string, checked: boolean) => {
    if (checked) {
      if (!selectedPermissions.includes(key)) onChange([...selectedPermissions, key]);
    } else {
      onChange(selectedPermissions.filter((item) => item !== key));
    }
  };

  return (
    <div className="space-y-2.5">
      {availableOptions.map((perm) => (
        <div key={perm.key} className="flex items-center justify-between gap-4 rounded-lg border border-stone-200 bg-stone-50/70 px-3.5 py-2.5">
          <div className="space-y-0.5">
            <Label htmlFor={`perm-${perm.key}`} className="cursor-pointer text-sm font-medium text-stone-900">{perm.label}</Label>
            <p className="text-xs text-stone-500">{perm.description}</p>
          </div>
          <Switch id={`perm-${perm.key}`} checked={selectedPermissions.includes(perm.key)} disabled={disabled} onCheckedChange={(val) => handleToggle(perm.key, val)} />
        </div>
      ))}
    </div>
  );
}
