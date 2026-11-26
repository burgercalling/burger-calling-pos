"use client";

import { Eye, Loader2, Search } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActivityLogs, useAuditLogs } from "@/hooks/use-system";
import type { AuditLogEntry } from "@/types/system";

const ACTIVITY_FILTERS = [
  { key: "", label: "All Events" }, { key: "LOGIN", label: "Login" },
  { key: "BILL_CREATED", label: "Bills" }, { key: "RECEIPT_REPRINTED", label: "Reprints" },
  { key: "STOCK_REQUESTED", label: "Stock Requests" }, { key: "SETTINGS_CHANGE", label: "Settings" },
];

export default function SuperAdminLogsPage() {
  const [tab, setTab] = useState<"audit" | "activity">("audit");
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [selectedDiff, setSelectedDiff] = useState<AuditLogEntry | null>(null);

  const auditQuery = useAuditLogs({ search: search || undefined });
  const activityQuery = useActivityLogs({ search: search || undefined, event_type: eventFilter || undefined });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-2xl font-bold tracking-tight text-stone-900">Audit &amp; Activity Logs</h1><p className="text-sm text-stone-500">Inspect immutable Before/After state diffs and real-time operational events.</p></div>
          <div className="flex gap-2">
            <Button type="button" variant={tab === "audit" ? "default" : "outline"} onClick={() => setTab("audit")}>Audit Logs (JSON Diffs)</Button>
            <Button type="button" variant={tab === "activity" ? "default" : "outline"} onClick={() => setTab("activity")}>Activity Feed</Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by user, entity, or description..." className="pl-9" /></div>
          {tab === "activity" && <div className="flex flex-wrap gap-1.5">{ACTIVITY_FILTERS.map((f) => <Button key={f.key} type="button" size="sm" variant={eventFilter === f.key ? "default" : "outline"} onClick={() => setEventFilter(f.key)}>{f.label}</Button>)}</div>}
        </div>
        {tab === "audit" ? (
          <Card><CardContent className="p-0">{auditQuery.isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
            <Table><TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>Actor</TableHead><TableHead>Outlet</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead className="text-right">Diff</TableHead></TableRow></TableHeader><TableBody>{(auditQuery.data?.items ?? []).map((log) => <TableRow key={log.id}><TableCell className="text-xs text-stone-500">{new Date(log.created_at).toLocaleString("en-IN")}</TableCell><TableCell className="text-sm font-medium">{log.actor_name ?? "System"}</TableCell><TableCell>{log.outlet_code ?? "GLOBAL"}</TableCell><TableCell><Badge variant="outline">{log.action}</Badge></TableCell><TableCell className="font-mono text-xs">{log.entity_type}</TableCell><TableCell className="text-right"><Button type="button" size="sm" variant="ghost" onClick={() => setSelectedDiff(log)}><Eye className="mr-1 h-3.5 w-3.5" />View Diff</Button></TableCell></TableRow>)}</TableBody></Table>
          )}</CardContent></Card>
        ) : (
          <Card><CardContent className="p-0">{activityQuery.isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
            <Table><TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>User</TableHead><TableHead>Outlet</TableHead><TableHead>Event</TableHead><TableHead>Description</TableHead><TableHead>IP</TableHead></TableRow></TableHeader><TableBody>{(activityQuery.data?.items ?? []).map((act) => <TableRow key={act.id}><TableCell className="text-xs text-stone-500">{new Date(act.created_at).toLocaleString("en-IN")}</TableCell><TableCell className="font-medium">{act.user_name ?? "System"}</TableCell><TableCell>{act.outlet_code ?? "GLOBAL"}</TableCell><TableCell><Badge variant="outline">{act.event_type}</Badge></TableCell><TableCell className="text-sm">{act.description}</TableCell><TableCell className="font-mono text-xs text-stone-500">{act.ip_address ?? "—"}</TableCell></TableRow>)}</TableBody></Table>
          )}</CardContent></Card>
        )}
        <Dialog open={Boolean(selectedDiff)} onOpenChange={(open) => { if (!open) setSelectedDiff(null); }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>Audit Diff: {selectedDiff?.action} ({selectedDiff?.entity_type})</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><p className="mb-1 text-xs font-semibold uppercase text-stone-500">Before Value</p><pre className="max-h-80 overflow-auto rounded-lg bg-stone-950 p-3 text-xs text-stone-100">{JSON.stringify(selectedDiff?.old_values, null, 2)}</pre></div>
              <div><p className="mb-1 text-xs font-semibold uppercase text-stone-500">After Value</p><pre className="max-h-80 overflow-auto rounded-lg bg-stone-950 p-3 text-xs text-emerald-300">{JSON.stringify(selectedDiff?.new_values, null, 2)}</pre></div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
