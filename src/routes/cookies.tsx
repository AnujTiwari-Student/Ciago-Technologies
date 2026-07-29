import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { LegalLayout, LegalSection } from "@/components/site/LegalLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Settings — Ciago Technologies" },
      {
        name: "description",
        content:
          "Review the cookies used across the Ciago Technologies website and update your preferences at any time.",
      },
      { property: "og:title", content: "Cookie Settings — Ciago Technologies" },
      {
        property: "og:description",
        content: "Manage your cookie preferences for Ciago Technologies.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/cookies" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/cookies" }],
  }),
  component: CookiesPage,
});

type Prefs = { analytics: boolean; marketing: boolean };
const KEY = "ciago:cookie-prefs";
const defaults: Prefs = { analytics: false, marketing: false };

function CookiesPage() {
  const [prefs, setPrefs] = useState<Prefs>(defaults);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setPrefs({ ...defaults, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  function save(next: Prefs) {
    setPrefs(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    toast.success("Cookie preferences saved.");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <LegalLayout title="Cookie Settings" updated="July 2026">
        <LegalSection heading="About cookies on this site">
          <p>
            We use a small number of cookies and equivalent technologies to keep the site working,
            to remember your theme preference, and — with your consent — to understand aggregate
            usage.
          </p>
        </LegalSection>

        <div className="space-y-4">
          <PrefRow
            title="Strictly necessary"
            desc="Required for authentication, security and remembering your theme. Cannot be disabled."
            checked
            disabled
          />
          <PrefRow
            title="Analytics"
            desc="Anonymous usage metrics that help us prioritise improvements."
            checked={prefs.analytics}
            onChange={(v) => save({ ...prefs, analytics: v })}
          />
          <PrefRow
            title="Marketing"
            desc="Used only if we ever run measured advertising campaigns. Off by default."
            checked={prefs.marketing}
            onChange={(v) => save({ ...prefs, marketing: v })}
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            className="bg-brand text-brand-foreground hover:bg-brand-glow"
            onClick={() => save({ analytics: true, marketing: true })}
          >
            Accept all
          </Button>
          <Button variant="outline" onClick={() => save({ analytics: false, marketing: false })}>
            Reject non-essential
          </Button>
        </div>
      </LegalLayout>
      <SiteFooter />
      <Toaster />
    </div>
  );
}

function PrefRow({
  title,
  desc,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}
