"use client";

import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBulkImportCommit, useBulkImportPreview } from "@/hooks/use-menu";
import type { BulkImportCommitResponse, BulkImportPreviewResponse } from "@/types/menu";

const SAMPLE_CSV = `Category,Product Name,Description,Dine In Price,Take Away Price,Swiggy Price,Zomato Price,Cost Price,Image URL,Available,SKU,Tax
Burgers,Classic Veg Burger,Crispy veg patty with signature sauce,89,89,109,109,35,,true,BC-001,5
Burgers,Double Cheese Burger,Double patty with cheddar slice,139,139,159,159,55,,true,BC-002,5
Sides,Peri Peri Fries,Crispy fries tossed in peri peri spice,79,79,99,99,28,,true,BC-003,5`;

export function BulkImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const previewMutation = useBulkImportPreview();
  const commitMutation = useBulkImportCommit();

  const [preview, setPreview] = useState<BulkImportPreviewResponse | null>(null);
  const [result, setResult] = useState<BulkImportCommitResponse | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    setErrorMsg(null);
    setResult(null);
    previewMutation.mutate(file, {
      onSuccess: (data) => setPreview(data),
      onError: (err) => setErrorMsg(err.detail),
    });
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "burger-calling-bulk-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCommit = () => {
    if (!preview) return;
    setErrorMsg(null);
    commitMutation.mutate(
      { rows: preview.rows, update_existing: updateExisting },
      {
        onSuccess: (res) => setResult(res),
        onError: (err) => setErrorMsg(err.detail),
      }
    );
  };

  const resetAndClose = () => {
    setPreview(null);
    setResult(null);
    setErrorMsg(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-orange-600" />
            Bulk Product Import (Excel / CSV)
          </DialogTitle>
          <DialogDescription>
            Import products with Dine In, Take Away, Swiggy, and Zomato prices. External Image URLs are downloaded locally.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {errorMsg && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {result ? (
            <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
                <h3 className="font-semibold">Import Completed</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-white p-3 text-center shadow-xs">
                  <p className="text-2xl font-bold text-emerald-700">{result.imported}</p>
                  <p className="text-xs text-stone-500">Imported</p>
                </div>
                <div className="rounded-lg bg-white p-3 text-center shadow-xs">
                  <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                  <p className="text-xs text-stone-500">Updated</p>
                </div>
                <div className="rounded-lg bg-white p-3 text-center shadow-xs">
                  <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
                  <p className="text-xs text-stone-500">Skipped</p>
                </div>
                <div className="rounded-lg bg-white p-3 text-center shadow-xs">
                  <p className="text-2xl font-bold text-red-700">{result.failed}</p>
                  <p className="text-xs text-stone-500">Failed</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-lg bg-white p-3 text-xs text-red-700">
                  <p className="mb-1 font-semibold">Row Notes / Errors:</p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50/70 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-stone-800">Upload .xlsx or .csv file</p>
                  <p className="text-xs text-stone-500">
                    Columns: Category, Product Name, Description, Dine In Price, Take Away Price, Swiggy Price, Zomato Price, Cost Price, Image URL, Available, SKU, Tax
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleDownloadSample}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Sample CSV
                  </Button>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-orange-600 px-3 py-2 text-xs font-medium text-white hover:bg-orange-700">
                    {previewMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Choose File
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xlsm"
                      className="hidden"
                      onChange={(e) => {
                        handleFileChange(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              {preview && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">Total: {preview.total_rows}</Badge>
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">New: {preview.valid_creates}</Badge>
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Updates: {preview.valid_updates}</Badge>
                      {preview.errors > 0 && (
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Errors: {preview.errors}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-600">Update existing SKUs/names</span>
                      <Switch checked={updateExisting} onCheckedChange={setUpdateExisting} />
                    </div>
                  </div>

                  <div className="max-h-72 overflow-auto rounded-lg border border-stone-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Dine In</TableHead>
                          <TableHead>Take Away</TableHead>
                          <TableHead>Swiggy</TableHead>
                          <TableHead>Zomato</TableHead>
                          <TableHead>Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.rows.slice(0, 100).map((r) => (
                          <TableRow key={r.row_number}>
                            <TableCell className="text-xs text-stone-500">{r.row_number}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  r.status === "create"
                                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                                    : r.status === "update"
                                    ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                                    : "bg-red-100 text-red-800 hover:bg-red-100"
                                }
                              >
                                {r.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{r.category}</TableCell>
                            <TableCell className="text-xs font-medium">{r.name}</TableCell>
                            <TableCell className="text-xs">{r.dine_in_price ?? r.price ?? "-"}</TableCell>
                            <TableCell className="text-xs">{r.takeaway_price ?? "-"}</TableCell>
                            <TableCell className="text-xs">{r.swiggy_price ?? "-"}</TableCell>
                            <TableCell className="text-xs">{r.zomato_price ?? "-"}</TableCell>
                            <TableCell className="text-xs text-red-600">{r.error ?? ""}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={resetAndClose}>
            {result ? "Done" : "Cancel"}
          </Button>
          {!result && preview && (
            <Button
              type="button"
              onClick={handleCommit}
              disabled={commitMutation.isPending || (preview.valid_creates === 0 && preview.valid_updates === 0)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {commitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {preview.valid_creates + (updateExisting ? preview.valid_updates : 0)} Products
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
