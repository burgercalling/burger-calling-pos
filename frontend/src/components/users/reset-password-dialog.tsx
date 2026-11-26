"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetUserPassword } from "@/hooks/use-users";
import type { ManagedUser } from "@/types/user";

const resetSchema = z.object({ new_password: z.string().min(6).max(128) });

export function ResetPasswordDialog({ user, onOpenChange }: { user: ManagedUser | null; onOpenChange: (open: boolean) => void }) {
  const resetMutation = useResetUserPassword();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ new_password: string }>({ resolver: zodResolver(resetSchema), defaultValues: { new_password: "" } });

  const onSubmit = (values: { new_password: string }) => {
    if (!user) return;
    resetMutation.mutate({ id: user.id, new_password: values.new_password }, { onSuccess: () => { reset(); onOpenChange(false); } });
  };

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>Set a new password for <strong>{user?.username}</strong>.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {resetMutation.isError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{resetMutation.error.detail}</div>}
          <div className="space-y-1.5">
            <Label htmlFor="new_password">New Password</Label>
            <Input id="new_password" type="password" {...register("new_password")} />
            {errors.new_password && <p className="text-xs text-red-600">{errors.new_password.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={resetMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
              {resetMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
