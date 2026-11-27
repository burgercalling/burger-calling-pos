"use client";

import { ORDER_SOURCE_LABELS, type OrderReceiptPayload } from "@/types/pos";

export function ThermalReceipt({ receipt, includeKot }: { receipt: OrderReceiptPayload | null; includeKot: boolean }) {
  if (!receipt) return null;
  const { order, cashier_name, is_duplicate, receipt_settings } = receipt;
  const widthClass =
    receipt_settings.printer_width_mode === "58mm"
      ? "thermal-width-58mm"
      : receipt_settings.printer_width_mode === "80mm"
      ? "thermal-width-80mm"
      : "thermal-width-auto";
  const sym = receipt_settings.currency_symbol;
  const showDuplicate = is_duplicate || order.reprint_count > 0;
  const formattedTime = new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
  const sourceKey = (order.order_source || order.order_type || "dine_in").toLowerCase();
  const sourceLabel = ORDER_SOURCE_LABELS[sourceKey] ?? sourceKey.replace("_", " ").toUpperCase();
  const customerName = order.customer?.name || order.customer_name_snapshot;
  const customerPhone = order.customer?.phone;

  return (
    <div className={`thermal-print-root ${widthClass}`}>
      <div className="text-center">
        <div className="text-sm font-bold uppercase">{receipt_settings.brand_name}</div>
        <div className="text-[10px] font-semibold">{receipt_settings.outlet_name} ({receipt_settings.outlet_code})</div>
        <div className="text-[10px]">{receipt_settings.outlet_address}</div>
        <div className="text-[10px]">Ph: {receipt_settings.outlet_phone}</div>
        {receipt_settings.tax_enabled && receipt_settings.gstin && <div className="text-[10px]">GSTIN: {receipt_settings.gstin}</div>}
        {showDuplicate && <div className="mt-1 border border-black py-0.5 text-[10px] font-bold">[DUPLICATE COPY]</div>}
      </div>
      <div className="thermal-divider" />
      <div className="text-[10px]">
        <div className="flex justify-between">
          <span>Bill: {order.bill_number}</span>
          <span className="font-bold uppercase">{sourceLabel}</span>
        </div>
        {order.external_order_number && (
          <div className="font-bold">
            {sourceLabel} Order #: {order.external_order_number}
          </div>
        )}
        {order.table_number && <div>Table #: {order.table_number}</div>}
        <div className="flex justify-between">
          <span>Date: {formattedTime}</span>
          <span className="uppercase">{order.payment_mode}</span>
        </div>
        <div>Cashier: {cashier_name}</div>
        {(customerName || customerPhone) && (
          <div>
            Customer: {customerName ?? "Guest"}
            {customerPhone ? ` (${customerPhone})` : ""}
          </div>
        )}
      </div>
      <div className="thermal-divider" />
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-dashed border-black text-left">
            <th className="py-0.5">Item</th>
            <th className="py-0.5 text-center">Qty</th>
            <th className="py-0.5 text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td className="py-0.5 pr-1">{item.product_name_snapshot}</td>
              <td className="py-0.5 text-center">{item.quantity}</td>
              <td className="py-0.5 text-right">{sym}{item.line_total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="thermal-divider" />
      <div className="space-y-0.5 text-[10px]">
        <div className="flex justify-between"><span>Subtotal</span><span>{sym}{order.subtotal}</span></div>
        {Number.parseFloat(order.discount_amount) > 0 && (
          <div className="flex justify-between"><span>Discount</span><span>-{sym}{order.discount_amount}</span></div>
        )}
        {receipt_settings.tax_enabled && (
          <div className="flex justify-between">
            <span>{receipt_settings.tax_label} ({receipt_settings.tax_rate}%)</span>
            <span>{sym}{order.tax_amount}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-dashed border-black pt-1 text-xs font-bold">
          <span>GRAND TOTAL</span>
          <span>{sym}{order.grand_total}</span>
        </div>
      </div>
      <div className="thermal-divider" />
      <div className="text-center text-[10px]"><p>{receipt_settings.receipt_footer}</p></div>
      {includeKot && order.kot_printed && (
        <div className="kot-page-break pt-2">
          <div className="text-center">
            <div className="text-xs font-bold uppercase">*** KITCHEN ORDER TICKET ***</div>
            <div className="text-[11px] font-bold">
              {order.bill_number} · {sourceLabel.toUpperCase()}
            </div>
            {order.external_order_number && (
              <div className="text-[11px] font-bold">#{order.external_order_number}</div>
            )}
            {order.table_number && <div className="text-[10px] font-bold">Table: {order.table_number}</div>}
            <div className="text-[10px]">{formattedTime}</div>
          </div>
          <div className="thermal-divider" />
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-dashed border-black text-left">
                <th className="py-0.5">Item</th>
                <th className="py-0.5 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={`kot-${item.id}`} className="font-bold">
                  <td className="py-1 pr-2">{item.product_name_snapshot}</td>
                  <td className="py-1 text-right">x{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="thermal-divider" />
          <div className="text-center text-[10px]">100% PURE VEG · KOT #{order.daily_sequence}</div>
        </div>
      )}
    </div>
  );
}
