import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { LegalLayout, LegalSection } from "@/components/site/LegalLayout";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security — Ciago Technologies" },
      {
        name: "description",
        content:
          "How Ciago Technologies protects customer and applicant data — encryption, access control, monitoring and responsible disclosure.",
      },
      { property: "og:title", content: "Security — Ciago Technologies" },
      {
        property: "og:description",
        content:
          "Security practices, data protection and responsible disclosure at Ciago Technologies.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/security" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/security" }],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <LegalLayout title="Security" updated="July 2026">
        <LegalSection heading="Our approach">
          <p>
            Security is designed into every layer of our stack — from client-side validation to
            infrastructure hardening. This page summarises the controls we operate today.
          </p>
        </LegalSection>
        <LegalSection heading="Data protection">
          <ul>
            <li>All traffic to our services is encrypted with TLS 1.2+.</li>
            <li>Databases and object storage are encrypted at rest.</li>
            <li>Row-level authorization guards applicant and client records.</li>
            <li>
              Resume files are stored in a private bucket accessible only via short-lived signed
              URLs.
            </li>
          </ul>
        </LegalSection>
        <LegalSection heading="Access control">
          <ul>
            <li>Least-privilege access; MFA required for all staff accounts.</li>
            <li>Production changes go through peer review and audit-logged pipelines.</li>
            <li>Secrets are rotated on a set cadence and after any personnel change.</li>
          </ul>
        </LegalSection>
        <LegalSection heading="Monitoring & response">
          <p>
            We operate 24/7 SRE coverage with automated alerting for availability, latency and abuse
            signals. Security-relevant events feed a centralised, retained audit trail.
          </p>
        </LegalSection>
        <LegalSection heading="Responsible disclosure">
          <p>
            If you believe you've found a security issue, please email{" "}
            <a href="mailto:security@ciagotech.com">security@ciagotech.com</a> with a description
            and reproduction steps. We commit to acknowledge within 2 business days and to keep you
            informed through resolution. Please do not publicly disclose before we've had a chance
            to respond.
          </p>
        </LegalSection>
      </LegalLayout>
      <SiteFooter />
    </div>
  );
}
