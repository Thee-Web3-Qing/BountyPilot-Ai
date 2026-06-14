import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, User, X, Plus, Calendar } from "lucide-react";

interface Profile {
  fullName?: string; creatorName?: string; mainPlatforms?: string;
  contentFormats?: string; niche?: string; skillLevel?: string;
  preferredBountyTypes?: string; minimumReward?: number;
  weeklyContentCapacity?: number; targetMonthlyEarnings?: number;
  creatorStrengths?: string; creatorWeaknesses?: string;
  portfolioLinks?: string; notes?: string;
}

const PLATFORMS = [
  "YouTube", "Twitter / X", "LinkedIn", "Instagram", "TikTok",
  "Mirror", "Substack", "Farcaster", "Lens", "Discord", "Telegram", "Medium",
];

const CONTENT_FORMATS = [
  "Article / Thread", "Long-form Video", "Short-form Video", "Podcast",
  "Newsletter", "Tutorial", "Design", "Infographic", "Comic Strip", "Meme",
];

const NICHES = [
  "DeFi", "NFTs", "Layer 2", "Gaming", "DePIN", "DAOs",
  "Infrastructure", "Trading", "Education", "Web3 General",
];

const SKILL_LEVELS = ["Beginner", "Intermediate", "Expert"];

const BOUNTY_TYPES = [
  "Articles", "Videos", "Threads", "Tutorials",
  "Technical Writing", "Design", "Memes", "Podcasts",
];

function formatDate(date: string | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function computeSubscriptionStatus(user: any) {
  if (!user) return null;
  if (user.plan === "lifetime") return { plan: "Lifetime", label: "Unlimited", color: "text-green-400" };
  if (user.plan === "active" && user.subscriptionEndsAt) {
    const end = new Date(user.subscriptionEndsAt);
    const now = new Date();
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      plan: "Active",
      label: daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "Expired",
      color: daysLeft > 0 ? "text-green-400" : "text-red-400",
      endsAt: formatDate(user.subscriptionEndsAt),
    };
  }
  if (user.plan === "trial" || user.plan === "pending") {
    const end = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
    const now = new Date();
    if (end && end > now) {
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        plan: "Trial",
        label: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`,
        color: "text-amber-400",
        endsAt: formatDate(user.trialEndsAt),
      };
    }
    return { plan: "Expired", label: "Trial ended", color: "text-red-400" };
  }
  return { plan: user.plan, label: "", color: "text-muted-foreground" };
}

export function Profile() {
  const { user, token } = useAuth();
  const [profile, setProfile] = useState<Profile>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const subStatus = computeSubscriptionStatus(user);

  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d.profile) setProfile(d.profile); })
      .finally(() => setLoading(false));
  }, [token]);

  const set = (k: keyof Profile, v: string | number) =>
    setProfile((p) => ({ ...p, [k]: v }));

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
      <div className="flex items-center justify-between">
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
        {subStatus && (
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className={`font-mono text-sm font-semibold ${subStatus.color}`}>{subStatus.plan}</span>
              <span className="text-muted-foreground font-mono text-xs">{subStatus.label}</span>
            </div>
            {subStatus.endsAt && (
              <p className="font-mono text-xs text-muted-foreground mt-0.5">
                <Calendar className="w-3 h-3 inline mr-1" />ends {subStatus.endsAt}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-muted-foreground font-mono text-xs border-l-2 border-primary/50 pl-3">
        Your profile personalises opportunity scoring — the more you fill in, the better the AI understands your strengths and goals.
      </p>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <Section title="Identity">
          <Row2>
            <Field label="Full Name" value={profile.fullName} onChange={(v) => set("fullName", v)} placeholder="Your real name" />
            <Field label="Creator Name / Handle" value={profile.creatorName} onChange={(v) => set("creatorName", v)} placeholder="@yourhandle" />
          </Row2>
        </Section>

        <Section title="Creator Focus">
          <MultiChipSelect
            label="Main Platforms"
            options={PLATFORMS}
            value={profile.mainPlatforms || ""}
            onChange={(v) => set("mainPlatforms", v)}
          />
          <MultiChipSelect
            label="Content Formats"
            options={CONTENT_FORMATS}
            value={profile.contentFormats || ""}
            onChange={(v) => set("contentFormats", v)}
          />
          <MultiChipSelect
            label="Niche"
            options={NICHES}
            value={profile.niche || ""}
            onChange={(v) => set("niche", v)}
          />
          <Row2>
            <SingleChipSelect
              label="Skill Level"
              options={SKILL_LEVELS}
              value={profile.skillLevel || ""}
              onChange={(v) => set("skillLevel", v)}
            />
            <MultiChipSelect
              label="Preferred Bounty Types"
              options={BOUNTY_TYPES}
              value={profile.preferredBountyTypes || ""}
              onChange={(v) => set("preferredBountyTypes", v)}
            />
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

// ─── Multi-chip selector (comma-separated storage) ─────────────────────────
function MultiChipSelect({
  label, options, value, onChange,
}: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  const selected = value
    ? value.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const toggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt];
    onChange(next.join(", "));
  };

  const removeCustom = (opt: string) => {
    const next = selected.filter((s) => s !== opt);
    onChange(next.join(", "));
  };

  const customItems = selected.filter((s) => !options.includes(s));
  const [customInput, setCustomInput] = useState("");

  const addCustom = () => {
    const val = customInput.trim();
    if (!val || selected.includes(val)) { setCustomInput(""); return; }
    onChange([...selected, val].join(", "));
    setCustomInput("");
  };

  return (
    <div>
      <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`font-mono text-xs px-2.5 py-1 rounded-sm border transition-colors ${
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {opt}
            </button>
          );
        })}
        {customItems.map((opt) => (
          <span
            key={opt}
            className="font-mono text-xs px-2.5 py-1 rounded-sm border border-primary bg-primary/15 text-primary flex items-center gap-1"
          >
            {opt}
            <button type="button" onClick={() => removeCustom(opt)} className="hover:text-red-400 ml-0.5">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder="Custom…"
            className="font-mono text-xs px-2 py-1 rounded-sm border border-dashed border-border bg-transparent text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 w-20"
          />
          {customInput.trim() && (
            <button
              type="button"
              onClick={addCustom}
              className="text-primary hover:text-primary/70"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Single-chip selector (radio style) ───────────────────────────────────
function SingleChipSelect({
  label, options, value, onChange,
}: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(active ? "" : opt)}
              className={`font-mono text-xs px-2.5 py-1 rounded-sm border transition-colors ${
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Supporting components ─────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6 flex flex-col gap-5">
        <p className="font-mono text-xs uppercase tracking-wider text-primary border-b border-border pb-2">{title}</p>
        {children}
      </CardContent>
    </Card>
  );
}

function Row2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{children}</div>;
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value?: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div>
      <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1.5">{label}</label>
      <Input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="font-mono text-sm bg-background" />
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder }: {
  label: string; value?: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div>
      <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1.5">{label}</label>
      <Textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="font-mono text-sm bg-background min-h-[80px] resize-y" />
    </div>
  );
}
