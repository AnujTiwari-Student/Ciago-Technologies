import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, FileSignature, ShieldCheck, Sparkles, XCircle } from "lucide-react";

import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { OnboardingDocUploader } from "@/components/site/OnboardingDocUploader";
import {
  acceptOffer,
  declineOffer,
  docLabel,
  getMyOnboarding,
  saveOnboardingDraft,
  savePaperwork,
  submitOnboarding,
  updateOnboardingStep,
  type OnboardingDocument,
} from "@/lib/onboarding.functions";
import { requireAuthenticated } from "./-guard";

export const Route = createFileRoute("/_authenticated/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { userId } = await requireAuthenticated("/onboarding");
    return { userId: userId! };
  },
  head: () => ({
    meta: [
      { title: "Onboarding | Ciago Technologies" },
      {
        name: "description",
        content: "Complete your offer acceptance and onboarding paperwork with Ciago Technologies.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OnboardingPage,
});

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function OnboardingPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchOffer = useServerFn(getMyOnboarding);
  const acceptFn = useServerFn(acceptOffer);
  const declineFn = useServerFn(declineOffer);
  const paperworkFn = useServerFn(savePaperwork);
  const submitFn = useServerFn(submitOnboarding);
  const stepFn = useServerFn(updateOnboardingStep);
  const draftFn = useServerFn(saveOnboardingDraft);

  const { data: offer, isLoading } = useQuery({
    queryKey: ["my-onboarding"],
    queryFn: () => fetchOffer(),
  });

  const [step, setStep] = useState(1);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [idAck, setIdAck] = useState(false);
  const [codeAck, setCodeAck] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved">("idle");

  // Hydrate wizard state from persisted onboarding record so users can resume.
  useEffect(() => {
    if (!offer?.onboarding || hydrated) return;
    const rec = offer.onboarding;
    if (rec.status === "submitted") setStep(4);
    else if (rec.current_step && rec.current_step >= 1 && rec.current_step <= 3) {
      setStep(rec.current_step);
    } else if (rec.emergency_contact) setStep(3);
    else if (rec.status === "accepted") setStep(2);

    // Restore emergency contact from either the persisted column or the draft form_state.
    const fs = (rec.form_state ?? {}) as Record<string, unknown>;
    const ec = (rec.emergency_contact ?? (fs.emergency_contact as any)) as {
      name?: string;
      relation?: string;
      phone?: string;
    } | null;
    if (ec) {
      setEmergencyName(ec.name ?? "");
      setEmergencyRelation(ec.relation ?? "");
      setEmergencyPhone(ec.phone ?? "");
    }
    setIdAck(rec.id_ack || fs.id_ack === true);
    setCodeAck(rec.code_of_conduct_ack || fs.code_of_conduct_ack === true);
    setHydrated(true);
  }, [offer?.onboarding, hydrated]);

  // Persist step whenever it changes (best-effort — silent on failure).
  useEffect(() => {
    if (!offer?.onboarding || !hydrated) return;
    if (offer.onboarding.status === "submitted") return;
    if (offer.onboarding.current_step === step) return;
    if (step < 1 || step > 3) return;
    stepFn({ data: { onboarding_id: offer.onboarding.id, current_step: step } }).catch(() => {});
  }, [step, hydrated, offer?.onboarding, stepFn]);

  // Auto-save every wizard field on change — debounced 600 ms so refresh restores exact state.
  useEffect(() => {
    if (!hydrated || !offer?.onboarding) return;
    if (offer.onboarding.status === "submitted") return;
    setAutoSaveState("saving");
    const t = setTimeout(() => {
      draftFn({
        data: {
          onboarding_id: offer.onboarding!.id,
          emergency_contact: {
            name: emergencyName,
            relation: emergencyRelation,
            phone: emergencyPhone,
          },
          id_ack: idAck,
          code_of_conduct_ack: codeAck,
          form_state: {
            emergency_contact: {
              name: emergencyName,
              relation: emergencyRelation,
              phone: emergencyPhone,
            },
            id_ack: idAck,
            code_of_conduct_ack: codeAck,
            last_saved_at: new Date().toISOString(),
          },
        },
      })
        .then(() => setAutoSaveState("saved"))
        .catch(() => setAutoSaveState("idle"));
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    emergencyName,
    emergencyRelation,
    emergencyPhone,
    idAck,
    codeAck,
    hydrated,
    offer?.onboarding?.id,
  ]);

  const acceptM = useMutation({
    mutationFn: () => acceptFn({ data: { application_id: offer!.application_id } }),
    onSuccess: () => {
      toast.success("Offer accepted");
      setStep(2);
      qc.invalidateQueries({ queryKey: ["my-onboarding"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not accept offer"),
  });

  const declineM = useMutation({
    mutationFn: () => declineFn({ data: { application_id: offer!.application_id } }),
    onSuccess: () => {
      toast.success("Offer declined");
      qc.invalidateQueries({ queryKey: ["my-onboarding"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not decline"),
  });

  const paperworkM = useMutation({
    mutationFn: () =>
      paperworkFn({
        data: {
          onboarding_id: offer!.onboarding!.id,
          emergency_contact: {
            name: emergencyName,
            relation: emergencyRelation,
            phone: emergencyPhone,
          },
          id_ack: true as const,
          code_of_conduct_ack: true as const,
        },
      }),
    onSuccess: () => {
      toast.success("Paperwork saved");
      setStep(3);
      qc.invalidateQueries({ queryKey: ["my-onboarding"] });
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  const submitM = useMutation({
    mutationFn: () => submitFn({ data: { onboarding_id: offer!.onboarding!.id } }),
    onSuccess: async () => {
      toast.success("Onboarding submitted — Admin will verify your documents shortly.");
      await qc.invalidateQueries();
      setTimeout(() => navigate({ to: "/my-applications" }), 800);
    },
    onError: (e: any) => toast.error(e?.message || "Submission failed"),
  });

  const compensation = useMemo(() => {
    const seed =
      (offer?.application_id ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) || 1;
    return 600000 + (seed % 220) * 10000;
  }, [offer?.application_id]);

  // Doc bookkeeping for Step 2 gating.
  const docRequirements = offer?.doc_requirements ?? [];
  const mandatoryDocs = docRequirements.filter((r) => r.mandatory).map((r) => r.key);
  const optionalDocs = docRequirements.filter((r) => !r.mandatory);
  const requiredDocs = mandatoryDocs;
  const docsByKey = useMemo(() => {
    const map: Record<string, OnboardingDocument> = {};
    for (const d of offer?.documents ?? []) map[d.doc_key] = d;
    return map;
  }, [offer?.documents]);
  const missingDocs = requiredDocs.filter((k) => !docsByKey[k]);
  const rejectedDocs = requiredDocs
    .map((k) => docsByKey[k])
    .filter((d) => d && (d.status === "rejected" || d.status === "changes_requested"));
  const canSavePaperwork =
    emergencyName.trim().length >= 2 &&
    emergencyRelation.trim().length >= 2 &&
    emergencyPhone.trim().length >= 6 &&
    idAck &&
    codeAck &&
    missingDocs.length === 0 &&
    rejectedDocs.length === 0;

  const trackBadge =
    offer?.track_type === "hr_track"
      ? {
          label: "HR Track",
          cls: "bg-fuchsia-500/15 text-fuchsia-600 border-fuchsia-500/30 dark:text-fuchsia-300",
        }
      : offer?.track_type === "manager_track"
        ? {
            label: "Manager Track",
            cls: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30 dark:text-indigo-300",
          }
        : offer?.track_type === "standard"
          ? {
              label: "Standard Track",
              cls: "bg-sky-500/15 text-sky-600 border-sky-500/30 dark:text-sky-300",
            }
          : null;
  const employmentBadge = offer?.employment_type
    ? offer.employment_type.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Onboarding</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          Welcome — let's get you set up
        </h1>
        <p className="mt-2 text-muted-foreground">
          Review your offer and submit your onboarding details to get started.
        </p>
        {(trackBadge || employmentBadge) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {trackBadge && (
              <Badge variant="outline" className={trackBadge.cls}>
                {trackBadge.label}
              </Badge>
            )}
            {employmentBadge && (
              <Badge variant="outline" className="bg-muted/40">
                {employmentBadge}
              </Badge>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="mt-10 h-64 animate-pulse rounded-xl border border-border bg-card" />
        ) : !offer ? (
          <Card className="mt-10 border-dashed">
            <CardContent className="p-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-bold">No active offers yet</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                When an offer is extended for one of your applications, it will appear here.
              </p>
              <Button asChild className="mt-6 bg-brand text-brand-foreground hover:bg-brand-glow">
                <Link to="/my-applications">Back to applications</Link>
              </Button>
            </CardContent>
          </Card>
        ) : offer.onboarding?.status === "submitted" ? (
          <Card className="mt-10 border-emerald-500/40 bg-emerald-500/5">
            <CardContent className="flex flex-col items-center p-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <h2 className="mt-4 text-xl font-bold">Onboarding submitted</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Your documents are with the Admin team for verification. You'll get an email once your
                Date of Joining is confirmed.
              </p>
              <Button asChild className="mt-6 bg-brand text-brand-foreground hover:bg-brand-glow">
                <Link to="/my-applications">View My Applications</Link>
              </Button>
            </CardContent>
          </Card>
        ) : offer.onboarding?.status === "declined" ? (
          <Card className="mt-10">
            <CardContent className="p-8 text-center text-muted-foreground">
              You declined this offer. If this was a mistake, please contact hr@ciagotech.com.
            </CardContent>
          </Card>
        ) : (
          <>
            <Stepper step={step} />
            <Card className="mt-6">
              <CardContent className="p-6 sm:p-8">
                {step === 1 && (
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                        Offer Letter
                      </p>
                      <h2 className="mt-1 text-2xl font-bold">{offer.role_title}</h2>
                      {offer.job_code && (
                        <Badge variant="outline" className="mt-2 font-mono text-[11px]">
                          {offer.job_code}
                        </Badge>
                      )}
                    </div>
                    <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-5 sm:grid-cols-2">
                      <Field label="Position" value={offer.role_title} />
                      <Field label="Department" value={offer.department ?? "—"} />
                      <Field
                        label="Start Date"
                        value={new Date(Date.now() + 21 * 86400000).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      />
                      <Field label="Compensation (Annual CTC)" value={inr.format(compensation)} />
                    </div>
                    <div className="prose prose-sm max-w-none text-sm text-muted-foreground dark:prose-invert">
                      <p>
                        We are pleased to formally extend this offer for the position above at Ciago
                        Technologies. This letter outlines the initial terms of your engagement,
                        including position, compensation and expected start date. Detailed policies,
                        benefits and confidentiality terms are covered in the full employee
                        handbook, which will be shared upon acceptance.
                      </p>
                      <p>
                        By clicking <strong>Accept &amp; Sign</strong>, you acknowledge the offer
                        terms and agree to proceed with the remaining onboarding steps.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => acceptM.mutate()}
                        disabled={acceptM.isPending}
                        className="bg-brand text-brand-foreground hover:bg-brand-glow"
                      >
                        <FileSignature className="mr-2 h-4 w-4" />
                        {acceptM.isPending ? "Signing…" : "Accept & Sign"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => declineM.mutate()}
                        disabled={declineM.isPending}
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Decline
                      </Button>
                    </div>
                  </div>
                )}

                {step === 2 && offer.onboarding && (
                  <div className="space-y-8">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                          Paperwork & Verification
                        </p>
                        <span
                          className="text-[11px] text-muted-foreground"
                          aria-live="polite"
                          title="Every field is auto-saved as you type."
                        >
                          {autoSaveState === "saving"
                            ? "Saving draft…"
                            : autoSaveState === "saved"
                              ? "Draft saved ✓"
                              : ""}
                        </span>
                      </div>
                      <h2 className="mt-1 text-xl font-bold">
                        Upload documents and share your details
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Every field is saved automatically — come back any time to finish.
                      </p>
                    </div>

                    {/* Dynamic document uploads based on the job posting's required_onboarding_docs */}
                    <section className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">Required documents</h3>
                        <span className="text-xs text-muted-foreground">
                          {requiredDocs.length - missingDocs.length}/{requiredDocs.length} uploaded
                        </span>
                      </div>
                      {requiredDocs.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                          No documents required for this role.
                        </p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {requiredDocs.map((key) => (
                            <OnboardingDocUploader
                              key={key}
                              onboardingId={offer.onboarding!.id}
                              userId={offer.onboarding!.user_id}
                              docKey={key}
                              document={docsByKey[key]}
                            />
                          ))}
                        </div>
                      )}
                      {rejectedDocs.length > 0 && (
                        <p className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-600 dark:text-rose-400">
                          HR has asked for changes to:{" "}
                          {rejectedDocs.map((d) => docLabel(d!.doc_key)).join(", ")}. Please
                          re-upload before continuing.
                        </p>
                      )}
                    </section>

                    {optionalDocs.length > 0 && (
                      <section className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">Optional documents</h3>
                          <span className="text-xs text-muted-foreground">
                            Not required to submit — you can upload later
                          </span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {optionalDocs.map((r) => (
                            <OnboardingDocUploader
                              key={r.key}
                              onboardingId={offer.onboarding!.id}
                              userId={offer.onboarding!.user_id}
                              docKey={r.key}
                              document={docsByKey[r.key]}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    <section className="space-y-4">
                      <h3 className="text-sm font-semibold">Emergency contact</h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="ec-name">Full name</Label>
                          <Input
                            id="ec-name"
                            value={emergencyName}
                            onChange={(e) => setEmergencyName(e.target.value)}
                            placeholder="Full name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ec-rel">Relationship</Label>
                          <Input
                            id="ec-rel"
                            value={emergencyRelation}
                            onChange={(e) => setEmergencyRelation(e.target.value)}
                            placeholder="Parent, Spouse, Sibling…"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="ec-phone">Phone number</Label>
                          <Input
                            id="ec-phone"
                            value={emergencyPhone}
                            onChange={(e) => setEmergencyPhone(e.target.value)}
                            placeholder="+91 …"
                          />
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                      <label className="flex items-start gap-3">
                        <Checkbox
                          checked={idAck}
                          onCheckedChange={(v) => setIdAck(!!v)}
                          className="mt-1"
                        />
                        <span className="text-sm">
                          I confirm all uploaded documents are authentic and unaltered originals.
                        </span>
                      </label>
                      <label className="flex items-start gap-3">
                        <Checkbox
                          checked={codeAck}
                          onCheckedChange={(v) => setCodeAck(!!v)}
                          className="mt-1"
                        />
                        <span className="text-sm">
                          I have read and agree to abide by the Ciago Technologies Code of Conduct
                          and Information-Security policies.
                        </span>
                      </label>
                    </section>

                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" onClick={() => setStep(1)}>
                        Back
                      </Button>
                      <Button
                        onClick={() => paperworkM.mutate()}
                        disabled={paperworkM.isPending || !canSavePaperwork}
                        className="bg-brand text-brand-foreground hover:bg-brand-glow"
                      >
                        {paperworkM.isPending ? "Saving…" : "Save & Continue"}
                      </Button>
                    </div>
                    {!canSavePaperwork && missingDocs.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Still needed: {missingDocs.map((k) => docLabel(k)).join(", ")}.
                      </p>
                    )}
                  </div>
                )}

                {step === 3 && offer.onboarding && (
                  <div className="space-y-6 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Final review</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Submitting will hand your file to Admin for document verification and Date of
                        Joining assignment.
                      </p>
                    </div>
                    <div className="mx-auto max-w-md space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-left text-sm">
                      <p>
                        <span className="text-muted-foreground">Role:</span>{" "}
                        <strong>{offer.role_title}</strong>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Emergency contact:</span>{" "}
                        {emergencyName} ({emergencyRelation}) · {emergencyPhone}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Documents uploaded:</span>{" "}
                        {requiredDocs.length - missingDocs.length} / {requiredDocs.length}
                      </p>
                      <p className="text-emerald-600 dark:text-emerald-400">
                        ✓ Document authenticity confirmed
                      </p>
                      <p className="text-emerald-600 dark:text-emerald-400">
                        ✓ Code of Conduct accepted
                      </p>
                    </div>
                    <div className="flex justify-center gap-3">
                      <Button variant="outline" onClick={() => setStep(2)}>
                        Back
                      </Button>
                      <Button
                        onClick={() => submitM.mutate()}
                        disabled={submitM.isPending || missingDocs.length > 0}
                        className="bg-brand text-brand-foreground hover:bg-brand-glow"
                      >
                        {submitM.isPending ? "Submitting…" : "Submit for Admin verification"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = ["Offer Letter", "Paperwork & Docs", "Review & Submit"];
  return (
    <ol className="mt-10 grid grid-cols-3 gap-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <li
            key={label}
            className={`rounded-lg border p-3 text-center text-xs sm:text-sm ${
              active
                ? "border-brand bg-brand/10 text-brand font-semibold"
                : done
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                  : "border-border text-muted-foreground"
            }`}
          >
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold">
              {done ? "✓" : n}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
