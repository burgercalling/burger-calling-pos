"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { LocalImageUpload } from "@/components/media/local-image-upload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProduct, useUpdateProduct } from "@/hooks/use-menu";
import { getProductChannelPrice, type Category, type Product, type ProductItemType } from "@/types/menu";

const productSchema = z.object({
  category_id: z.string().min(1),
  sku: z.string().trim().max(64).optional().or(z.literal("")),
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  dine_in_price: z.coerce.number().positive(),
  takeaway_price: z.coerce.number().positive(),
  swiggy_price: z.coerce.number().positive(),
  zomato_price: z.coerce.number().positive(),
  cost_price: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  tax_rate: z.union([z.coerce.number().min(0).max(100), z.literal("")]).optional(),
  image_url: z.string().nullable(),
  item_type: z.enum(["regular", "combo", "addon"]),
  is_available: z.boolean(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export function ProductFormDialog({
  open,
  onOpenChange,
  categories,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  product?: Product | null;
}) {
  const isEditing = Boolean(product);
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const { register, handleSubmit, setValue, watch, reset } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      category_id: categories[0]?.id ?? "",
      sku: "",
      name: "",
      description: "",
      dine_in_price: 99,
      takeaway_price: 99,
      swiggy_price: 119,
      zomato_price: 119,
      cost_price: "",
      tax_rate: "",
      image_url: null,
      item_type: "regular",
      is_available: true,
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        category_id: product.category_id,
        sku: product.sku ?? "",
        name: product.name,
        description: product.description ?? "",
        dine_in_price: getProductChannelPrice(product, "dine_in"),
        takeaway_price: getProductChannelPrice(product, "takeaway"),
        swiggy_price: getProductChannelPrice(product, "swiggy"),
        zomato_price: getProductChannelPrice(product, "zomato"),
        cost_price: product.cost_price ? Number.parseFloat(product.cost_price) : "",
        tax_rate: product.tax_rate ? Number.parseFloat(product.tax_rate) : "",
        image_url: product.image_url,
        item_type: product.item_type,
        is_available: product.is_available,
      });
    } else {
      reset({
        category_id: categories[0]?.id ?? "",
        sku: "",
        name: "",
        description: "",
        dine_in_price: 99,
        takeaway_price: 99,
        swiggy_price: 119,
        zomato_price: 119,
        cost_price: "",
        tax_rate: "",
        image_url: null,
        item_type: "regular",
        is_available: true,
      });
    }
  }, [product, categories, reset, open]);

  const activeMutation = isEditing ? updateMutation : createMutation;

  const copyPriceToAll = (sourceField: "dine_in_price" | "takeaway_price") => {
    const val = Number(watch(sourceField)) || 0;
    if (val <= 0) return;
    setValue("dine_in_price", val, { shouldValidate: true });
    setValue("takeaway_price", val, { shouldValidate: true });
    setValue("swiggy_price", val, { shouldValidate: true });
    setValue("zomato_price", val, { shouldValidate: true });
  };

  const onSubmit = (values: ProductFormValues) => {
    const cleanPayload = {
      category_id: values.category_id,
      sku: values.sku ? values.sku.toUpperCase() : null,
      name: values.name,
      description: values.description || null,
      price: values.dine_in_price,
      cost_price: values.cost_price === "" || values.cost_price === undefined ? null : Number(values.cost_price),
      tax_rate: values.tax_rate === "" || values.tax_rate === undefined ? null : Number(values.tax_rate),
      image_url: values.image_url,
      item_type: values.item_type,
      is_available: values.is_available,
      prices: [
        { order_source: "dine_in", price: values.dine_in_price },
        { order_source: "takeaway", price: values.takeaway_price },
        { order_source: "swiggy", price: values.swiggy_price },
        { order_source: "zomato", price: values.zomato_price },
      ],
    };
    if (isEditing && product) {
      updateMutation.mutate({ id: product.id, payload: cleanPayload }, { onSuccess: () => onOpenChange(false) });
    } else {
      createMutation.mutate(cleanPayload, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Edit ${product?.name}` : "Add Menu Product"}</DialogTitle>
          <DialogDescription>100% Pure Vegetarian menu item with multi-channel pricing.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {activeMutation.isError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {activeMutation.error.detail}
            </div>
          )}
          <LocalImageUpload folder="products" value={watch("image_url")} onChange={(url) => setValue("image_url", url)} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={watch("category_id")} onValueChange={(val) => setValue("category_id", val, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Item Type</Label>
              <Select value={watch("item_type")} onValueChange={(val) => setValue("item_type", val as ProductItemType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="combo">Combo</SelectItem>
                  <SelectItem value="addon">Add-on</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-name">Product Name</Label>
            <Input id="prod-name" {...register("name")} />
          </div>

          <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 dark:border-stone-800 dark:bg-stone-900/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-stone-600 dark:text-stone-300">
                Channel Pricing (₹)
              </Label>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => copyPriceToAll("dine_in_price")}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copy Dine In Price to All
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => copyPriceToAll("takeaway_price")}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copy Take Away Price to All
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="price-dine-in" className="text-xs">🍽️ Dine In</Label>
                <Input id="price-dine-in" type="number" step="0.01" min="1" {...register("dine_in_price")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="price-takeaway" className="text-xs">🥡 Take Away</Label>
                <Input id="price-takeaway" type="number" step="0.01" min="1" {...register("takeaway_price")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="price-swiggy" className="text-xs">🟠 Swiggy</Label>
                <Input id="price-swiggy" type="number" step="0.01" min="1" {...register("swiggy_price")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="price-zomato" className="text-xs">🔴 Zomato</Label>
                <Input id="price-zomato" type="number" step="0.01" min="1" {...register("zomato_price")} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="prod-cost">Cost Price (₹)</Label>
              <Input id="prod-cost" type="number" step="0.01" min="0" placeholder="Optional" {...register("cost_price")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-tax">Tax % (Optional)</Label>
              <Input id="prod-tax" type="number" step="0.01" min="0" max="100" placeholder="e.g. 5" {...register("tax_rate")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-sku">SKU (Optional)</Label>
              <Input id="prod-sku" className="uppercase" {...register("sku")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-desc">Description (Optional)</Label>
            <Textarea id="prod-desc" rows={2} {...register("description")} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3.5 py-2.5 dark:border-stone-700">
            <div>
              <Label className="text-sm font-medium">Available on POS</Label>
              <p className="text-xs text-stone-500">Toggle off if temporarily out of stock</p>
            </div>
            <Switch checked={watch("is_available")} onCheckedChange={(checked) => setValue("is_available", checked)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={activeMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
              {activeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Product" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
