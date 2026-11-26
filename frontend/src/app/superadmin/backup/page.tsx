"use client";

import { AlertTriangle, Download, Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRestoreDatabase } from "@/hooks/use-system";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export default function SuperAdminBackupPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const restoreMutation = useRestoreDatabase();

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div><h1 className="text-2xl font-bold tracking-tight text-stone-900">Database Backup &amp; Restore</h1><p className="text-sm text-stone-500">Export checksum-verified PostgreSQL snapshots or perform an atomic restore.</p></div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-lg">Export Full Snapshot</CardTitle><CardDescription>Downloads all outlets, users, menu items, inventory, stock requests, and bills as JSON.</CardDescription></CardHeader>
            <CardContent><Button type="button" onClick={() => window.open(`${API_BASE_URL}/system/backup`, "_blank", "noopener")} className="w-full bg-orange-600 hover:bg-orange-700"><Download className="mr-2 h-4 w-4" />Download Backup JSON</Button></CardContent>
          </Card>
          <Card className="border-amber-200">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg text-amber-900"><AlertTriangle className="h-5 w-5 text-amber-600" />Verified Restore</CardTitle><CardDescription>Replaces current operational tables after verifying schema version &amp; SHA-256 checksum.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPendingFile(f); setConfirmText(""); } e.target.value = ""; }} />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full border-amber-300 hover:bg-amber-50"><UploadCloud className="mr-2 h-4 w-4" />Select Backup JSON to Restore</Button>
              {restoreMutation.isSuccess && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{restoreMutation.data.message}</div>}
              {restoreMutation.isError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{restoreMutation.error.detail}</div>}
            </CardContent>
          </Card>
        </div>
        <Dialog open={Boolean(pendingFile)} onOpenChange={(open) => { if (!open) { setPendingFile(null); setConfirmText(""); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Confirm Database Restore</DialogTitle><DialogDescription>You are about to restore <strong>{pendingFile?.name}</strong>. Type <strong>RESTORE</strong> to proceed.</DialogDescription></DialogHeader>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type RESTORE to confirm" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPendingFile(null)}>Cancel</Button>
              <Button type="button" variant="destructive" disabled={confirmText !== "RESTORE" || restoreMutation.isPending} onClick={() => { if (pendingFile && confirmText === "RESTORE") restoreMutation.mutate(pendingFile, { onSuccess: () => { setPendingFile(null); setConfirmText(""); } }); }}>
                {restoreMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Execute Restore
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
