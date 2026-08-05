import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type User = {
  id: string;
  aud: string;
  role: string;
  email: string;
  email_confirmed_at: string | null;
  phone: string;
  confirmed_at: string | null;
  last_sign_in_at: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  identities: unknown[];
  created_at: string | null;
  updated_at: string | null;
  is_anonymous: boolean;
};

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
} | null;

export type AuthState = {
  user: User | null;
  session: Session;
  loading: boolean;
  signOut: () => Promise<void>;
};

const noopSignOut = async () => {};

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  signOut: noopSignOut,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function displayName(user: User | null): string {
  if (!user) return "";
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name || meta?.name || user.email?.split("@")[0] || "";
}

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
  const email = primary?.emailAddress ?? raw.emailAddresses[0]?.emailAddress ?? null;
  const fullName = [raw.firstName, raw.lastName].filter(Boolean).join(" ").trim();
  return {
    id: String(raw.id),
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
  };
}

function ClerkAuthProvider({ children }: { children: ReactNode }) {
  const [impls, setImpls] = useState<{
    useUserImpl: (...args: unknown[]) => unknown;
    useSessionImpl: (...args: unknown[]) => unknown;
    useClerkImpl: (...args: unknown[]) => unknown;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const clerkReact = await import("@clerk/tanstack-react-start");
        if (cancelled) return;
        setImpls({
          useUserImpl: clerkReact.useUser as unknown as (...args: unknown[]) => unknown,
          useSessionImpl: clerkReact.useSession as unknown as (...args: unknown[]) => unknown,
          useClerkImpl: clerkReact.useClerk as unknown as (...args: unknown[]) => unknown,
        });
      } catch {
        // Clerk React SDK not available — render loading shell
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!impls) {
    const value: AuthState = { user: null, session: null, loading: true, signOut: noopSignOut };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }

  return (
    <ClerkConsumer
      useUserImpl={impls.useUserImpl}
      useSessionImpl={impls.useSessionImpl}
      useClerkImpl={impls.useClerkImpl}
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
  const loading = !(userResult.isLoaded && sessionResult.isLoaded);
  const signOut = clerk.signOut;
  const value = useMemo<AuthState>(
    () => ({ user, session: null, loading, signOut }),
    [user, loading, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
