"use client";

import { Banknote, CreditCard, Loader2, LogOut, Minus, Plus, Printer, QrCode, Search, ShoppingBag, Split, Trash2, Utensils } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ThermalReceipt } from "@/components/pos/thermal-receipt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { useCategories, useProducts } from "@/hooks/use-menu";
import { useCreateOrder, useCustomerLookup } from "@/hooks/use-pos";
import { resolveMediaUrl } from "@/lib/api";
import { formatINR, type Product } from "@/types/menu";
import type { OrderReceiptPayload, OrderType, PaymentMode } from "@/types/pos";

interface CartLine { product: Product; quantity: number }

export default function PosTerminalPage() {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { data: currentUser } = useCurrentUser();
  const logoutMutation = useLogout();
  const categoriesQuery = useCategories(false);
  const productsQuery = useProducts({ is_available: true, page_size: 200 });
  const createOrderMutation = useCreateOrder();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [discountType, setDiscountType] = useState<"none" | "flat" | "percent">("none");
  const [discountValue, setDiscountValue] = useState("0");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const canPrintKot = Boolean(currentUser?.permissions?.includes("pos:print_kot") || currentUser?.role === "franchise_owner");
  const [printKot, setPrintKot] = useState<boolean>(true);
  const [activeReceipt, setActiveReceipt] = useState<OrderReceiptPayload | null>(null);
  const customerLookup = useCustomerLookup(customerPhone);

  useEffect(() => { if (!canPrintKot) setPrintKot(false); }, [canPrintKot]);

  const categories = categoriesQuery.data ?? [];
  const allProducts = productsQuery.data?.items ?? [];
  const addons = useMemo(() => allProducts.filter((p) => p.item_type === "addon"), [allProducts]);
  const visibleProducts = useMemo(() => allProducts.filter((p) => {
    if (selectedCategoryId !== "all" && p.category_id !== selectedCategoryId) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false);
    }
    return true;
  }), [allProducts, selectedCategoryId, search]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => prev.map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0));
  };

  const subtotal = useMemo(() => cart.reduce((acc, l) => acc + Number.parseFloat(l.product.price) * l.quantity, 0), [cart]);
  const parsedDiscountVal = Number.parseFloat(discountValue) || 0;
  const discountAmount = discountType === "flat" ? Math.min(parsedDiscountVal, subtotal) : discountType === "percent" ? Math.min((subtotal * parsedDiscountVal) / 100, subtotal) : 0;
  const grandTotal = Math.max(0, subtotal - discountAmount);

  const handleCheckout = () => {
    if (cart.length === 0 || createOrderMutation.isPending) return;
    createOrderMutation.mutate(
      {
        order_type: orderType, payment_mode: paymentMode,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        discount_type: discountType, discount_value: discountType === "none" ? 0 : parsedDiscountVal,
        customer_phone: customerPhone.trim() || undefined, customer_name: customerName.trim() || undefined,
        print_kot: canPrintKot && printKot,
      },
      {
        onSuccess: (receipt) => {
          setActiveReceipt(receipt);
          setCart([]); setDiscountType("none"); setDiscountValue("0"); setCustomerPhone(""); setCustomerName("");
          setTimeout(() => window.print(), 150);
        },
      }
    );
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); searchInputRef.current?.focus(); }
      else if (e.key === "F8") { e.preventDefault(); handleCheckout(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <>
      <div className="no-print flex h-screen flex-col bg-stone-100">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-lg font-extrabold tracking-tight text-orange-600">BURGER CALLING</span>
            {currentUser?.franchise && <Badge className="bg-stone-900 text-white hover:bg-stone-900">{currentUser.franchise.outlet_code} · {currentUser.franchise.name}</Badge>}
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">100% Pure Veg</Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5">
              <Printer className="h-4 w-4 text-stone-600" />
              <span className="text-xs font-semibold text-stone-700">Print KOT: {printKot ? "ON" : "OFF"}</span>
              <Switch checked={printKot} disabled={!canPrintKot} onCheckedChange={setPrintKot} />
            </div>
            <span className="hidden text-sm font-medium text-stone-600 sm:inline">{currentUser?.full_name}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => logoutMutation.mutate()}><LogOut className="mr-1.5 h-4 w-4" />Sign Out</Button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <section className="flex flex-1 flex-col overflow-hidden p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input ref={searchInputRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu items or SKU (F2)..." className="h-11 bg-white pl-9" />
              </div>
            </div>
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              <Button type="button" size="sm" variant={selectedCategoryId === "all" ? "default" : "outline"} className={selectedCategoryId === "all" ? "bg-orange-600 hover:bg-orange-700" : "bg-white"} onClick={() => setSelectedCategoryId("all")}>All Items</Button>
              {categories.map((cat) => (
                <Button key={cat.id} type="button" size="sm" variant={selectedCategoryId === cat.id ? "default" : "outline"} className={selectedCategoryId === cat.id ? "bg-orange-600 hover:bg-orange-700" : "bg-white"} onClick={() => setSelectedCategoryId(cat.id)}>{cat.name}</Button>
              ))}
            </div>
            {addons.length > 0 && (
              <div className="mb-3 flex items-center gap-2 overflow-x-auto rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                <span className="shrink-0 text-xs font-bold uppercase text-emerald-800">Quick Add-ons:</span>
                {addons.map((addon) => (
                  <Button key={addon.id} type="button" size="sm" variant="outline" className="h-7 shrink-0 border-emerald-300 bg-white text-xs hover:bg-emerald-100" onClick={() => addToCart(addon)}>+ {addon.name} ({formatINR(addon.price)})</Button>
                ))}
              </div>
            )}
            <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
              {visibleProducts.map((product) => (
                <button key={product.id} type="button" onClick={() => addToCart(product)} className="flex flex-col justify-between overflow-hidden rounded-xl border border-stone-200 bg-white text-left shadow-sm transition active:scale-[0.98] hover:border-orange-400">
                  <div className="relative h-28 w-full bg-stone-100">
                    {product.image_url ? <img src={resolveMediaUrl(product.image_url) ?? ""} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-stone-300"><Utensils className="h-7 w-7" /></div>}
                    {product.item_type === "combo" && <Badge className="absolute left-2 top-2 bg-amber-500 text-stone-950 hover:bg-amber-500">Combo</Badge>}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-stone-900">{product.name}</p>
                    <p className="mt-1 text-sm font-bold text-orange-700">{formatINR(product.price)}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <aside className="flex w-full max-w-md flex-col border-l border-stone-200 bg-white p-4">
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Button type="button" variant={orderType === "dine_in" ? "default" : "outline"} className={orderType === "dine_in" ? "bg-stone-900 hover:bg-stone-800" : ""} onClick={() => setOrderType("dine_in")}><Utensils className="mr-1.5 h-4 w-4" />Dine-In</Button>
              <Button type="button" variant={orderType === "takeaway" ? "default" : "outline"} className={orderType === "takeaway" ? "bg-stone-900 hover:bg-stone-800" : ""} onClick={() => setOrderType("takeaway")}><ShoppingBag className="mr-1.5 h-4 w-4" />Takeaway</Button>
            </div>
            <div className="mb-3 space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Customer Phone" className="h-9 bg-white text-sm" />
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Name (Optional)" className="h-9 bg-white text-sm" />
              </div>
              {customerLookup.data && customerLookup.data.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {customerLookup.data.map((cust) => (
                    <button key={cust.id} type="button" onClick={() => { setCustomerPhone(cust.phone); setCustomerName(cust.name ?? ""); }} className="rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs text-orange-800 hover:bg-orange-100">
                      {cust.phone} · {cust.name ?? "Guest"} ({cust.total_orders} orders)
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {cart.length === 0 ? <div className="flex h-full items-center justify-center text-sm text-stone-400">Tap menu items to build an order</div> : cart.map((line) => (
                <div key={line.product.id} className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 p-2.5">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-stone-900">{line.product.name}</p><p className="text-xs text-stone-500">{formatINR(line.product.price)} each</p></div>
                  <div className="flex items-center gap-1.5">
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(line.product.id, -1)}><Minus className="h-3.5 w-3.5" /></Button>
                    <span className="w-6 text-center text-sm font-bold">{line.quantity}</span>
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(line.product.id, 1)}><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="w-20 text-right text-sm font-bold text-stone-900">{formatINR(Number.parseFloat(line.product.price) * line.quantity)}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-3 border-t border-stone-200 pt-3">
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant={discountType === "none" ? "default" : "outline"} onClick={() => { setDiscountType("none"); setDiscountValue("0"); }}>No Disc</Button>
                <Button type="button" size="sm" variant={discountType === "flat" ? "default" : "outline"} onClick={() => setDiscountType("flat")}>₹ Flat</Button>
                <Button type="button" size="sm" variant={discountType === "percent" ? "default" : "outline"} onClick={() => setDiscountType("percent")}>% Off</Button>
                {discountType !== "none" && <Input type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="h-8 w-24" />}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {([{ key: "cash", label: "Cash", icon: Banknote }, { key: "upi", label: "UPI", icon: QrCode }, { key: "card", label: "Card", icon: CreditCard }, { key: "split", label: "Split", icon: Split }] as const).map(({ key, label, icon: Icon }) => (
                  <Button key={key} type="button" size="sm" variant={paymentMode === key ? "default" : "outline"} className={paymentMode === key ? "bg-orange-600 hover:bg-orange-700" : ""} onClick={() => setPaymentMode(key)}><Icon className="mr-1 h-3.5 w-3.5" />{label}</Button>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-stone-600"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
                {discountAmount > 0 && <div className="flex justify-between text-emerald-700"><span>Discount</span><span>-{formatINR(discountAmount)}</span></div>}
                <div className="flex justify-between text-lg font-extrabold text-stone-900"><span>Grand Total</span><span>{formatINR(grandTotal)}</span></div>
              </div>
              {createOrderMutation.isError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{createOrderMutation.error.detail}</div>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-12" disabled={cart.length === 0} onClick={() => setCart([])}><Trash2 className="h-4 w-4" /></Button>
                <Button type="button" disabled={cart.length === 0 || createOrderMutation.isPending} onClick={handleCheckout} className="h-12 flex-1 bg-orange-600 text-base font-bold hover:bg-orange-700">
                  {createOrderMutation.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Processing...</> : `Charge ${formatINR(grandTotal)} & Print (F8)`}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
      <div className="thermal-print-portal"><ThermalReceipt receipt={activeReceipt} includeKot={canPrintKot && printKot} /></div>
    </>
  );
}
