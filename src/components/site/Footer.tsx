import { Link } from "@tanstack/react-router";
import { Github, Linkedin, Twitter, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BrandLogo } from "@/components/site/Header";
import { StatusWidget } from "@/components/site/StatusWidget";

type Col = {
  title: string;
  links: { label: string; to?: string; href?: string; hash?: string }[];
};

const cols: Col[] = [
  {
    title: "Solutions",
    links: [
      { label: "Custom Engineering", to: "/what-we-do" },
      { label: "Cloud & DevOps", to: "/what-we-do" },
      { label: "Industry Solutions", to: "/what-we-do" },
      { label: "Backend & Security", to: "/what-we-do" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about-us" },
      { label: "Careers", to: "/careers" },
      { label: "What we think", to: "/what-we-think" },
      { label: "Contact", to: "/", hash: "contact" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Whitepapers", to: "/resources" },
      { label: "Project Estimator", to: "/estimate" },
      { label: "Blog", to: "/what-we-think" },
      { label: "Support", to: "/", hash: "contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
      { label: "Cookie Settings", to: "/cookies" },
      { label: "Security", to: "/security" },
    ],
  },
];

const socials: { label: string; href: string; Icon: typeof Github }[] = [
  { label: "GitHub", href: "https://github.com/", Icon: Github },
  { label: "LinkedIn", href: "https://www.linkedin.com/", Icon: Linkedin },
  { label: "Twitter", href: "https://twitter.com/", Icon: Twitter },
  { label: "YouTube", href: "https://youtube.com/", Icon: Youtube },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2.6fr]">
          <div>
            <Link to="/" className="flex items-center gap-2" aria-label="Ciago Technologies — Home">
              <BrandLogo className="h-11 w-auto" />
            </Link>

            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              Premium technology services & consulting for teams building what's next.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLFormElement).reset();
                toast.success("Subscribed. Welcome aboard.");
              }}
              className="mt-6 flex max-w-sm gap-2"
            >
              <Input type="email" required placeholder="you@company.com" aria-label="Email" />
              <Button type="submit" className="bg-brand text-brand-foreground hover:bg-brand-glow">
                Subscribe
              </Button>
            </form>
            <div className="mt-6 flex gap-2">
              {socials.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {cols.map((c) => (
              <div key={c.title}>
                <h4 className="text-sm font-semibold text-foreground">{c.title}</h4>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      {l.to ? (
                        <Link
                          to={l.to}
                          hash={l.hash}
                          className="text-sm text-muted-foreground transition-colors hover:text-brand"
                        >
                          {l.label}
                        </Link>
                      ) : (
                        <a
                          href={l.href ?? "#"}
                          className="text-sm text-muted-foreground transition-colors hover:text-brand"
                        >
                          {l.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Ciago Technologies. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <StatusWidget />
            <p className="text-xs text-muted-foreground">Engineered with care · Global delivery</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
