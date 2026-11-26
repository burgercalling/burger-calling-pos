"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Lock, Store, User } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOutletLogin } from "@/hooks/use-auth";

const outletLoginSchema = z.object({
  username: z.string().trim().min(2, "Username must be at least 2 characters").max(64),
  password: z.string().min(4, "Password must be at least 4 characters").max(128),
});

export default function OutletLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const loginMutation = useOutletLogin();
  const { register, handleSubmit, formState: { errors } } = useForm<{ username: string; password: string }>({
    resolver: zodResolver(outletLoginSchema),
    defaultValues: { username: "", password: "" },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-stone-100 p-4">
      <Card className="w-full max-w-md border-orange-200/80 shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-md"><Store className="h-7 w-7" /></div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-stone-900">Burger Calling POS</CardTitle>
            <CardDescription className="text-sm text-stone-600">Outlet Owner &amp; Cashier Terminal Sign In</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((v) => loginMutation.mutate(v))} className="space-y-5" noValidate>
            {loginMutation.isError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{loginMutation.error.detail}</div>}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input id="username" type="text" autoComplete="username" placeholder="Enter outlet or cashier username" className="h-12 pl-10 text-base" {...register("username")} />
              </div>
              {errors.username && <p className="text-xs font-medium text-red-600">{errors.username.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" className="h-12 pl-10 pr-11 text-base" {...register("password")} />
                <button type="button" onClick={() => setShowPassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-stone-500 hover:bg-stone-100">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs font-medium text-red-600">{errors.password.message}</p>}
            </div>
            <Button type="submit" disabled={loginMutation.isPending} className="h-12 w-full bg-orange-600 text-base font-semibold text-white hover:bg-orange-700">
              {loginMutation.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Signing In...</> : "Sign In to POS"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
