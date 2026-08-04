import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";
import { ThemeProvider } from "../lib/theme";
import { AuthProvider } from "../lib/auth";
import { ClerkProviderBoundary } from "@/integrations/clerk/client";
import { useEnsureUserMapped } from "@/hooks/use-ensure-user-mapped";
import { isAuthButtonEnabledFn } from "@/lib/feature-flags.functions";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async () => ({
    authButtonEnabled: await isAuthButtonEnabledFn(),
  }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { property: "og:site_name", content: "Ciago Technologies" },
      { name: "theme-color", content: "#0f172a" },
      { name: "referrer", content: "strict-origin-when-cross-origin" },
      {
        httpEquiv: "Content-Security-Policy",
        content: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'none'",
          "form-action 'self'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' https://fonts.gstatic.com data:",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.com https://*.clerk.accounts.dev",
          // Clerk domains are required when USE_CLERK_AUTH is on. We list
          // both the dev frontend (`*.clerk.accounts.dev`) and the
          // production frontend (`*.clerk.com` / `clerk.com`) so cutover
          // and rollback don't require a code change.
          "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://*.clerk.com https://*.clerk.accounts.dev",
          // Clerk's browser.js spins up a Web Worker from a blob: URL
          // when running in dev mode. Without `worker-src 'self' blob:`,
          // the browser falls back to script-src and refuses the worker.
          "worker-src 'self' blob:",
          "frame-src https://challenges.cloudflare.com https://*.clerk.com https://*.clerk.accounts.dev https://accounts.clerk.com",
          "connect-src 'self' https://api.resend.com https://challenges.cloudflare.com https://*.clerk.com https://*.clerk.accounts.dev https://cdn.configcat.com https://clerk-telemetry.com",
        ].join("; "),
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Ciago Technologies",
          description:
            "Premium technology services & consulting — custom software, cloud infrastructure, DevOps and SRE.",
          slogan: "Architecting the Future of Digital Business",
          areaServed: "Worldwide",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <ClerkProviderBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            {/* Step 11: ensures a Clerk user's Supabase mapping exists before
                any authenticated route reads data. No-op when flag is off or
                user is signed out. */}
            <EnsureUserMapped />
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProviderBoundary>
  );
}

function EnsureUserMapped() {
  useEnsureUserMapped();
  return null;
}
