import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Camera,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  Sun,
  User as UserIcon,
} from "lucide-react";

import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { useAuth, displayName } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { uploadFile } from "@/lib/upload.functions";
import { getMyProfile, upsertMyProfile, type ProfileRow } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile | Ciago Technologies" },
      {
        name: "description",
        content: "Manage your Ciago Technologies profile, security, and appearance.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

type SectionId = "public" | "account" | "appearance";

const SECTIONS: { id: SectionId; label: string; icon: typeof UserIcon }[] = [
  { id: "public", label: "Public profile", icon: UserIcon },
  { id: "account", label: "Account & security", icon: ShieldCheck },
  { id: "appearance", label: "Appearance", icon: Palette },
];

function ProfilePage() {
  const { user } = useAuth();
  const [section, setSection] = useState<SectionId>("public");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Account</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          {user?.email && (
            <>
              Signed in as <span className="font-medium text-foreground">{user.email}</span>
            </>
          )}
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav className="flex flex-row gap-1 overflow-x-auto rounded-xl border border-border bg-card p-2 lg:flex-col">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = section === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSection(s.id)}
                    className={cn(
                      "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand/10 text-brand"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {s.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0">
            {section === "public" && <PublicProfileSection />}
            {section === "account" && <AccountSection />}
            {section === "appearance" && <AppearanceSection />}
          </div>
        </div>
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}

// ============ PUBLIC PROFILE ============
function PublicProfileSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(upsertMyProfile);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  const [form, setForm] = useState<Partial<ProfileRow>>({});
  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? displayName(user),
        public_email: profile.public_email ?? "",
        bio: profile.bio ?? "",
        pronouns: profile.pronouns ?? "",
        website: profile.website ?? "",
        linkedin: profile.linkedin ?? "",
        portfolio: profile.portfolio ?? "",
        leetcode: profile.leetcode ?? "",
      });
    }
  }, [profile, user]);

  const mutation = useMutation({
    mutationFn: (payload: any) => saveProfile({ data: payload }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  const set = <K extends keyof ProfileRow>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      full_name: (form.full_name || "").trim(),
      public_email: (form.public_email || "").trim(),
      bio: (form.bio || "").trim(),
      pronouns: (form.pronouns || "").trim(),
      website: (form.website || "").trim(),
      linkedin: (form.linkedin || "").trim(),
      portfolio: (form.portfolio || "").trim(),
      leetcode: (form.leetcode || "").trim(),
    });
  };

  return (
    <div className="space-y-6">
      <AvatarCard profile={profile} loading={isLoading} />

      <Card>
        <CardContent className="p-6 sm:p-8">
          <h2 className="text-lg font-bold">Public profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This information is visible to the Ciago team on your applications.
          </p>
          <Separator className="my-6" />
          <form onSubmit={onSubmit} className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  value={form.full_name ?? ""}
                  onChange={(e) => set("full_name", e.target.value)}
                  placeholder="Your name"
                  maxLength={120}
                />
              </Field>
              <Field label="Pronouns">
                <Input
                  value={form.pronouns ?? ""}
                  onChange={(e) => set("pronouns", e.target.value)}
                  placeholder="they/them"
                  maxLength={40}
                />
              </Field>
            </div>

            <Field label="Public email" hint="Shown on your profile. Sign-in email stays private.">
              <Input
                type="email"
                value={form.public_email ?? ""}
                onChange={(e) => set("public_email", e.target.value)}
                placeholder="you@example.com"
              />
            </Field>

            <Field label="Bio" hint="Up to 600 characters.">
              <Textarea
                value={form.bio ?? ""}
                onChange={(e) => set("bio", e.target.value)}
                rows={4}
                maxLength={600}
                placeholder="Software engineer building distributed systems…"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Website">
                <Input
                  type="url"
                  value={form.website ?? ""}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder="https://example.com"
                />
              </Field>
              <Field label="LinkedIn">
                <Input
                  type="url"
                  value={form.linkedin ?? ""}
                  onChange={(e) => set("linkedin", e.target.value)}
                  placeholder="https://linkedin.com/in/…"
                />
              </Field>
              <Field label="Portfolio">
                <Input
                  type="url"
                  value={form.portfolio ?? ""}
                  onChange={(e) => set("portfolio", e.target.value)}
                  placeholder="https://…"
                />
              </Field>
              <Field label="LeetCode">
                <Input
                  type="url"
                  value={form.leetcode ?? ""}
                  onChange={(e) => set("leetcode", e.target.value)}
                  placeholder="https://leetcode.com/u/…"
                />
              </Field>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={mutation.isPending || isLoading}
                className="bg-brand text-brand-foreground hover:bg-brand-glow"
              >
                <Save className="mr-2 h-4 w-4" />
                {mutation.isPending ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm font-semibold">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ============ AVATAR ============
function AvatarCard({ profile, loading }: { profile: ProfileRow | undefined; loading: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const saveProfile = useServerFn(upsertMyProfile);
  const uploadFn = useServerFn(uploadFile);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const initials = (profile?.full_name || displayName(user) || user?.email || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2 MB");
      return;
    }
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) {
      toast.error("Use a PNG, JPG, WEBP, or GIF image");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const buf = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      await uploadFn({
        data: { bucket: "avatars", path, base64, contentType: file.type, upsert: true },
      });
      await saveProfile({ data: { avatar_path: path } as any });
      toast.success("Avatar updated");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:p-8">
        <div className="relative">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-brand/15 text-3xl font-black text-brand">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
            ) : loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              initials
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-border bg-background text-foreground shadow hover:bg-muted"
            aria-label="Change avatar"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={onFile}
          />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="truncate text-xl font-bold">
            {profile?.full_name || displayName(user) || "Ciago member"}
          </p>
          <p className="mt-1 flex items-center justify-center gap-1.5 truncate text-sm text-muted-foreground sm:justify-start">
            <Mail className="h-3.5 w-3.5" /> {user?.email}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">PNG, JPG, WEBP or GIF. Max 2 MB.</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ ACCOUNT ============
function AccountSection() {
  const { user, signOut } = useAuth();
  const [saving, setSaving] = useState(false);

  const manageAccount = () => {
    window.open("https://accounts.clerk.dev/user", "_blank");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-center gap-2 text-brand">
            <ShieldCheck className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-widest">Sign-in</p>
          </div>
          <h2 className="mt-2 text-lg font-bold">Account details</h2>
          <Separator className="my-6" />
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-1 font-medium">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">User ID</dt>
              <dd className="mt-1 truncate font-mono text-xs">{user?.id}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-center gap-2 text-brand">
            <KeyRound className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-widest">Security</p>
          </div>
          <h2 className="mt-2 text-lg font-bold">Password &amp; security</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your password, two-factor authentication, and connected accounts through Clerk.
          </p>
          <Separator className="my-6" />
          <Button
            type="button"
            onClick={manageAccount}
            disabled={saving}
            className="bg-brand text-brand-foreground hover:bg-brand-glow"
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Manage account security
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <h2 className="text-lg font-bold">Session</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign out of this device.</p>
          <Separator className="my-6" />
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ APPEARANCE ============
function AppearanceSection() {
  const { theme, toggle } = useTheme();
  const options: { value: "light" | "dark"; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];
  return (
    <Card>
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-center gap-2 text-brand">
          <Palette className="h-4 w-4" />
          <p className="text-xs font-semibold uppercase tracking-widest">Theme</p>
        </div>
        <h2 className="mt-2 text-lg font-bold">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how Ciago looks to you. Applies across the app.
        </p>
        <Separator className="my-6" />
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((o) => {
            const Icon = o.icon;
            const active = theme === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  if (theme !== o.value) toggle();
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl border-2 px-4 py-4 text-left transition-colors",
                  active ? "border-brand bg-brand/5" : "border-border hover:border-brand/50",
                )}
              >
                <Icon className={cn("h-5 w-5", active ? "text-brand" : "text-muted-foreground")} />
                <div>
                  <p className="font-semibold">{o.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.value === "light"
                      ? "Bright interface for daytime."
                      : "Dimmed interface for low light."}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
          <Monitor className="h-4 w-4" />
          System theme sync coming soon. Your choice is remembered on this device.
        </div>
      </CardContent>
    </Card>
  );
}
