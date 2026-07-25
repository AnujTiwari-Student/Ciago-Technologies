import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { LegalLayout, LegalSection } from "@/components/site/LegalLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Ciago Technologies" },
      {
        name: "description",
        content:
          "How Ciago Technologies collects, uses, stores and protects personal information across our website, applicant portal and client engagements.",
      },
      { property: "og:title", content: "Privacy Policy — Ciago Technologies" },
      { property: "og:description", content: "How Ciago Technologies handles your personal information." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/privacy" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <LegalLayout title="Privacy Policy" updated="July 2026">
        <LegalSection heading="Overview">
          <p>
            Ciago Technologies ("Ciago", "we", "us") builds and operates websites, applicant portals and
            engineering platforms for our clients. This policy explains what personal information we collect,
            why we collect it, how we use it, and the rights you have over it.
          </p>
          <p className="text-sm text-muted-foreground">
            This is a placeholder policy provided as a starting point. Please replace with a version reviewed
            by your legal counsel before going to production.
          </p>
        </LegalSection>

        <LegalSection heading="Information we collect">
          <ul>
            <li>Contact information you submit through inquiry forms (name, email, company).</li>
            <li>Applicant information submitted through our careers pages (name, email, resume, portfolio links).</li>
            <li>Authentication data managed by our identity provider when you create an account.</li>
            <li>Basic technical data — IP address, user agent, referrer — required to operate the site securely.</li>
          </ul>
        </LegalSection>

        <LegalSection heading="How we use information">
          <ul>
            <li>To respond to inquiries and support requests.</li>
            <li>To evaluate applications and communicate with candidates.</li>
            <li>To operate, secure and improve our site and services.</li>
            <li>To comply with legal, regulatory and contractual obligations.</li>
          </ul>
        </LegalSection>

        <LegalSection heading="Sharing">
          <p>
            We share information only with vetted service providers acting on our behalf (identity, hosting,
            transactional email, storage) and only to the extent needed to deliver the service. We do not sell
            personal information.
          </p>
        </LegalSection>

        <LegalSection heading="Data retention">
          <p>
            Applicant records are retained for up to 24 months after a decision is made unless you request
            deletion earlier. Inquiry records are retained for up to 12 months.
          </p>
        </LegalSection>

        <LegalSection heading="Your rights">
          <p>
            Depending on your jurisdiction, you may have rights to access, correct, export or delete your
            personal information. Contact <a href="mailto:privacy@ciagotech.com">privacy@ciagotech.com</a> to
            exercise these rights.
          </p>
        </LegalSection>

        <LegalSection heading="Contact">
          <p>
            Questions about this policy? Email{" "}
            <a href="mailto:privacy@ciagotech.com">privacy@ciagotech.com</a>.
          </p>
        </LegalSection>
      </LegalLayout>
      <SiteFooter />
    </div>
  );
}
