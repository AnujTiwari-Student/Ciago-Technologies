import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, ClipboardList } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createHrTask,
  listHrPeers,
  listHrTasks,
  updateHrTaskStatus,
  type HrTask,
} from "@/lib/hrTasks.functions";

const COLUMNS: Array<{ key: HrTask["status"]; label: string; tint: string }> = [
  { key: "to_do", label: "To do", tint: "border-slate-500/30" },
  { key: "in_progress", label: "In progress", tint: "border-sky-500/40" },
  { key: "blocked", label: "Blocked", tint: "border-amber-500/40" },
  { key: "done", label: "Done", tint: "border-emerald-500/40" },
];

const PRIO_TINT: Record<HrTask["priority"], string> = {
  low: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
  medium: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  high: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  urgent: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

export function HrTasksPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listHrTasks);
  const peersFn = useServerFn(listHrPeers);
  const createFn = useServerFn(createHrTask);
  const statusFn = useServerFn(updateHrTaskStatus);

  const tasks = useQuery({ queryKey: ["hr-tasks"], queryFn: () => listFn() });
  const peers = useQuery({ queryKey: ["hr-peers"], queryFn: () => peersFn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    assignee_id: "",
    title: "",
    description: "",
    priority: "medium" as HrTask["priority"],
    due_date: "",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-tasks"] });
  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          assignee_id: form.assignee_id,
          title: form.title,
          description: form.description || null,
          priority: form.priority,
          due_date: form.due_date || null,
        },
      }),
    onSuccess: () => {
      toast.success("HR task created");
      setOpen(false);
      setForm({ assignee_id: "", title: "", description: "", priority: "medium", due_date: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: (p: { id: string; status: HrTask["status"] }) => statusFn({ data: p }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = (status: HrTask["status"]) =>
    (tasks.data ?? []).filter((t) => t.status === status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-brand" /> HR Task Manager
          </h3>
          <p className="text-sm text-muted-foreground">
            Internal HR duties (offer drafts, verifications, payroll cutoffs). Assignable only to
            HR/admin.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand text-brand-foreground hover:bg-brand-glow">
              <Plus className="mr-1.5 h-4 w-4" /> New HR task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create HR task</DialogTitle>
              <DialogDescription>Assign to an HR or admin teammate.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Assignee</Label>
                <Select
                  value={form.assignee_id}
                  onValueChange={(v) => setForm({ ...form, assignee_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick an HR teammate" />
                  </SelectTrigger>
                  <SelectContent>
                    {(peers.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || p.email || p.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Verify Aadhaar for K. Menon"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm({ ...form, priority: v as HrTask["priority"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Due date</Label>
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => create.mutate()}
                disabled={!form.assignee_id || form.title.trim().length < 2 || create.isPending}
                className="bg-brand text-brand-foreground hover:bg-brand-glow"
              >
                {create.isPending ? "Creating…" : "Create task"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {tasks.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.key} className={`rounded-xl border ${col.tint} bg-card/40 p-3`}>
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {col.label}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {grouped(col.key).length}
                </Badge>
              </div>
              <div className="space-y-2">
                {grouped(col.key).length === 0 ? (
                  <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                    None
                  </div>
                ) : (
                  grouped(col.key).map((t) => (
                    <Card key={t.id} className="border-border/70">
                      <CardContent className="space-y-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug">{t.title}</p>
                          <Badge
                            variant="outline"
                            className={`${PRIO_TINT[t.priority]} text-[10px]`}
                          >
                            {t.priority}
                          </Badge>
                        </div>
                        {t.description && (
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {t.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{t.assignee_name || t.assignee_email || "—"}</span>
                          {t.due_date && (
                            <span>due {new Date(t.due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                        <Select
                          value={t.status}
                          onValueChange={(v) =>
                            setStatus.mutate({ id: t.id, status: v as HrTask["status"] })
                          }
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COLUMNS.map((c) => (
                              <SelectItem key={c.key} value={c.key}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
