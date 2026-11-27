"use client";

import {
  Banknote,
  ChevronRight,
  CreditCard,
  Eye,
  Loader2,
  LogOut,
  Minus,
  Plus,
  Printer,
  QrCode,
  Search,
  ShoppingCart,
  Split,
  Trash2,
  Utensils,
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { ThermalReceipt } from "@/components/pos/thermal-receipt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { useDebounce } from "@/hooks/use-debounce";
import { useCategories, useProducts } from "@/hooks/use-menu";
import { useCreateOrder, useCustomerLookup } from "@/hooks/use-pos";
import { resolveMediaUrl } from "@/lib/api";
import { formatINR, getProductChannelPrice, type Product } from "@/types/menu";
import type { OrderReceiptPayload, OrderType, PaymentMode } from "@/types/pos";

interface CartLine {
  product: Product;
  quantity: number;
}

const ORDER_SOURCES: {
  key: OrderType;
  label: string;
  emoji: string;
  activeClass: string;
}[] = [
  { key: "dine_in", label: "Dine In", emoji: "🍽️", activeClass: "bg-stone-900 text-white hover:bg-stone-800" },
  { key: "takeaway", label: "Take Away", emoji: "🥡", activeClass: "bg-blue-700 text-white hover:bg-blue-800" },
  { key: "swiggy", label: "Swiggy", emoji: "🟠", activeClass: "bg-orange-600 text-white hover:bg-orange-700" },
  { key: "zomato", label: "Zomato", emoji: "🔴", activeClass: "bg-rose-600 text-white hover:bg-rose-700" },
];

const PosProductCard = memo(function PosProductCard({
  product,
  channelPrice,
  qtyInCart,
  onAdd,
}: {
  product: Product;
  channelPrice: number;
  qtyInCart: number;
  onAdd: (product: Product) => void;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-white text-left shadow-xs transition active:scale-[0.97] dark:bg-stone-900 ${
        qtyInCart > 0
          ? "border-orange-500 ring-1 ring-orange-500/40"
          : "border-stone-200 hover:border-orange-400 dark:border-stone-800"
      }`}
    >
      <div className="relative h-28 w-full bg-stone-100 dark:bg-stone-800">
        {product.image_url && !imgBroken ? (
          <img
            src={resolveMediaUrl(product.image_url) ?? ""}
            alt={product.name}
            loading="lazy"
            onError={() => setImgBroken(true)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-300">
            <Utensils className="h-7 w-7" />
          </div>
        )}
        {product.item_type === "combo" && (
          <Badge className="absolute left-2 top-2 bg-amber-500 text-stone-950 hover:bg-amber-500">Combo</Badge>
        )}
        {qtyInCart > 0 && (
          <Badge className="absolute right-2 top-2 bg-orange-600 text-white hover:bg-orange-600">
            ×{qtyInCart}
          </Badge>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-semibold text-stone-900 dark:text-stone-100">{product.name}</p>
        <p className="mt-1 text-sm font-bold text-orange-700 dark:text-orange-400">{formatINR(channelPrice)}</p>
      </div>
    </button>
  );
});

export default function PosTerminalPage() {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { data: currentUser } = useCurrentUser();
  const logoutMutation = useLogout();
  const categoriesQuery = useCategories(false);
  const productsQuery = useProducts({ is_available: true, page_size: 200 });
  const createOrderMutation = useCreateOrder();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 180);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);

  const [orderSource, setOrderSource] = useState<OrderType>("dine_in");
  const [externalOrderNumber, setExternalOrderNumber] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [discountType, setDiscountType] = useState<"none" | "flat" | "percent">("none");
  const [discountValue, setDiscountValue] = useState("0");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const canPrintKot = Boolean(currentUser?.permissions?.includes("pos:print_kot") || currentUser?.role === "franchise_owner");
  const [printKot, setPrintKot] = useState<boolean>(true);
  const [activeReceipt, setActiveReceipt] = useState<OrderReceiptPayload | null>(null);
  const customerLookup = useCustomerLookup(customerPhone);

  useEffect(() => {
    if (!canPrintKot) setPrintKot(false);
  }, [canPrintKot]);

  useEffect(() => {
    setValidationError(null);
  }, [orderSource]);

  const categories = categoriesQuery.data ?? [];
  const allProducts = productsQuery.data?.items ?? [];
  const addons = useMemo(() => allProducts.filter((p) => p.item_type === "addon"), [allProducts]);
  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((l) => map.set(l.product.id, l.quantity));
    return map;
  }, [cart]);

  const visibleProducts = useMemo(
    () =>
      allProducts.filter((p) => {
        if (selectedCategoryId !== "all" && p.category_id !== selectedCategoryId) return false;
        if (debouncedSearch.trim()) {
          const q = debouncedSearch.trim().toLowerCase();
          return p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false);
        }
        return true;
      }),
    [allProducts, selectedCategoryId, debouncedSearch]
  );

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0)
    );
  };

  const totalItemsCount = useMemo(() => cart.reduce((acc, l) => acc + l.quantity, 0), [cart]);
  const subtotal = useMemo(
    () => cart.reduce((acc, l) => acc + getProductChannelPrice(l.product, orderSource) * l.quantity, 0),
    [cart, orderSource]
  );
  const parsedDiscountVal = Number.parseFloat(discountValue) || 0;
  const discountAmount =
    discountType === "flat"
      ? Math.min(parsedDiscountVal, subtotal)
      : discountType === "percent"
      ? Math.min((subtotal * parsedDiscountVal) / 100, subtotal)
      : 0;
  const grandTotal = Math.max(0, subtotal - discountAmount);

  const handleCheckout = () => {
    if (cart.length === 0 || createOrderMutation.isPending) return;
    setValidationError(null);

    if (orderSource === "takeaway") {
      if (!customerName.trim() || !customerPhone.trim()) {
        setValidationError("Customer Name and Customer Phone are required for Take Away orders.");
        return;
      }
    } else if (orderSource === "swiggy" || orderSource === "zomato") {
      const label = orderSource === "swiggy" ? "Swiggy" : "Zomato";
      if (!externalOrderNumber.trim()) {
        setValidationError(`${label} Order Number is required.`);
        return;
      }
      if (!customerName.trim()) {
        setValidationError(`Customer Name is required for ${label} orders.`);
        return;
      }
    }

    createOrderMutation.mutate(
      {
        order_type: orderSource,
        order_source: orderSource,
        external_order_number:
          orderSource === "swiggy" || orderSource === "zomato" ? externalOrderNumber.trim() : undefined,
        table_number: orderSource === "dine_in" && tableNumber.trim() ? tableNumber.trim() : undefined,
        payment_mode: paymentMode,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        discount_type: discountType,
        discount_value: discountType === "none" ? 0 : parsedDiscountVal,
        customer_phone: customerPhone.trim() || undefined,
        customer_name: customerName.trim() || undefined,
        print_kot: canPrintKot && printKot,
      },
      {
        onSuccess: (receipt) => {
          setActiveReceipt(receipt);
          setCart([]);
          setDiscountType("none");
          setDiscountValue("0");
          setCustomerPhone("");
          setCustomerName("");
          setExternalOrderNumber("");
          setTableNumber("");
          setMobileCartOpen(false);
          setTimeout(() => window.print(), 150);
        },
      }
    );
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F8") {
        e.preventDefault();
        handleCheckout();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const activeSourceMeta = ORDER_SOURCES.find((s) => s.key === orderSource) ?? ORDER_SOURCES[0];

  const cartPanelContent = (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-800 dark:bg-stone-900">
        <span className="text-xs font-semibold text-stone-500">Order Source</span>
        <Badge className={activeSourceMeta.activeClass}>
          {activeSourceMeta.emoji} {activeSourceMeta.label}
        </Badge>
      </div>

      {/* Dynamic Order Source Fields */}
      <div className="mb-3 space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-2.5 dark:border-stone-800 dark:bg-stone-900">
        {(orderSource === "swiggy" || orderSource === "zomato") && (
          <Input
            value={externalOrderNumber}
            onChange={(e) => setExternalOrderNumber(e.target.value)}
            placeholder={orderSource === "swiggy" ? "Swiggy Order # (e.g. SW123456789) *" : "Zomato Order # (e.g. ZM987654321) *"}
            className="h-9 bg-white text-sm font-mono uppercase dark:bg-stone-950"
          />
        )}

        <div className="grid grid-cols-2 gap-2">
          <Input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={orderSource === "dine_in" ? "Customer Name (Opt)" : "Customer Name *"}
            className="h-9 bg-white text-sm dark:bg-stone-950"
          />
          <Input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder={orderSource === "takeaway" ? "Phone Number *" : "Phone (Optional)"}
            className="h-9 bg-white text-sm dark:bg-stone-950"
          />
        </div>

        {orderSource === "dine_in" && (
          <Input
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            placeholder="Table Number (Optional, e.g. T-04)"
            className="h-9 bg-white text-sm dark:bg-stone-950"
          />
        )}

        {customerLookup.data && customerLookup.data.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {customerLookup.data.map((cust) => (
              <button
                key={cust.id}
                type="button"
                onClick={() => {
                  setCustomerPhone(cust.phone);
                  setCustomerName(cust.name ?? "");
                }}
                className="rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs text-orange-800 hover:bg-orange-100"
              >
                {cust.phone} · {cust.name ?? "Guest"} ({cust.total_orders} orders)
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {cart.length === 0 ? (
          <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 text-sm text-stone-400">
            <ShoppingCart className="h-8 w-8 opacity-40" />
            <span>Tap menu items to build an order</span>
          </div>
        ) : (
          cart.map((line) => {
            const unitPrice = getProductChannelPrice(line.product, orderSource);
            return (
              <div
                key={line.product.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 p-2.5 dark:border-stone-800"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-stone-100 dark:bg-stone-800">
                  {line.product.image_url ? (
                    <img
                      src={resolveMediaUrl(line.product.image_url) ?? ""}
                      alt={line.product.name}
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-stone-300">
                      <Utensils className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">{line.product.name}</p>
                  <p className="text-xs text-stone-500">{formatINR(unitPrice)} each</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(line.product.id, -1)}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-6 text-center text-sm font-bold">{line.quantity}</span>
                  <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(line.product.id, 1)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="w-20 text-right text-sm font-bold text-stone-900 dark:text-stone-100">
                  {formatINR(unitPrice * line.quantity)}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 space-y-3 border-t border-stone-200 pt-3 dark:border-stone-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={discountType === "none" ? "default" : "outline"}
            onClick={() => {
              setDiscountType("none");
              setDiscountValue("0");
            }}
          >
            No Disc
          </Button>
          <Button type="button" size="sm" variant={discountType === "flat" ? "default" : "outline"} onClick={() => setDiscountType("flat")}>
            ₹ Flat
          </Button>
          <Button type="button" size="sm" variant={discountType === "percent" ? "default" : "outline"} onClick={() => setDiscountType("percent")}>
            % Off
          </Button>
          {discountType !== "none" && (
            <Input
              type="number"
              min="0"
              step="0.01"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="h-8 w-24"
            />
          )}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {(
            [
              { key: "cash", label: "Cash", icon: Banknote },
              { key: "upi", label: "UPI", icon: QrCode },
              { key: "card", label: "Card", icon: CreditCard },
              { key: "split", label: "Split", icon: Split },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={paymentMode === key ? "default" : "outline"}
              className={paymentMode === key ? "bg-orange-600 hover:bg-orange-700" : ""}
              onClick={() => setPaymentMode(key)}
            >
              <Icon className="mr-1 h-3.5 w-3.5" />
              {label}
            </Button>
          ))}
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-stone-600 dark:text-stone-400">
            <span>Subtotal ({totalItemsCount} items)</span>
            <span>{formatINR(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount</span>
              <span>-{formatINR(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-extrabold text-stone-900 dark:text-stone-100">
            <span>Grand Total</span>
            <span>{formatINR(grandTotal)}</span>
          </div>
        </div>

        {(validationError || createOrderMutation.isError) && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {validationError ?? createOrderMutation.error?.detail}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-12" disabled={cart.length === 0} onClick={() => setCart([])} title="Clear Cart">
            <Trash2 className="h-4 w-4" />
          </Button>
          {activeReceipt && (
            <Button type="button" variant="outline" className="h-12" onClick={() => setReceiptPreviewOpen(true)} title="Last Receipt Preview">
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            disabled={cart.length === 0 || createOrderMutation.isPending}
            onClick={handleCheckout}
            className="h-12 flex-1 bg-orange-600 text-base font-bold hover:bg-orange-700"
          >
            {createOrderMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              `Charge ${formatINR(grandTotal)} (F8)`
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="no-print flex h-screen flex-col bg-stone-100 dark:bg-stone-950">
        {/* Top POS Header with Order Source Selector */}
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-2.5 shadow-xs dark:border-stone-800 dark:bg-stone-900">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-extrabold tracking-tight text-orange-600">BURGER CALLING</span>
            {currentUser?.franchise && (
              <Badge className="hidden bg-stone-900 text-white hover:bg-stone-900 sm:inline-flex">
                {currentUser.franchise.outlet_code}
              </Badge>
            )}
          </div>

          {/* Order Source Selector */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 p-1 dark:border-stone-800 dark:bg-stone-950">
            {ORDER_SOURCES.map((src) => {
              const isSelected = orderSource === src.key;
              return (
                <button
                  key={src.key}
                  type="button"
                  onClick={() => setOrderSource(src.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    isSelected
                      ? `${src.activeClass} shadow-xs`
                      : "text-stone-600 hover:bg-white dark:text-stone-300 dark:hover:bg-stone-800"
                  }`}
                >
                  <span>{src.emoji}</span>
                  <span>{src.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 dark:border-stone-700 dark:bg-stone-800">
              <Printer className="h-4 w-4 text-stone-600 dark:text-stone-300" />
              <span className="hidden text-xs font-semibold text-stone-700 dark:text-stone-200 sm:inline">
                KOT
              </span>
              <Switch checked={printKot} disabled={!canPrintKot} onCheckedChange={setPrintKot} />
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => logoutMutation.mutate()}>
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </header>

        {/* Desktop 3-Column Layout | Tablet/Mobile Adaptive */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[200px_1fr_390px]">
          <aside className="hidden flex-col gap-1.5 overflow-y-auto border-r border-stone-200 bg-white p-3 lg:flex dark:border-stone-800 dark:bg-stone-900">
            <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-stone-400">Categories</p>
            <button
              type="button"
              onClick={() => setSelectedCategoryId("all")}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                selectedCategoryId === "all"
                  ? "bg-orange-600 text-white shadow-xs"
                  : "text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
              }`}
            >
              <span>All Items</span>
              <ChevronRight className="h-4 w-4 opacity-70" />
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                  selectedCategoryId === cat.id
                    ? "bg-orange-600 text-white shadow-xs"
                    : "text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                }`}
              >
                <span className="truncate">{cat.name}</span>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
              </button>
            ))}
          </aside>

          <section className="flex flex-1 flex-col overflow-hidden p-3 pb-20 sm:p-4 lg:pb-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search menu items or SKU (F2)..."
                  className="h-11 bg-white pl-9 dark:bg-stone-900"
                />
              </div>
            </div>

            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              <Button
                type="button"
                size="sm"
                variant={selectedCategoryId === "all" ? "default" : "outline"}
                className={selectedCategoryId === "all" ? "shrink-0 bg-orange-600 hover:bg-orange-700" : "shrink-0 bg-white"}
                onClick={() => setSelectedCategoryId("all")}
              >
                All Items
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  type="button"
                  size="sm"
                  variant={selectedCategoryId === cat.id ? "default" : "outline"}
                  className={selectedCategoryId === cat.id ? "shrink-0 bg-orange-600 hover:bg-orange-700" : "shrink-0 bg-white"}
                  onClick={() => setSelectedCategoryId(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>

            {addons.length > 0 && (
              <div className="mb-3 flex items-center gap-2 overflow-x-auto rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/30">
                <span className="shrink-0 text-xs font-bold uppercase text-emerald-800 dark:text-emerald-400">Quick Add-ons:</span>
                {addons.map((addon) => (
                  <Button
                    key={addon.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 border-emerald-300 bg-white text-xs hover:bg-emerald-100 dark:bg-stone-900"
                    onClick={() => addToCart(addon)}
                  >
                    + {addon.name} ({formatINR(getProductChannelPrice(addon, orderSource))})
                  </Button>
                ))}
              </div>
            )}

            <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
              {productsQuery.isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)
              ) : (
                visibleProducts.map((product) => (
                  <PosProductCard
                    key={product.id}
                    product={product}
                    channelPrice={getProductChannelPrice(product, orderSource)}
                    qtyInCart={cartQtyMap.get(product.id) ?? 0}
                    onAdd={addToCart}
                  />
                ))
              )}
            </div>
          </section>

          <aside className="hidden flex-col border-l border-stone-200 bg-white p-4 lg:flex dark:border-stone-800 dark:bg-stone-900">
            {cartPanelContent}
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-stone-200 bg-white px-4 py-3 shadow-lg lg:hidden dark:border-stone-800 dark:bg-stone-900">
          <div>
            <p className="text-xs text-stone-500">
              {activeSourceMeta.emoji} {activeSourceMeta.label} · {totalItemsCount} items
            </p>
            <p className="text-base font-extrabold text-stone-900 dark:text-stone-100">{formatINR(grandTotal)}</p>
          </div>
          <Button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="h-11 bg-orange-600 px-5 font-bold hover:bg-orange-700"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Cart &amp; Checkout
          </Button>
        </div>

        <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
          <SheetContent className="flex w-full flex-col p-4 sm:max-w-md">
            <SheetHeader className="pb-2">
              <SheetTitle>Current Order ({totalItemsCount} items)</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">{cartPanelContent}</div>
          </SheetContent>
        </Sheet>

        <Dialog open={receiptPreviewOpen} onOpenChange={setReceiptPreviewOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Thermal Receipt Preview</DialogTitle>
            </DialogHeader>
            <div className="rounded-lg border border-stone-200 bg-white p-3 text-stone-900">
              <ThermalReceipt receipt={activeReceipt} includeKot={canPrintKot && printKot} />
            </div>
            <Button type="button" onClick={() => window.print()} className="w-full bg-orange-600 hover:bg-orange-700">
              <Printer className="mr-2 h-4 w-4" />
              Print Receipt
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="thermal-print-portal">
        <ThermalReceipt receipt={activeReceipt} includeKot={canPrintKot && printKot} />
      </div>
    </>
  );
}
