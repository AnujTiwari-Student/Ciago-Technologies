// Auth context adapter for the React tree.
//
// Pre-migration, this module owned the AuthContext + AuthProvider that read
// the Supabase session (`onAuthStateChange`, `getSession()`) and re-emitted
// `{ user, session, loading, signOut }` to consumers.
//
// During the Clerk migration the same API surface is preserved. The
// `useAuth()` hook and `displayName(user)` helper behave identically to
// before when USE_CLERK_AUTH is false. When the flag is on, we rebuild the
// same `{ user, session, loading, signOut }` shape from Clerk's
// `useUser()`/`useSession()`/`useClerk()` hooks, normalizing Clerk's `User`
// resource into a thin object whose `email` and `user_metadata.full_name`
// fields match the existing contract.
//
// Consumers (Header, route guard, role hooks, etc.) are not edited in this
// step — the type surface stays identical across the flag boundary.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { FLAGS } from "@/lib/feature-flags";

export type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const defaultSignOut = async () => {
  await supabase.auth.signOut();
};

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  signOut: defaultSignOut,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // Flag off: keep the original Supabase-backed AuthProvider verbatim.
  if (!FLAGS.USE_CLERK_AUTH) {
    return <LegacySupabaseAuthProvider>{children}</LegacySupabaseAuthProvider>;
  }
  // Flag on: render the Clerk-backed provider. The boundary in
  // <ClerkProviderBoundary> ensures provider context is mounted before this
  // hook is consumed; if a consumer renders outside the provider we fall
  // back to a no-auth stub via the default context value above.
  return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

// -----------------------------------------------------------------------------
// displayName — same contract as before. Reads user_metadata.full_name (set by
// Supabase Auth) or user_metadata.name, falls back to email local-part. When
// running under Clerk, our adapter populates user_metadata.full_name from
// `user.firstName + user.lastName` so this helper works without changes.
// -----------------------------------------------------------------------------
export function displayName(user: User | null): string {
  if (!user) return "";
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name || meta?.name || user.email?.split("@")[0] || "";
}

// -----------------------------------------------------------------------------
// Legacy (Supabase) provider — preserved verbatim from the pre-Step-7 source
// so the flag-off system is byte-equivalent to the original implementation.
// -----------------------------------------------------------------------------
function LegacySupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      session,
      loading,
      signOut: defaultSignOut,
    }),
    [user, session, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// -----------------------------------------------------------------------------
// Clerk provider — when the feature flag is on.
//
// We dynamically import Clerk's React hooks so that the Clerk React SDK only
// enters the client bundle when the flag is on. <ClerkProviderBoundary> in
// Step 6 already gates the entire client-fragment chunk behind the flag; this
// lazy import keeps the boundary's no-op cold path free of Clerk React imports.
//
// Contract mapping (Clerk → Supabase-shaped AuthState):
//   useUser().user   → { id, email: primaryEmailAddress, user_metadata:
//     { full_name: firstName + lastName, name: firstName } }
//   signOut()        → clerk.signOut() (optionally also flush local server
//     session via the legacy defaultSignOut-equivalent path; Step 11 wires
//     a server-fn to invalidate caches)
//   loading          → useSession().isLoaded (false on first render)
//
// We deliberately normalise into a Supabase-shaped User rather than extending
// AuthState, because every consumer already destructures `user.email` and
// passes it to displayName — extending the type would force every consumer
// to edit in this step, contradicting the "minimal changes" rule.
// -----------------------------------------------------------------------------
type ClerkUserLike = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddresses: Array<{ id: string; emailAddress: string }>;
  primaryEmailAddressId: string | null;
};

function normalizeClerkUser(raw: ClerkUserLike | null | undefined): User | null {
  if (!raw) return null;
  const primary = raw.emailAddresses.find((e) => e.id === raw.primaryEmailAddressId);
  const email =
    primary?.emailAddress ?? raw.emailAddresses[0]?.emailAddress ?? null;
  const fullName = [raw.firstName, raw.lastName].filter(Boolean).join(" ").trim();
  // Synthesise a Supabase-shaped User. The `email` and `user_metadata.full_name`
  // fields are read by displayName() downstream; the `aud` field asserts a
  // non-`User`-shape check downstream won't reject us because React components
  // only ever look at user.email, user.user_metadata, and the synthetic id.
  // We do not invoke the `User` constructor — typing is asserted by the
  // structural shape — because @supabase/auth-js's `User` constructor lives
  // in the auth-js bundle rather than the typed surface; we instead cast at
  // the return boundary.
  const placeholder = String(raw.id);
  const fakeAsUser: User = {
    id: placeholder,
    aud: "",
    role: "",
    email: email ?? "",
    email_confirmed_at: null,
    phone: "",
    confirmed_at: null,
    last_sign_in_at: null,
    app_metadata: {},
    user_metadata: {
      ...(fullName ? { full_name: fullName } : {}),
      ...(raw.firstName ? { name: raw.firstName } : {}),
    },
    identities: [],
    created_at: null,
    updated_at: null,
    is_anonymous: false,
  } as unknown as User;
  return fakeAsUser;
}

function ClerkAuthProvider({ children }: { children: ReactNode }) {
  // useState/useEffect/useMemo suspend while we dynamic-import Clerk React.
  // The fragment chunk loads in a single round trip; the bridge publishes
  // the active session token in parallel.
  const [{ useUserImpl, useSessionImpl, useClerkImpl }, setImpls] = useState<{
    useUserImpl: (...args: unknown[]) => unknown;
    useSessionImpl: (...args: unknown[]) => unknown;
    useClerkImpl: (...args: unknown[]) => unknown;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const clerkReact = await import("@clerk/tanstack-start");
      if (cancelled) return;
      setImpls({
        useUserImpl: clerkReact.useUser as unknown as (...args: unknown[]) => unknown,
        useSessionImpl: clerkReact.useSession as unknown as (...args: unknown[]) => unknown,
        useClerkImpl: clerkReact.useClerk as unknown as (...args: unknown[]) => unknown,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!{ useUserImpl, useSessionImpl, useClerkImpl }.useUserImpl) {
    const value: AuthState = {
      user: null,
      session: null,
      loading: true,
      signOut: defaultSignOut,
    };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }

  return (
    <ClerkConsumer
      useUserImpl={useUserImpl}
      useSessionImpl={useSessionImpl}
      useClerkImpl={useClerkImpl}
    >
      {children}
    </ClerkConsumer>
  );
}

function ClerkConsumer({
  useUserImpl,
  useSessionImpl,
  useClerkImpl,
  children,
}: {
  useUserImpl: (...args: unknown[]) => unknown;
  useSessionImpl: (...args: unknown[]) => unknown;
  useClerkImpl: (...args: unknown[]) => unknown;
  children: ReactNode;
}) {
  const userResult = (useUserImpl() as { user: ClerkUserLike | null; isLoaded: boolean }) ?? {
    user: null,
    isLoaded: false,
  };
  const sessionResult = (useSessionImpl() as { isLoaded: boolean }) ?? { isLoaded: false };
  const clerk = (useClerkImpl() as { signOut: () => Promise<void> }) ?? {
    signOut: async () => {},
  };
  const user = useMemo(() => normalizeClerkUser(userResult.user), [userResult.user]);
  const session: Session | null = null; // Clerk doesn't expose a Supabase-shaped session; the legacy "session" was only inspected for access_token in auth-attacher, which now reads from window.__clerkAuthToken.
  const loading = !(userResult.isLoaded && sessionResult.isLoaded);
  const signOut = clerk.signOut;
  const value = useMemo<AuthState>(
    () => ({ user, session, loading, signOut }),
    [user, session, loading, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
