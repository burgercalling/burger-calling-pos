"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AppShell } from "@/components/layout/app-shell";
import { LocalImageUpload } from "@/components/media/local-image-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useGlobalSettings, useUpdateGlobalSettings } from "@/hooks/use-system";
import type { PrinterWidthMode } from "@/types/pos";

const settingsSchema = z.object({
  brand_name: z.string().trim().min(2).max(150),
  logo_url: z.string().nullable(),
  receipt_footer: z.string().trim().min(2).max(500),
  tax_enabled: z.boolean(),
  tax_label: z.string().trim().min(1).max(50),
  tax_rate: z.coerce.number().min(0).max(100),
  gstin: z.string().trim().max(20).optional().or(z.literal("")),
  currency_code: z.string().trim().min(3).max(10),
  currency_symbol: z.string().trim().min(1).max(10),
  date_format: z.string().trim().min(4).max(20),
  timezone: z.string().trim().min(2).max(64),
  printer_width_mode: z.enum(["auto", "80mm", "58mm"]),
  default_kot_enabled: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SuperAdminSettingsPage() {
  const { data: settings, isLoading } = useGlobalSettings();
  const updateMutation = useUpdateGlobalSettings();
  const { register, handleSubmit, setValue, watch, reset } = useForm<SettingsFormValues>({ resolver: zodResolver(settingsSchema) });

  useEffect(() => {
    if (settings) {
      reset({
        brand_name: settings.brand_name, logo_url: settings.logo_url, receipt_footer: settings.receipt_footer,
        tax_enabled: settings.tax_enabled, tax_label: settings.tax_label, tax_rate: Number.parseFloat(settings.tax_rate),
        gstin: settings.gstin ?? "", currency_code: settings.currency_code, currency_symbol: settings.currency_symbol,
        date_format: settings.date_format, timezone: settings.timezone,
        printer_width_mode: settings.printer_width_mode, default_kot_enabled: settings.default_kot_enabled,
      });
    }
  }, [settings, reset]);

  const taxEnabled = watch("tax_enabled");
  const brandName = watch("brand_name") ?? "Burger Calling";
  const footer = watch("receipt_footer") ?? "";
  const taxLabel = watch("tax_label") ?? "GST";
  const taxRate = watch("tax_rate") ?? 0;
  const gstin = watch("gstin") ?? "";
  const sym = watch("currency_symbol") ?? "₹";
  const sampleSubtotal = 250;
  const sampleTax = taxEnabled ? (sampleSubtotal * taxRate) / 100 : 0;
  const sampleTotal = sampleSubtotal + sampleTax;

  return (
    <AppShell>
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading global settings...</div>
      ) : (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
          <div><h1 className="text-2xl font-bold tracking-tight text-stone-900">Global POS Settings</h1><p className="text-sm text-stone-500">Configure brand identity, thermal roll width, KOT defaults, and GST behavior.</p></div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <form onSubmit={handleSubmit((v) => updateMutation.mutate({ ...v, tax_rate: v.tax_rate.toFixed(2), gstin: v.gstin || null }))} className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Brand &amp; Thermal Receipt</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5"><Label>Brand Logo</Label><LocalImageUpload folder="logos" value={watch("logo_url") ?? null} onChange={(url) => setValue("logo_url", url)} /></div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label>Brand Name</Label><Input {...register("brand_name")} /></div>
                    <div className="space-y-1.5">
                      <Label>Printer Width Mode</Label>
                      <Select value={watch("printer_width_mode")} onValueChange={(v) => setValue("printer_width_mode", v as PrinterWidthMode)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="auto">Auto-Detect (Fluid)</SelectItem><SelectItem value="80mm">80mm Thermal Roll</SelectItem><SelectItem value="58mm">58mm Thermal Roll</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5"><Label>Receipt Footer</Label><Textarea rows={2} {...register("receipt_footer")} /></div>
                  <div className="flex items-center justify-between rounded-lg border border-stone-200 p-3">
                    <div><Label>Default KOT Printing</Label><p className="text-xs text-stone-500">Initialize cashier KOT toggle to ON by default</p></div>
                    <Switch checked={watch("default_kot_enabled")} onCheckedChange={(v) => setValue("default_kot_enabled", v)} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Tax / GST Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-stone-200 p-3">
                    <div><Label>Enable GST / Tax on Bills</Label><p className="text-xs text-stone-500">Disabled by default in V1.0; hides GST lines when OFF</p></div>
                    <Switch checked={taxEnabled} onCheckedChange={(v) => setValue("tax_enabled", v)} />
                  </div>
                  {taxEnabled && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5"><Label>Tax Label</Label><Input {...register("tax_label")} /></div>
                      <div className="space-y-1.5"><Label>Tax Rate (%)</Label><Input type="number" step="0.01" {...register("tax_rate")} /></div>
                      <div className="space-y-1.5"><Label>GSTIN</Label><Input {...register("gstin")} /></div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <div className="flex items-center justify-end gap-3">
                {updateMutation.isSuccess && <span className="text-sm font-medium text-emerald-700">Settings saved &amp; audited.</span>}
                <Button type="submit" disabled={updateMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
                  {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Global Settings
                </Button>
              </div>
            </form>
            <Card className="h-fit border-stone-300 bg-stone-50">
              <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-stone-600">Live Thermal Receipt Preview</CardTitle></CardHeader>
              <CardContent>
                <div className="mx-auto max-w-[72mm] rounded border border-stone-300 bg-white p-4 font-mono text-xs text-black shadow-sm">
                  <div className="text-center"><p className="text-sm font-bold uppercase">{brandName}</p><p className="text-[10px]">Sample Outlet (A)</p>{taxEnabled && gstin && <p className="text-[10px]">GSTIN: {gstin}</p>}</div>
                  <div className="my-2 border-t border-dashed border-black" />
                  <div className="flex justify-between"><span>2x Crispy Veg Burger</span><span>{sym}250.00</span></div>
                  <div className="my-2 border-t border-dashed border-black" />
                  <div className="flex justify-between"><span>Subtotal</span><span>{sym}250.00</span></div>
                  {taxEnabled && <div className="flex justify-between"><span>{taxLabel} ({taxRate}%)</span><span>{sym}{sampleTax.toFixed(2)}</span></div>}
                  <div className="mt-1 flex justify-between border-t border-dashed border-black pt-1 font-bold"><span>GRAND TOTAL</span><span>{sym}{sampleTotal.toFixed(2)}</span></div>
                  <div className="my-2 border-t border-dashed border-black" />
                  <p className="text-center text-[10px]">{footer}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
