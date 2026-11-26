import { Check, XCircle } from "lucide-react";

import type { StockRequestStatus } from "@/types/stock-request";

const STEPS: { key: StockRequestStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "packed", label: "Packed" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
];

export function StockRequestStatusStepper({ status }: { status: StockRequestStatus }) {
  if (status === "rejected") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
        <XCircle className="h-3.5 w-3.5" />Rejected
      </div>
    );
  }
  const currentIdx = STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STEPS.map((step, idx) => {
        const completed = idx <= currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-1.5">
            <div className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${completed ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-400"}`}>
              {completed && <Check className="h-3 w-3" />}{step.label}
            </div>
            {idx < STEPS.length - 1 && <span className="text-xs text-stone-300">→</span>}
          </div>
        );
      })}
    </div>
  );
}
