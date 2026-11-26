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
import { Textarea } from "@/components/ui/textarea";
import { useCreateFranchise, useUpdateFranchise } from "@/hooks/use-franchises";
import type { FranchiseModelType } from "@/types/auth";
import type { Franchise } from "@/types/franchise";

const MODEL_TYPES: FranchiseModelType[] = ["Signature Restaurant", "Express Kiosk", "Mini Outlet"];

const franchiseSchema = z.object({
  outlet_code: z.string().trim().min(1, "Outlet code is required").max(16).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2, "Outlet name is required").max(150),
  model_type: z.enum(["Signature Restaurant", "Express Kiosk", "Mini Outlet"]),
  city: z.string().trim().min(2, "City is required").max(100),
  address: z.string().trim().min(5, "Address is required").max(500),
  phone: z.string().trim().min(7, "Phone is required").max(20),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
});

type FranchiseFormValues = z.infer<typeof franchiseSchema>;

export function FranchiseFormDialog({ open, onOpenChange, franchise }: { open: boolean; onOpenChange: (open: boolean) => void; franchise?: Franchise | null }) {
  const isEditing = Boolean(franchise);
  const createMutation = useCreateFranchise();
  const updateMutation = useUpdateFranchise();

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FranchiseFormValues>({
    resolver: zodResolver(franchiseSchema),
    defaultValues: { outlet_code: "", name: "", model_type: "Express Kiosk", city: "", address: "", phone: "", email: "" },
  });

  useEffect(() => {
    if (franchise) {
      reset({ outlet_code: franchise.outlet_code, name: franchise.name, model_type: franchise.model_type, city: franchise.city, address: franchise.address, phone: franchise.phone, email: franchise.email ?? "" });
    } else {
      reset({ outlet_code: "", name: "", model_type: "Express Kiosk", city: "", address: "", phone: "", email: "" });
    }
  }, [franchise, reset, open]);

  const activeMutation = isEditing ? updateMutation : createMutation;

  const onSubmit = (values: FranchiseFormValues) => {
    const cleanEmail = values.email ? values.email : null;
    if (isEditing && franchise) {
      updateMutation.mutate({ id: franchise.id, payload: { name: values.name, model_type: values.model_type, city: values.city, address: values.address, phone: values.phone, email: cleanEmail } }, { onSuccess: () => onOpenChange(false) });
    } else {
      createMutation.mutate({ outlet_code: values.outlet_code.toUpperCase(), name: values.name, model_type: values.model_type, city: values.city, address: values.address, phone: values.phone, email: cleanEmail }, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Edit Outlet (${franchise?.outlet_code})` : "Add New Franchise Outlet"}</DialogTitle>
          <DialogDescription>{isEditing ? "Update outlet profile and contact details." : "Outlet code is permanent and used on daily bill numbers."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {activeMutation.isError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{activeMutation.error.detail}</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="outlet_code">Outlet Code</Label>
              <Input id="outlet_code" disabled={isEditing} placeholder="e.g. A, B, BSP01" className="uppercase" {...register("outlet_code")} />
              {errors.outlet_code && <p className="text-xs text-red-600">{errors.outlet_code.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Model Type</Label>
              <Select value={watch("model_type")} onValueChange={(val) => setValue("model_type", val as FranchiseModelType, { shouldValidate: true })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MODEL_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Outlet Name</Label>
            <Input id="name" placeholder="Burger Calling — Civil Lines" {...register("name")} />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" placeholder="Jabalpur" {...register("city")} />
              {errors.city && <p className="text-xs text-red-600">{errors.city.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="+91 9876543210" {...register("phone")} />
              {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email (Optional)</Label>
            <Input id="email" type="email" placeholder="outlet@burgercalling.in" {...register("email")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" rows={2} {...register("address")} />
            {errors.address && <p className="text-xs text-red-600">{errors.address.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={activeMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
              {activeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Outlet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
