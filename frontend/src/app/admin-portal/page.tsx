"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSuperAdminLogin } from "@/hooks/use-auth";

const superAdminSchema = z.object({
  username: z.string().trim().min(2).max(64),
  password: z.string().min(4).max(128),
});

export default function AdminPortalPage() {
  const [showPassword, setShowPassword] = useState(false);
  const loginMutation = useSuperAdminLogin();
  const { register, handleSubmit, formState: { errors } } = useForm<{ username: string; password: string }>({
    resolver: zodResolver(superAdminSchema),
    defaultValues: { username: "", password: "" },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-950 p-4">
      <Card className="w-full max-w-md border-stone-800 bg-stone-900 text-stone-100 shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"><ShieldCheck className="h-7 w-7" /></div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-white">Central Admin Portal</CardTitle>
            <CardDescription className="text-sm text-stone-400">Burger Calling POS — Restricted Command Access</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((v) => loginMutation.mutate(v))} className="space-y-5" noValidate>
            {loginMutation.isError && <div role="alert" className="rounded-lg border border-red-900/60 bg-red-950/60 px-3.5 py-2.5 text-sm font-medium text-red-300">{loginMutation.error.detail}</div>}
            <div className="space-y-2">
              <Label htmlFor="admin-username" className="text-stone-200">Administrator Username</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                <Input id="admin-username" type="text" autoComplete="username" className="h-12 border-stone-700 bg-stone-950 pl-10 text-base text-white" {...register("username")} />
              </div>
              {errors.username && <p className="text-xs text-red-400">{errors.username.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-stone-200">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                <Input id="admin-password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="h-12 border-stone-700 bg-stone-950 pl-10 pr-11 text-base text-white" {...register("password")} />
                <button type="button" onClick={() => setShowPassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-stone-400 hover:bg-stone-800">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>
            <Button type="submit" disabled={loginMutation.isPending} className="h-12 w-full bg-amber-500 text-base font-semibold text-stone-950 hover:bg-amber-400">
              {loginMutation.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Authenticating...</> : "Authenticate"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
