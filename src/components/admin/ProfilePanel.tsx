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

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAuth, displayName } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { uploadFile } from "@/lib/upload.functions";
import { getMyProfile, upsertMyProfile, type ProfileRow } from "@/lib/profile.functions";

type SectionId = "public" | "account" | "appearance";

const SECTIONS: { id: SectionId; label: string; icon: typeof UserIcon }[] = [
  { id: "public", label: "Public profile", icon: UserIcon },
  { id: "account", label: "Account & security", icon: ShieldCheck },
  { id: "appearance", label: "Appearance", icon: Palette },
];

export function ProfilePanel() {
  const { user } = useAuth();
  const [section, setSection] = useState<SectionId>("public");

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav className="flex flex-row gap-1 overflow-x-auto rounded-xl border border-border bg-card p-2 lg:flex-col">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                    section === s.id
                      ? "bg-brand text-white shadow-md"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">{s.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div>
          {section === "public" && <PublicProfileSection />}
          {section === "account" && <AccountSecuritySection />}
          {section === "appearance" && <AppearanceSection />}
        </div>
      </div>
    </div>
  );
}

function PublicProfileSection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const fetchProfile = useServerFn(getMyProfile);
  const upsertMutation = useServerFn(upsertMyProfile);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setBio(profile.bio ?? "");
      setAvatar(profile.avatar_path ?? "");
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertMutation({
        data: { full_name: fullName.trim() || null, bio: bio.trim() || null, avatar_path: avatar.trim() || null },
      }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: any) => toast.error(e?.message || "Update failed"),
  });

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5 MB)");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadFile({ data: { bucket: "avatars", file } });
      setAvatar(result.path);
      toast.success("Avatar uploaded");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold">Public profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This info is visible to other team members.
        </p>

        <div className="mt-6 space-y-6">
          <div>
            <Label>Avatar</Label>
            <div className="mt-2 flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-muted">
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Change photo
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A few words about yourself"
              rows={4}
              className="mt-2"
            />
          </div>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save changes
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountSecuritySection() {
  const { user } = useAuth();

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold">Account & security</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your authentication and account details.
        </p>

        <div className="mt-6 space-y-6">
          <div>
            <Label>Email</Label>
            <div className="mt-2 flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{user?.email}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Managed by your organization's authentication provider.
            </p>
          </div>

          <Separator />

          <div>
            <Label>Password</Label>
            <p className="mt-2 text-sm text-muted-foreground">
              Password changes are handled through your authentication provider (Clerk).
            </p>
            <Button variant="outline" size="sm" className="mt-3" disabled>
              <KeyRound className="mr-2 h-4 w-4" />
              Change password
            </Button>
          </div>

          <Separator />

          <div>
            <Label>Sign out</Label>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign out of your account on this device.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 text-destructive hover:bg-destructive/10"
              onClick={() => {
                window.location.href = "/auth?action=sign-out";
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AppearanceSection() {
  const { theme, toggle } = useTheme();

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize how the app looks on your device.
        </p>

        <div className="mt-6">
          <Label>Theme</Label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={theme === "dark" ? toggle : undefined}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all",
                theme === "light"
                  ? "border-brand bg-brand/5"
                  : "border-border hover:border-brand/50"
              )}
            >
              <Sun className="h-6 w-6" />
              <span className="text-sm font-medium">Light</span>
            </button>

            <button
              type="button"
              onClick={theme === "light" ? toggle : undefined}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all",
                theme === "dark"
                  ? "border-brand bg-brand/5"
                  : "border-border hover:border-brand/50"
              )}
            >
              <Moon className="h-6 w-6" />
              <span className="text-sm font-medium">Dark</span>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
