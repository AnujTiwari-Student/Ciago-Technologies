import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Clock3, PartyPopper, ShieldCheck } from "lucide-react";

import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const inrDate = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function daysBetween(a: Date, b: Date) {
  const oneDay = 86400000;
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((db - da) / oneDay);
}

/**
 * Determines whether the signed-in employee should see the pre-DOJ holding screen
 * instead of the full Employee Portal.
 *
 * Returns true when a DOJ is set on the onboarding record AND today is before it.
 */
export function shouldShowDojHold(doj: string | null | undefined): boolean {
  if (!doj) return false;
  const now = new Date();
  const dojDate = new Date(doj);
  if (Number.isNaN(dojDate.getTime())) return false;
  return daysBetween(now, dojDate) > 0;
}

export function DojHoldingScreen({
  doj,
  firstName,
  verificationStatus,
}: {
  doj: string | null;
  firstName?: string;
  verificationStatus?: string;
}) {
  const dojDate = useMemo(() => (doj ? new Date(doj) : null), [doj]);
  const [now, setNow] = useState(new Date());

  // Refresh countdown every minute
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const hasDoj = !!dojDate && !Number.isNaN(dojDate.getTime());
  const diffMs = hasDoj ? Math.max(0, dojDate!.getTime() - now.getTime()) : 0;
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);

  const headline = hasDoj ? "Your journey begins on" : "You're all set — awaiting Date of Joining";
  const dateLine = hasDoj ? inrDate.format(dojDate!) : "HR will confirm shortly";
  const verifCopy = hasDoj
    ? verificationStatus === "approved"
      ? "All documents approved by HR."
      : "HR review in progress."
    : verificationStatus === "approved"
      ? "Paperwork approved — HR is scheduling your start date."
      : "HR is reviewing your paperwork.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <Card className="overflow-hidden border-brand/30 bg-gradient-to-br from-card via-card to-brand/5">
          <CardContent className="relative p-8 sm:p-12">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(60%_60%_at_100%_0%,color-mix(in_oklab,var(--brand)_20%,transparent),transparent_70%)]"
            />
            <div className="relative">
              <div className="flex items-center gap-2 text-brand">
                <PartyPopper className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                  Welcome to Ciago
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{headline}</h1>
              <p className="mt-2 text-2xl font-bold text-brand sm:text-3xl">{dateLine}</p>
              <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
                {firstName ? `${firstName}, your` : "Your"} onboarding paperwork is on file.{" "}
                {hasDoj
                  ? "We're getting your workstation, accounts and orientation kit ready. The Employee Portal unlocks automatically on your first day."
                  : "As soon as HR verifies your documents and confirms a Date of Joining, this screen will show a live countdown and the Employee Portal will unlock on that date."}
              </p>

              {hasDoj && (
                <div className="mt-8 grid grid-cols-3 gap-3 sm:max-w-md">
                  <TimeCell value={days} label={days === 1 ? "day" : "days"} />
                  <TimeCell value={hours} label="hrs" />
                  <TimeCell value={minutes} label="min" />
                </div>
              )}

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-xl border border-border bg-background/60 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-semibold">Verification</p>
                    <p className="text-xs text-muted-foreground">{verifCopy}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-background/60 p-4">
                  <CalendarCheck2 className="mt-0.5 h-5 w-5 text-brand" />
                  <div>
                    <p className="text-sm font-semibold">Date of Joining</p>
                    <p className="text-xs text-muted-foreground">
                      {hasDoj ? inrDate.format(dojDate!) : "Pending HR assignment"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link to="/profile">Update profile</Link>
                </Button>
                <Button asChild variant="ghost">
                  <a href="mailto:hr@ciagotech.com">Contact HR</a>
                </Button>
              </div>

              <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                {hasDoj
                  ? "Portal unlocks automatically at 00:00 IST on your DOJ."
                  : "You'll get an email + in-app alert the moment HR assigns your DOJ."}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-center">
          <Badge variant="outline" className="font-mono text-[11px]">
            {hasDoj ? `Pre-boarding · Locked until ${inrDate.format(dojDate!)}` : "Pre-boarding · Awaiting DOJ"}
          </Badge>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function TimeCell({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 text-center">
      <p className="text-2xl font-black tracking-tight tabular-nums sm:text-3xl">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
