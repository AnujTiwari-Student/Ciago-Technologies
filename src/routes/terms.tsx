import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { LegalLayout, LegalSection } from "@/components/site/LegalLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Ciago Technologies" },
      {
        name: "description",
        content:
          "Terms governing the use of the Ciago Technologies website, applicant portal and related services.",
      },
      { property: "og:title", content: "Terms of Service — Ciago Technologies" },
      { property: "og:description", content: "Terms governing the use of Ciago Technologies services." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/terms" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <LegalLayout title="Terms of Service" updated="July 2026">
        <LegalSection heading="Acceptance of terms">
          <p>
            By accessing or using the Ciago Technologies website and applicant portal you agree to these
            Terms. If you do not agree, please do not use the service.
          </p>
          <p className="text-sm text-muted-foreground">
            This is a placeholder document. Replace with a version reviewed by your legal counsel before
            production use.
          </p>
        </LegalSection>
        <LegalSection heading="Acceptable use">
          <ul>
            <li>You must be at least 16 years old to create an account.</li>
            <li>You are responsible for the accuracy of any information you submit.</li>
            <li>You must not attempt to disrupt or reverse-engineer the service, or submit unlawful content.</li>
          </ul>
        </LegalSection>
        <LegalSection heading="Applicant submissions">
          <p>
            When you apply for a role, you grant Ciago Technologies a limited license to review, store and
            share your application internally for hiring purposes. You may request deletion of your record at
            any time.
          </p>
        </LegalSection>
        <LegalSection heading="Intellectual property">
          <p>
            All content, code, illustrations and branding on this site are owned by Ciago Technologies or its
            licensors and are protected by applicable copyright and trademark law.
          </p>
        </LegalSection>
        <LegalSection heading="Disclaimers">
          <p>
            The service is provided "as is" without warranties of any kind. Nothing on this site constitutes
            legal, financial or engineering advice for a specific situation.
          </p>
        </LegalSection>
        <LegalSection heading="Contact">
          <p>
            Questions about these terms? Email{" "}
            <a href="mailto:legal@ciagotech.com">legal@ciagotech.com</a>.
          </p>
        </LegalSection>
      </LegalLayout>
      <SiteFooter />
    </div>
  );
}
