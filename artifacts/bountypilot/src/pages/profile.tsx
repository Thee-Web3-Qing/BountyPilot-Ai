import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, User } from "lucide-react";

interface Profile {
  fullName?: string; creatorName?: string; mainPlatforms?: string;
  contentFormats?: string; niche?: string; skillLevel?: string;
  preferredBountyTypes?: string; minimumReward?: number;
  weeklyContentCapacity?: number; targetMonthlyEarnings?: number;
  creatorStrengths?: string; creatorWeaknesses?: string;
  portfolioLinks?: string; notes?: string;
}

export function Profile() {
  const { user, token } = useAuth();
  const [profile, setProfile] = useState<Profile>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d.profile) setProfile(d.profile); })
      .finally(() => setLoading(false));
  }, [token]);

  const set = (k: keyof Profile, v: string | number) => setProfile((p) => ({ ...p, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(profile),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground font-mono">
      <Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading profile...
    </div>
  );

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
          <User className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-sans uppercase tracking-tight">Creator Profile</h1>
          <p className="text-muted-foreground font-mono text-sm mt-0.5">
            @{user?.username} · {user?.email}
          </p>
        </div>
      </div>

      <p className="text-muted-foreground font-mono text-xs border-l-2 border-primary/50 pl-3">
        Your profile is used to personalise opportunity scoring — the more you fill in, the better the AI understands your strengths and goals.
      </p>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <Section title="Identity">
          <Row2>
            <Field label="Full Name" value={profile.fullName} onChange={(v) => set("fullName", v)} placeholder="Your real name" />
            <Field label="Creator Name / Handle" value={profile.creatorName} onChange={(v) => set("creatorName", v)} placeholder="@yourhandle" />
          </Row2>
        </Section>

        <Section title="Creator Focus">
          <Field label="Main Platforms" value={profile.mainPlatforms} onChange={(v) => set("mainPlatforms", v)} placeholder="YouTube, Twitter, Mirror, Substack..." />
          <Field label="Content Formats" value={profile.contentFormats} onChange={(v) => set("contentFormats", v)} placeholder="Long-form video, Twitter threads, articles..." />
          <Field label="Niche" value={profile.niche} onChange={(v) => set("niche", v)} placeholder="DeFi, Layer 2, NFTs, Gaming, DePIN..." />
          <Row2>
            <Field label="Skill Level" value={profile.skillLevel} onChange={(v) => set("skillLevel", v)} placeholder="Beginner / Intermediate / Expert" />
            <Field label="Preferred Bounty Types" value={profile.preferredBountyTypes} onChange={(v) => set("preferredBountyTypes", v)} placeholder="Articles, Videos, Threads..." />
          </Row2>
        </Section>

        <Section title="Goals & Capacity">
          <Row2>
            <Field label="Minimum Reward ($)" value={profile.minimumReward?.toString()} onChange={(v) => set("minimumReward", parseFloat(v) || 0)} placeholder="e.g. 200" type="number" />
            <Field label="Weekly Content Capacity (hrs)" value={profile.weeklyContentCapacity?.toString()} onChange={(v) => set("weeklyContentCapacity", parseInt(v) || 0)} placeholder="e.g. 10" type="number" />
          </Row2>
          <Field label="Target Monthly Earnings ($)" value={profile.targetMonthlyEarnings?.toString()} onChange={(v) => set("targetMonthlyEarnings", parseFloat(v) || 0)} placeholder="e.g. 2000" type="number" />
        </Section>

        <Section title="Self Assessment">
          <TextareaField label="Creator Strengths" value={profile.creatorStrengths} onChange={(v) => set("creatorStrengths", v)} placeholder="e.g. Strong research skills, can produce videos quickly, existing audience in DeFi..." />
          <TextareaField label="Creator Weaknesses" value={profile.creatorWeaknesses} onChange={(v) => set("creatorWeaknesses", v)} placeholder="e.g. Limited technical knowledge, no podcast setup..." />
        </Section>

        <Section title="Portfolio & Notes">
          <TextareaField label="Portfolio Links" value={profile.portfolioLinks} onChange={(v) => set("portfolioLinks", v)} placeholder="YouTube channel, Mirror, Twitter, personal site..." />
          <TextareaField label="Additional Notes" value={profile.notes} onChange={(v) => set("notes", v)} placeholder="Anything else about your creator setup..." />
        </Section>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving} className="font-mono uppercase tracking-wider">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Profile
          </Button>
          {saved && (
            <span className="flex items-center gap-2 text-green-400 font-mono text-sm">
              <CheckCircle className="w-4 h-4" /> Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6 flex flex-col gap-4">
        <p className="font-mono text-xs uppercase tracking-wider text-primary border-b border-border pb-2">{title}</p>
        {children}
      </CardContent>
    </Card>
  );
}

function Row2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value?: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <div>
      <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1.5">{label}</label>
      <Input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="font-mono text-sm bg-background" />
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1.5">{label}</label>
      <Textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="font-mono text-sm bg-background min-h-[80px] resize-y" />
    </div>
  );
}
