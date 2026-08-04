import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, MessageSquareWarning, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { uploadFile } from "@/lib/upload.functions";
import {
  deleteUploadedDoc,
  docLabel,
  recordUploadedDoc,
  type OnboardingDocument,
} from "@/lib/onboarding.functions";

type Props = {
  onboardingId: string;
  userId: string;
  docKey: string;
  document?: OnboardingDocument;
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];

function statusStyle(status: OnboardingDocument["status"]) {
  switch (status) {
    case "approved":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    case "changes_requested":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    case "rejected":
      return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
    default:
      return "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30";
  }
}

function statusLabel(status: OnboardingDocument["status"]) {
  if (status === "changes_requested") return "Changes requested";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function OnboardingDocUploader({ onboardingId, userId, docKey, document }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadFn = useServerFn(uploadFile);
  const recordFn = useServerFn(recordUploadedDoc);
  const deleteFn = useServerFn(deleteUploadedDoc);

  const removeM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Document removed");
      qc.invalidateQueries({ queryKey: ["my-onboarding"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not remove document"),
  });

  // Only lock approved documents - allow re-upload for rejected/changes_requested
  const locked = document && document.status === "approved";

  async function handlePick(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("File too large — max 10 MB");
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      toast.error("Only PDF, PNG, JPG or WEBP allowed");
      return;
    }
    try {
      setUploading(true);
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
      const safeExt = (ext || "bin").toLowerCase().slice(0, 6);
      const path = `${userId}/${onboardingId}/${docKey}-${Date.now()}.${safeExt}`;
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      await uploadFn({
        data: { bucket: "onboarding-docs", path, base64, contentType: file.type },
      });
      await recordFn({
        data: {
          onboarding_id: onboardingId,
          doc_key: docKey,
          storage_path: path,
          original_filename: file.name,
        },
      });
      toast.success(`${docLabel(docKey)} uploaded`);
      qc.invalidateQueries({ queryKey: ["my-onboarding"] });
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{docLabel(docKey)}</p>
          {document ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {document.original_filename ?? document.storage_path.split("/").pop()}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">PDF, PNG or JPG · up to 10 MB</p>
          )}
        </div>
        {document && (
          <Badge variant="outline" className={statusStyle(document.status)}>
            {document.status === "approved" && <CheckCircle2 className="mr-1 h-3 w-3" />}
            {statusLabel(document.status)}
          </Badge>
        )}
      </div>

      {document?.feedback && document.status !== "approved" && (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <MessageSquareWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>HR note: {document.feedback}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handlePick(f);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant={document ? "outline" : "default"}
          disabled={uploading || !!locked}
          onClick={() => inputRef.current?.click()}
          className={!document ? "bg-brand text-brand-foreground hover:bg-brand-glow" : ""}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileUp className="mr-2 h-3.5 w-3.5" />
          )}
          {document ? "Replace" : "Upload"}
        </Button>
        {document && !locked && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={removeM.isPending}
            onClick={() => removeM.mutate(document.id)}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}
