import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, FileSignature, MessageSquareWarning, ShieldCheck, Sparkles, XCircle } from "lucide-react";

import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OnboardingDocUploader } from "@/components/site/OnboardingDocUploader";

const EMERGENCY_RELATIONSHIPS = [
  "Father",
  "Mother",
  "Spouse",
  "Sibling",
  "Son",
  "Daughter",
  "Guardian",
  "Friend",
  "Other",
] as const;
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
    staleTime: 0, // Always consider data stale so it refetches
    refetchOnMount: "always", // Always refetch when component mounts
  });

  const [step, setStep] = useState(1);
  const [currentAddress, setCurrentAddress] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [sameAsCurrent, setSameAsCurrent] = useState(false);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyAlternatePhone, setEmergencyAlternatePhone] = useState("");
  const [emergencyEmail, setEmergencyEmail] = useState("");
  const [emergencyAddress, setEmergencyAddress] = useState("");

  // Personal contact details
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [nationality, setNationality] = useState("Indian");
  const [gender, setGender] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [salutation, setSalutation] = useState("");

  // Banking details
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [panNumber, setPanNumber] = useState("");

  // E-signature and acknowledgements
  const [eSignature, setESignature] = useState("");
  const [idAck, setIdAck] = useState(false);
  const [codeAck, setCodeAck] = useState(false);
  const [termsAck, setTermsAck] = useState(false);
  const [privacyAck, setPrivacyAck] = useState(false);
  const [dataProcessingAck, setDataProcessingAck] = useState(false);
  const [backgroundCheckAck, setBackgroundCheckAck] = useState(false);

  const [hydrated, setHydrated] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved">("idle");

  // Hydrate wizard state from persisted onboarding record so users can resume.
  useEffect(() => {
    if (!offer?.onboarding || hydrated) return;
    const rec = offer.onboarding;
    // If changes requested or rejected, go to step 2 (documents) so they can re-upload
    if (rec.verification_status === "changes_requested" || rec.verification_status === "rejected") {
      setStep(2);
    } else if (rec.status === "submitted") {
      setStep(4);
    } else if (rec.current_step && rec.current_step >= 1 && rec.current_step <= 3) {
      setStep(rec.current_step);
    } else if (rec.emergency_contact) {
      setStep(3);
    } else if (rec.status === "accepted") {
      setStep(2);
    }

    // Restore emergency contact and addresses from form_state
    const fs = (rec.form_state ?? {}) as Record<string, unknown>;
    const ec = (rec.emergency_contact ?? (fs.emergency_contact as any)) as {
      name?: string;
      relationship?: string;
      relation?: string;
      phone?: string;
      alternate_phone?: string;
      email?: string;
      address?: string;
    } | null;
    if (ec) {
      setEmergencyName(ec.name ?? "");
      setEmergencyRelation(ec.relationship ?? ec.relation ?? "");
      setEmergencyPhone(ec.phone ?? "");
      setEmergencyAlternatePhone(ec.alternate_phone ?? "");
      setEmergencyEmail(ec.email ?? "");
      setEmergencyAddress(ec.address ?? "");
    }
    setCurrentAddress((fs.current_address as string) ?? "");
    setPermanentAddress((fs.permanent_address as string) ?? "");
    setSameAsCurrent((fs.same_as_current as boolean) ?? false);

    // Restore personal contact details
    setPersonalEmail((fs.personal_email as string) ?? "");
    setPersonalPhone((fs.personal_phone as string) ?? "");
    setAlternatePhone((fs.alternate_phone as string) ?? "");
    setDateOfBirth((fs.date_of_birth as string) ?? "");
    setBloodGroup((fs.blood_group as string) ?? "");
    setNationality((fs.nationality as string) ?? "Indian");
    setGender((fs.gender as string) ?? "");
    setMaritalStatus((fs.marital_status as string) ?? "");
    setSalutation((fs.salutation as string) ?? "");

    // Restore banking details
    setBankName((fs.bank_name as string) ?? "");
    setAccountNumber((fs.account_number as string) ?? "");
    setIfscCode((fs.ifsc_code as string) ?? "");
    setPanNumber((fs.pan_number as string) ?? "");

    // Restore e-signature and acknowledgements
    setESignature((fs.e_signature as string) ?? "");
    setIdAck(rec.id_ack || fs.id_ack === true);
    setCodeAck(rec.code_of_conduct_ack || fs.code_of_conduct_ack === true);
    setTermsAck((fs.terms_ack as boolean) ?? false);
    setPrivacyAck((fs.privacy_ack as boolean) ?? false);
    setDataProcessingAck((fs.data_processing_ack as boolean) ?? false);
    setBackgroundCheckAck((fs.background_check_ack as boolean) ?? false);

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
            relationship: emergencyRelation,
            phone: emergencyPhone,
            alternate_phone: emergencyAlternatePhone,
            email: emergencyEmail,
            address: emergencyAddress,
          },
          id_ack: idAck,
          code_of_conduct_ack: codeAck,
          form_state: {
            current_address: currentAddress,
            permanent_address: permanentAddress,
            same_as_current: sameAsCurrent,
            emergency_contact: {
              name: emergencyName,
              relation: emergencyRelation,
              phone: emergencyPhone,
            },
            personal_email: personalEmail,
            personal_phone: personalPhone,
            alternate_phone: alternatePhone,
            date_of_birth: dateOfBirth,
            blood_group: bloodGroup,
            nationality: nationality,
            gender: gender,
            marital_status: maritalStatus,
            salutation: salutation,
            bank_name: bankName,
            account_number: accountNumber,
            ifsc_code: ifscCode,
            pan_number: panNumber,
            e_signature: eSignature,
            id_ack: idAck,
            code_of_conduct_ack: codeAck,
            terms_ack: termsAck,
            privacy_ack: privacyAck,
            data_processing_ack: dataProcessingAck,
            background_check_ack: backgroundCheckAck,
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
    currentAddress,
    permanentAddress,
    sameAsCurrent,
    emergencyName,
    emergencyRelation,
    emergencyPhone,
    emergencyAlternatePhone,
    emergencyEmail,
    emergencyAddress,
    personalEmail,
    personalPhone,
    alternatePhone,
    dateOfBirth,
    bloodGroup,
    nationality,
    gender,
    maritalStatus,
    salutation,
    bankName,
    accountNumber,
    ifscCode,
    panNumber,
    eSignature,
    idAck,
    codeAck,
    termsAck,
    privacyAck,
    dataProcessingAck,
    backgroundCheckAck,
    hydrated,
    offer?.onboarding?.id,
  ]);

  const acceptM = useMutation({
    mutationFn: () => acceptFn({ data: { application_id: offer!.application_id } }),
    onSuccess: async () => {
      toast.success("Offer accepted");
      await qc.invalidateQueries({ queryKey: ["my-onboarding"] });
      setStep(2);
      setHydrated(false); // Force re-hydration with fresh data
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
            relationship: emergencyRelation,
            phone: emergencyPhone,
            alternate_phone: emergencyAlternatePhone,
            email: emergencyEmail,
            address: emergencyAddress,
          },
          id_ack: true as const,
          code_of_conduct_ack: true as const,
        },
      }),
    onSuccess: async () => {
      toast.success("Paperwork saved");
      await qc.invalidateQueries({ queryKey: ["my-onboarding"] });
      setStep(3);
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
    // If onboarding record exists with compensation, use it
    if (offer?.onboarding?.compensation_inr) {
      return offer.onboarding.compensation_inr;
    }
    // Otherwise calculate from job posting salary range
    if (offer?.salary_max_inr && offer?.salary_min_inr) {
      return Math.round((offer.salary_min_inr + offer.salary_max_inr) / 2);
    }
    if (offer?.salary_min_inr) {
      return offer.salary_min_inr;
    }
    return 0;
  }, [offer?.onboarding?.compensation_inr, offer?.salary_min_inr, offer?.salary_max_inr]);

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
    currentAddress.trim().length >= 10 &&
    (sameAsCurrent || permanentAddress.trim().length >= 10) &&
    emergencyName.trim().length >= 2 &&
    emergencyRelation.trim().length >= 2 &&
    emergencyPhone.trim().length >= 6 &&
    personalEmail.trim().length >= 5 &&
    personalPhone.trim().length >= 10 &&
    dateOfBirth.trim().length > 0 &&
    gender.trim().length > 0 &&
    maritalStatus.trim().length > 0 &&
    bankName.trim().length >= 2 &&
    accountNumber.trim().length >= 8 &&
    ifscCode.trim().length === 11 &&
    panNumber.trim().length === 10 &&
    eSignature.trim().length >= 2 &&
    idAck &&
    codeAck &&
    termsAck &&
    privacyAck &&
    dataProcessingAck &&
    backgroundCheckAck &&
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
        ) : offer.onboarding?.status === "submitted" &&
           offer.onboarding?.verification_status !== "changes_requested" &&
           offer.onboarding?.verification_status !== "rejected" ? (
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
            {/* Show alert for verification status requiring action */}
            {offer.onboarding?.verification_status === "changes_requested" && (
              <Card className="mt-6 border-amber-500/40 bg-amber-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <MessageSquareWarning className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-amber-900 dark:text-amber-200">Changes Requested</h3>
                      <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                        HR has requested changes to your onboarding documents. Please review the feedback below and re-upload the necessary documents.
                      </p>
                      {offer.onboarding.rejection_feedback && (
                        <p className="mt-2 text-sm text-amber-900 dark:text-amber-100 font-medium">
                          Feedback: {offer.onboarding.rejection_feedback}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {offer.onboarding?.verification_status === "rejected" && (
              <Card className="mt-6 border-rose-500/40 bg-rose-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-rose-900 dark:text-rose-200">Onboarding Rejected</h3>
                      <p className="mt-1 text-sm text-rose-800 dark:text-rose-300">
                        Your onboarding submission has been rejected. Please review the feedback below, update your documents, and re-submit.
                      </p>
                      {offer.onboarding.rejection_feedback && (
                        <p className="mt-2 text-sm text-rose-900 dark:text-rose-100 font-medium">
                          Feedback: {offer.onboarding.rejection_feedback}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
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
                      {(offer.onboarding.verification_status === "changes_requested" ||
                        offer.onboarding.verification_status === "rejected") && (
                        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                            ⚠️ Action Required
                          </p>
                          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                            HR has requested changes. Please review the feedback on each document below and re-upload the corrected files.
                          </p>
                        </div>
                      )}
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
                      <h3 className="text-sm font-semibold">Current address</h3>
                      <div className="space-y-2">
                        <Label htmlFor="current-address">Full address</Label>
                        <Textarea
                          id="current-address"
                          value={currentAddress}
                          onChange={(e) => setCurrentAddress(e.target.value)}
                          placeholder="Flat/House No., Street, Locality, City, State, PIN"
                          rows={3}
                        />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Permanent address</h3>
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={sameAsCurrent}
                            onCheckedChange={(v) => {
                              setSameAsCurrent(!!v);
                              if (v) setPermanentAddress(currentAddress);
                            }}
                          />
                          <span>Same as current</span>
                        </label>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="permanent-address">Full address</Label>
                        <Textarea
                          id="permanent-address"
                          value={sameAsCurrent ? currentAddress : permanentAddress}
                          onChange={(e) => !sameAsCurrent && setPermanentAddress(e.target.value)}
                          placeholder="Flat/House No., Street, Locality, City, State, PIN"
                          rows={3}
                          disabled={sameAsCurrent}
                        />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="text-sm font-semibold">Emergency contact</h3>
                      <p className="text-xs text-muted-foreground">
                        Person to contact in case of emergency
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="ec-name">Full name</Label>
                          <Input
                            id="ec-name"
                            value={emergencyName}
                            onChange={(e) => setEmergencyName(e.target.value)}
                            placeholder="Full name"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ec-rel">Relationship</Label>
                          <Select
                            value={emergencyRelation}
                            onValueChange={(v) => setEmergencyRelation(v)}
                          >
                            <SelectTrigger id="ec-rel">
                              <SelectValue placeholder="Select relationship" />
                            </SelectTrigger>
                            <SelectContent>
                              {EMERGENCY_RELATIONSHIPS.map((rel) => (
                                <SelectItem key={rel} value={rel}>
                                  {rel}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ec-phone">Phone number</Label>
                          <Input
                            id="ec-phone"
                            type="tel"
                            value={emergencyPhone}
                            onChange={(e) => setEmergencyPhone(e.target.value)}
                            placeholder="+91 1234567890"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ec-alt-phone">Alternate number (optional)</Label>
                          <Input
                            id="ec-alt-phone"
                            type="tel"
                            value={emergencyAlternatePhone}
                            onChange={(e) => setEmergencyAlternatePhone(e.target.value)}
                            placeholder="+91 …"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ec-email">Email (optional)</Label>
                          <Input
                            id="ec-email"
                            type="email"
                            value={emergencyEmail}
                            onChange={(e) => setEmergencyEmail(e.target.value)}
                            placeholder="emergency@example.com"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="ec-address">Address (optional)</Label>
                          <Textarea
                            id="ec-address"
                            value={emergencyAddress}
                            onChange={(e) => setEmergencyAddress(e.target.value)}
                            placeholder="Full address of emergency contact"
                            rows={2}
                          />
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="text-sm font-semibold">Personal details</h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="salutation">Salutation (optional)</Label>
                          <Select value={salutation} onValueChange={(v) => setSalutation(v)}>
                            <SelectTrigger id="salutation">
                              <SelectValue placeholder="Select salutation" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Mr">Mr</SelectItem>
                              <SelectItem value="Ms">Ms</SelectItem>
                              <SelectItem value="Mrs">Mrs</SelectItem>
                              <SelectItem value="Dr">Dr</SelectItem>
                              <SelectItem value="Prof">Prof</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="gender">Gender</Label>
                          <Select value={gender} onValueChange={(v) => setGender(v)}>
                            <SelectTrigger id="gender">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dob">Date of birth</Label>
                          <Input
                            id="dob"
                            type="date"
                            value={dateOfBirth}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="marital-status">Marital status</Label>
                          <Select value={maritalStatus} onValueChange={(v) => setMaritalStatus(v)}>
                            <SelectTrigger id="marital-status">
                              <SelectValue placeholder="Select marital status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Single">Single</SelectItem>
                              <SelectItem value="Married">Married</SelectItem>
                              <SelectItem value="Divorced">Divorced</SelectItem>
                              <SelectItem value="Widowed">Widowed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="blood-group">Blood group</Label>
                          <Select value={bloodGroup} onValueChange={(v) => setBloodGroup(v)}>
                            <SelectTrigger id="blood-group">
                              <SelectValue placeholder="Select blood group" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="A+">A+</SelectItem>
                              <SelectItem value="A-">A-</SelectItem>
                              <SelectItem value="B+">B+</SelectItem>
                              <SelectItem value="B-">B-</SelectItem>
                              <SelectItem value="O+">O+</SelectItem>
                              <SelectItem value="O-">O-</SelectItem>
                              <SelectItem value="AB+">AB+</SelectItem>
                              <SelectItem value="AB-">AB-</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="nationality">Nationality</Label>
                          <Input
                            id="nationality"
                            value={nationality}
                            onChange={(e) => setNationality(e.target.value)}
                            placeholder="Indian"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="personal-email">Personal email</Label>
                          <Input
                            id="personal-email"
                            type="email"
                            value={personalEmail}
                            onChange={(e) => setPersonalEmail(e.target.value)}
                            placeholder="your.email@example.com"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="personal-phone">Mobile number</Label>
                          <Input
                            id="personal-phone"
                            type="tel"
                            value={personalPhone}
                            onChange={(e) => setPersonalPhone(e.target.value)}
                            placeholder="+91 1234567890"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="alternate-phone">Alternate number (optional)</Label>
                          <Input
                            id="alternate-phone"
                            type="tel"
                            value={alternatePhone}
                            onChange={(e) => setAlternatePhone(e.target.value)}
                            placeholder="+91 …"
                          />
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="text-sm font-semibold">Banking & Tax details</h3>
                      <p className="text-xs text-muted-foreground">
                        Required for salary processing and tax compliance
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="bank-name">Bank name</Label>
                          <Input
                            id="bank-name"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            placeholder="State Bank of India, HDFC Bank…"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="account-number">Account number</Label>
                          <Input
                            id="account-number"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            placeholder="Account number"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ifsc">IFSC code</Label>
                          <Input
                            id="ifsc"
                            value={ifscCode}
                            onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                            placeholder="SBIN0001234"
                            maxLength={11}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pan">PAN number</Label>
                          <Input
                            id="pan"
                            value={panNumber}
                            onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                            placeholder="ABCDE1234F"
                            maxLength={10}
                            required
                          />
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="text-sm font-semibold">Electronic signature</h3>
                      <p className="text-xs text-muted-foreground">
                        Type your full legal name exactly as it appears on your government ID
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="e-signature">Full legal name</Label>
                        <Input
                          id="e-signature"
                          value={eSignature}
                          onChange={(e) => setESignature(e.target.value)}
                          placeholder="Your full legal name"
                          className="font-serif text-lg"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          By typing your name, you acknowledge this serves as your legally binding
                          electronic signature
                        </p>
                      </div>
                    </section>

                    <section className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                      <h3 className="text-sm font-semibold mb-2">Terms, policies & acknowledgements</h3>
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
                          I have read and agree to abide by the{" "}
                          <strong>Code of Conduct</strong> and{" "}
                          <strong>Information Security policies</strong> of Ciago Technologies.
                        </span>
                      </label>
                      <label className="flex items-start gap-3">
                        <Checkbox
                          checked={termsAck}
                          onCheckedChange={(v) => setTermsAck(!!v)}
                          className="mt-1"
                        />
                        <span className="text-sm">
                          I accept the <strong>Terms of Employment</strong> and understand my
                          rights and obligations as outlined in the Employee Handbook.
                        </span>
                      </label>
                      <label className="flex items-start gap-3">
                        <Checkbox
                          checked={privacyAck}
                          onCheckedChange={(v) => setPrivacyAck(!!v)}
                          className="mt-1"
                        />
                        <span className="text-sm">
                          I acknowledge the <strong>Privacy Policy</strong> and consent to the
                          collection and processing of my personal information for employment
                          purposes.
                        </span>
                      </label>
                      <label className="flex items-start gap-3">
                        <Checkbox
                          checked={dataProcessingAck}
                          onCheckedChange={(v) => setDataProcessingAck(!!v)}
                          className="mt-1"
                        />
                        <span className="text-sm">
                          I consent to <strong>data processing</strong> activities including
                          payroll, benefits administration, performance tracking, and internal
                          communications as required for my employment.
                        </span>
                      </label>
                      <label className="flex items-start gap-3">
                        <Checkbox
                          checked={backgroundCheckAck}
                          onCheckedChange={(v) => setBackgroundCheckAck(!!v)}
                          className="mt-1"
                        />
                        <span className="text-sm">
                          I authorize Ciago Technologies to conduct{" "}
                          <strong>background verification</strong> checks including employment
                          history, educational qualifications, and reference checks as part of the
                          onboarding process.
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
                    {!canSavePaperwork && (
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {missingDocs.length > 0 && (
                          <p>• Missing documents: {missingDocs.map((k) => docLabel(k)).join(", ")}</p>
                        )}
                        {!personalEmail.trim() && <p>• Personal email is required</p>}
                        {personalPhone.trim().length < 10 && <p>• Valid mobile number is required</p>}
                        {!dateOfBirth && <p>• Date of birth is required</p>}
                        {bankName.trim().length < 2 && <p>• Bank name is required</p>}
                        {accountNumber.trim().length < 8 && <p>• Valid account number is required</p>}
                        {ifscCode.trim().length !== 11 && <p>• Valid 11-character IFSC code is required</p>}
                        {panNumber.trim().length !== 10 && <p>• Valid 10-character PAN number is required</p>}
                        {eSignature.trim().length < 2 && <p>• Electronic signature is required</p>}
                        {(!idAck || !codeAck || !termsAck || !privacyAck || !dataProcessingAck || !backgroundCheckAck) && (
                          <p>• All acknowledgements must be accepted</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {step === 3 && offer.onboarding && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand">
                        <ShieldCheck className="h-6 w-6" />
                      </div>
                      <div className="mt-4">
                        <h2 className="text-xl font-bold">Final review</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Please review your information before submitting. This will be sent to Admin
                          for document verification and Date of Joining assignment.
                        </p>
                      </div>
                    </div>

                    <div className="mx-auto max-w-2xl space-y-4">
                      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                        <h3 className="font-semibold text-brand">Position Details</h3>
                        <p>
                          <span className="text-muted-foreground">Role:</span>{" "}
                          <strong>{offer.role_title}</strong>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Department:</span>{" "}
                          {offer.department ?? "—"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Compensation:</span>{" "}
                          {inr.format(compensation)}
                        </p>
                      </div>

                      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                        <h3 className="font-semibold text-brand">Personal Information</h3>
                        <p>
                          <span className="text-muted-foreground">Email:</span> {personalEmail}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Mobile:</span> {personalPhone}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Date of Birth:</span>{" "}
                          {new Date(dateOfBirth).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Nationality:</span> {nationality}
                        </p>
                        {bloodGroup && (
                          <p>
                            <span className="text-muted-foreground">Blood Group:</span> {bloodGroup}
                          </p>
                        )}
                      </div>

                      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                        <h3 className="font-semibold text-brand">Emergency Contact</h3>
                        <p>
                          <span className="text-muted-foreground">Name:</span> {emergencyName}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Relationship:</span>{" "}
                          {emergencyRelation}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Phone:</span> {emergencyPhone}
                        </p>
                        {emergencyAlternatePhone && (
                          <p>
                            <span className="text-muted-foreground">Alternate Phone:</span>{" "}
                            {emergencyAlternatePhone}
                          </p>
                        )}
                        {emergencyEmail && (
                          <p>
                            <span className="text-muted-foreground">Email:</span> {emergencyEmail}
                          </p>
                        )}
                        {emergencyAddress && (
                          <p>
                            <span className="text-muted-foreground">Address:</span>{" "}
                            {emergencyAddress}
                          </p>
                        )}
                      </div>

                      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                        <h3 className="font-semibold text-brand">Banking Details</h3>
                        <p>
                          <span className="text-muted-foreground">Bank:</span> {bankName}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Account Number:</span>{" "}
                          {accountNumber.slice(0, -4).replace(/./g, "•")}
                          {accountNumber.slice(-4)}
                        </p>
                        <p>
                          <span className="text-muted-foreground">IFSC:</span> {ifscCode}
                        </p>
                        <p>
                          <span className="text-muted-foreground">PAN:</span> {panNumber}
                        </p>
                      </div>

                      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                        <h3 className="font-semibold text-brand">Documents & Acknowledgements</h3>
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
                        <p className="text-emerald-600 dark:text-emerald-400">
                          ✓ Terms of Employment accepted
                        </p>
                        <p className="text-emerald-600 dark:text-emerald-400">
                          ✓ Privacy Policy acknowledged
                        </p>
                        <p className="text-emerald-600 dark:text-emerald-400">
                          ✓ Data processing consent granted
                        </p>
                        <p className="text-emerald-600 dark:text-emerald-400">
                          ✓ Background verification authorized
                        </p>
                        <p className="mt-3 pt-3 border-t border-border">
                          <span className="text-muted-foreground">Electronic Signature:</span>{" "}
                          <span className="font-serif text-base">{eSignature}</span>
                        </p>
                      </div>
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
