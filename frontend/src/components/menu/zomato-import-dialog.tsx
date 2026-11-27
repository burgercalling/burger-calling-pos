"use client";

import { CheckCircle2, Loader2, Sparkles, Upload } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useZomatoImport } from "@/hooks/use-menu";
import type { BulkImportCommitResponse, ZomatoImportRowInput } from "@/types/menu";

function parseCsvText(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const splitCsvLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = splitCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] ?? "";
    });
    return obj;
  });
}

function autoPickColumn(cols: string[], candidates: string[]): string {
  const lowerMap = new Map(cols.map((c) => [c.toLowerCase().trim(), c]));
  for (const cand of candidates) {
    const found = lowerMap.get(cand);
    if (found) return found;
  }
  return "";
}

export function ZomatoImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const zomatoMutation = useZomatoImport();

  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState({
    name: "",
    price: "",
    category: "",
    description: "",
    image_url: "",
    sku: "",
  });
  const [updateExisting, setUpdateExisting] = useState(false);
  const [result, setResult] = useState<BulkImportCommitResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setErrorMsg(null);
    setResult(null);

    try {
      let parsed: Record<string, string>[] = [];
      if (file.name.toLowerCase().endsWith(".json")) {
        const text = await file.text();
        const json = JSON.parse(text);
        const arr = Array.isArray(json) ? json : json.items || json.menu || [];
        parsed = arr.map((item: Record<string, unknown>) => {
          const rec: Record<string, string> = {};
          Object.entries(item).forEach(([k, v]) => {
            rec[k] = v !== null && v !== undefined ? String(v) : "";
          });
          return rec;
        });
      } else if (file.name.toLowerCase().endsWith(".csv")) {
        parsed = parseCsvText(await file.text());
      } else {
        setErrorMsg("For Zomato Wizard, please upload a .csv or .json menu export (or use Bulk Import for .xlsx).");
        return;
      }

      if (parsed.length === 0) {
        setErrorMsg("No menu items found in the uploaded file.");
        return;
      }

      const cols = Object.keys(parsed[0]);
      setColumns(cols);
      setRawRows(parsed);
      setMapping({
        name: autoPickColumn(cols, ["zomato name", "item name", "name", "product name", "title"]),
        price: autoPickColumn(cols, ["zomato price", "selling price", "price", "base price"]),
        category: autoPickColumn(cols, ["category", "category name", "menu category", "section"]),
        description: autoPickColumn(cols, ["description", "item description", "desc"]),
        image_url: autoPickColumn(cols, ["image url", "zomato image", "image", "photo url"]),
        sku: autoPickColumn(cols, ["sku", "item id", "code"]),
      });
    } catch {
      setErrorMsg("Could not parse file. Ensure it is valid CSV or JSON.");
    }
  };

  const mappedRows: ZomatoImportRowInput[] = rawRows
    .map((r) => {
      const rawPrice = Number.parseFloat((r[mapping.price] ?? "").replace(/[^0-9.]/g, ""));
      return {
        category: (r[mapping.category] || "Zomato Specials").trim(),
        name: (r[mapping.name] || "").trim(),
        description: mapping.description ? r[mapping.description]?.trim() || null : null,
        price: Number.isNaN(rawPrice) ? 0 : rawPrice,
        image_url: mapping.image_url ? r[mapping.image_url]?.trim() || null : null,
        sku: mapping.sku ? r[mapping.sku]?.trim().toUpperCase() || null : null,
        is_available: true,
        item_type: "regular" as const,
      };
    })
    .filter((r) => r.name.length >= 2 && r.price > 0);

  const handleImport = () => {
    if (mappedRows.length === 0) {
      setErrorMsg("No valid records after field mapping. Check Name and Price columns.");
      return;
    }
    setErrorMsg(null);
    zomatoMutation.mutate(
      { rows: mappedRows, update_existing: updateExisting },
      {
        onSuccess: (res) => setResult(res),
        onError: (err) => setErrorMsg(err.detail),
      }
    );
  };

  const resetAndClose = () => {
    setRawRows([]);
    setColumns([]);
    setResult(null);
    setErrorMsg(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-rose-600" />
            Import Existing Zomato Menu Wizard
          </DialogTitle>
          <DialogDescription>
            Upload your Zomato CSV or JSON menu export, map fields to Burger Calling POS, and import without creating duplicates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {errorMsg && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {result ? (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5">
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
                <h3 className="font-semibold">Zomato Menu Imported</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-white p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{result.imported}</p>
                  <p className="text-xs text-stone-500">Imported</p>
                </div>
                <div className="rounded-lg bg-white p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                  <p className="text-xs text-stone-500">Updated</p>
                </div>
                <div className="rounded-lg bg-white p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
                  <p className="text-xs text-stone-500">Duplicates Skipped</p>
                </div>
                <div className="rounded-lg bg-white p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{result.failed}</p>
                  <p className="text-xs text-stone-500">Failed</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-rose-300 bg-rose-50/40 p-4">
                <div>
                  <p className="text-sm font-medium text-stone-800">Step 1: Upload Zomato Menu Export (.csv or .json)</p>
                  <p className="text-xs text-stone-500">Images will be downloaded and stored locally on the POS server.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-700">
                  <Upload className="h-3.5 w-3.5" />
                  Select Zomato File
                  <input
                    type="file"
                    accept=".csv,.json"
                    className="hidden"
                    onChange={(e) => {
                      handleFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {columns.length > 0 && (
                <>
                  <div className="space-y-3 rounded-xl border border-stone-200 p-4">
                    <p className="text-sm font-semibold text-stone-800">Step 2: Map Zomato Fields</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {(
                        [
                          ["name", "Product Name *"],
                          ["price", "Selling Price *"],
                          ["category", "Category"],
                          ["description", "Description"],
                          ["image_url", "Image URL"],
                          ["sku", "SKU / Code"],
                        ] as const
                      ).map(([field, label]) => (
                        <div key={field} className="space-y-1">
                          <Label className="text-xs">{label}</Label>
                          <Select
                            value={mapping[field] || "__none__"}
                            onValueChange={(v) =>
                              setMapping((prev) => ({ ...prev, [field]: v === "__none__" ? "" : v }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Skip —</SelectItem>
                              {columns.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                      <Badge variant="outline">Valid Mapped Items: {mappedRows.length}</Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-600">Overwrite existing items</span>
                        <Switch checked={updateExisting} onCheckedChange={setUpdateExisting} />
                      </div>
                    </div>
                  </div>

                  <div className="max-h-56 overflow-auto rounded-lg border border-stone-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Price (₹)</TableHead>
                          <TableHead>Image URL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mappedRows.slice(0, 25).map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{r.category}</TableCell>
                            <TableCell className="text-xs font-medium">{r.name}</TableCell>
                            <TableCell className="text-xs">{r.price}</TableCell>
                            <TableCell className="max-w-[180px] truncate text-xs text-stone-500">
                              {r.image_url || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={resetAndClose}>
            {result ? "Done" : "Cancel"}
          </Button>
          {!result && rawRows.length > 0 && (
            <Button
              type="button"
              onClick={handleImport}
              disabled={zomatoMutation.isPending || mappedRows.length === 0}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {zomatoMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {mappedRows.length} Zomato Items
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
