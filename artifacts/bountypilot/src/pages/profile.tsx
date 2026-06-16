import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, User, Pencil, Globe, Award, Coins, Gift, Zap, Target,
  ArrowLeft, CheckCircle, X, Plus,
} from "lucide-react";
import { usePageMeta } from "@/lib/use-page-meta";

interface ProfileData {
  fullName?: string;
  creatorName?: string;
  mainPlatforms?: string;
  contentFormats?: string;
  niche?: string;
  skillLevel?: string;
  preferredBountyTypes?: string;
  minimumReward?: number;
  weeklyContentCapacity?: number;
  targetMonthlyEarnings?: number;
  creatorStrengths?: string;
  creatorWeaknesses?: string;
  portfolioLinks?: string;
  notes?: string;
}

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

function chipList(value?: string): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
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

export function Profile() {
  usePageMeta({ title: "Profile", description: "Your BountyPilot profile", canonical: "/profile" });
  const { user, token } = useAuth();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [profile, setProfile] = useState<ProfileData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bountyCount, setBountyCount] = useState(0);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [earningsTotal, setEarningsTotal] = useState(0);

  const subStatus = computeSubscriptionStatus(user);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/bounties", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ bounties: [] })),
      fetch("/api/submissions", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ submissions: [] })),
      fetch("/api/earnings", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ totalEarned: 0 })),
    ]).then(([me, bounties, submissions, earnings]) => {
      if (me.profile) setProfile(me.profile);
      setBountyCount(bounties.bounties?.length || 0);
      setSubmissionCount(submissions.submissions?.length || 0);
      setEarningsTotal(earnings.totalEarned || 0);
    }).finally(() => setLoading(false));
  }, [token]);

  const setField = (k: keyof ProfileData, v: string | number) =>
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
      setTimeout(() => { setSaved(false); setMode("view"); }, 800);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground font-mono">
        <Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading profile...
      </div>
    );
  }

  const platforms = chipList(profile.mainPlatforms);
  const niches = chipList(profile.niche);
  const formats = chipList(profile.contentFormats);
  const bountyTypes = chipList(profile.preferredBountyTypes);

  // ── View mode ──────────────────────────────────────────────────────────────
  if (mode === "view") {
    return (
      <div className="flex flex-col gap-6 w-full">
        {/* Profile Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-sans uppercase tracking-tight">
                {profile.fullName || profile.creatorName || `@${user?.username}`}
              </h1>
              <p className="text-muted-foreground font-mono text-sm">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                {subStatus && (
                  <span className={`font-mono text-[10px] uppercase tracking-wider border px-2 py-0.5 rounded-sm ${subStatus.color} border-current/30`}>
                    {subStatus.plan}
                  </span>
                )}
                {profile.skillLevel && (
                  <span className="font-mono text-[10px] text-primary uppercase tracking-wider border border-primary/30 px-2 py-0.5 rounded-sm">
                    {profile.skillLevel}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="font-mono text-xs uppercase tracking-wider gap-2"
            onClick={() => setMode("edit")}
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Target} label="Bounties" value={bountyCount} color="text-primary" />
          <StatCard icon={Award} label="Submissions" value={submissionCount} color="text-blue-400" />
          <StatCard icon={Coins} label="Earnings" value={`$${earningsTotal}`} color="text-green-400" />
        </div>

        {/* About */}
        <Card className="bg-card border-border">
          <CardContent className="p-5 flex flex-col gap-4">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">About</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="Creator Name" value={profile.creatorName} />
              <InfoRow label="Full Name" value={profile.fullName} />
              <InfoRow label="Target Earnings" value={profile.targetMonthlyEarnings ? `$${profile.targetMonthlyEarnings}/mo` : undefined} />
              <InfoRow label="Min. Reward" value={profile.minimumReward ? `$${profile.minimumReward}` : undefined} />
              <InfoRow label="Weekly Capacity" value={profile.weeklyContentCapacity ? `${profile.weeklyContentCapacity} hrs` : undefined} />
              <InfoRow label="Member Since" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : undefined} />
            </div>
          </CardContent>
        </Card>

        {/* Creator Focus */}
        <Card className="bg-card border-border">
          <CardContent className="p-5 flex flex-col gap-4">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Creator Focus</p>
            <div className="flex flex-col gap-3">
              <ChipGroup label="Platforms" chips={platforms} icon={Globe} />
              <ChipGroup label="Niches" chips={niches} icon={Zap} />
              <ChipGroup label="Content Formats" chips={formats} icon={Gift} />
              <ChipGroup label="Bounty Types" chips={bountyTypes} icon={Target} />
            </div>
          </CardContent>
        </Card>

        {/* Self Assessment */}
        {(profile.creatorStrengths || profile.creatorWeaknesses) && (
          <Card className="bg-card border-border">
            <CardContent className="p-5 flex flex-col gap-4">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Self Assessment</p>
              <div className="flex flex-col gap-3">
                {profile.creatorStrengths && (
                  <div>
                    <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Strengths</p>
                    <p className="font-mono text-sm text-foreground">{profile.creatorStrengths}</p>
                  </div>
                )}
                {profile.creatorWeaknesses && (
                  <div>
                    <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Weaknesses</p>
                    <p className="font-mono text-sm text-foreground">{profile.creatorWeaknesses}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Portfolio & Notes */}
        {(profile.portfolioLinks || profile.notes) && (
          <Card className="bg-card border-border">
            <CardContent className="p-5 flex flex-col gap-4">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Portfolio & Notes</p>
              <div className="flex flex-col gap-3">
                {profile.portfolioLinks && (
                  <div>
                    <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Portfolio</p>
                    <p className="font-mono text-sm text-foreground whitespace-pre-wrap">{profile.portfolioLinks}</p>
                  </div>
                )}
                {profile.notes && (
                  <div>
                    <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                    <p className="font-mono text-sm text-foreground whitespace-pre-wrap">{profile.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
          <User className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-sans uppercase tracking-tight">Edit Profile</h1>
          <p className="text-muted-foreground font-mono text-sm">Update your creator identity</p>
        </div>
      </div>

      <p className="text-muted-foreground font-mono text-xs border-l-2 border-primary/50 pl-3">
        Your profile personalises opportunity scoring — the more you fill in, the better the AI understands your strengths and goals.
      </p>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <EditSection title="Identity">
          <Row2>
            <Field label="Full Name" value={profile.fullName} onChange={(v) => setField("fullName", v)} placeholder="Your real name" />
            <Field label="Creator Name / Handle" value={profile.creatorName} onChange={(v) => setField("creatorName", v)} placeholder="@yourhandle" />
          </Row2>
        </EditSection>

        <EditSection title="Creator Focus">
          <MultiChipSelect
            label="Main Platforms"
            options={PLATFORMS}
            value={profile.mainPlatforms || ""}
            onChange={(v) => setField("mainPlatforms", v)}
          />
          <MultiChipSelect
            label="Content Formats"
            options={CONTENT_FORMATS}
            value={profile.contentFormats || ""}
            onChange={(v) => setField("contentFormats", v)}
          />
          <MultiChipSelect
            label="Niche"
            options={NICHES}
            value={profile.niche || ""}
            onChange={(v) => setField("niche", v)}
          />
          <Row2>
            <SingleChipSelect
              label="Skill Level"
              options={SKILL_LEVELS}
              value={profile.skillLevel || ""}
              onChange={(v) => setField("skillLevel", v)}
            />
            <MultiChipSelect
              label="Preferred Bounty Types"
              options={BOUNTY_TYPES}
              value={profile.preferredBountyTypes || ""}
              onChange={(v) => setField("preferredBountyTypes", v)}
            />
          </Row2>
        </EditSection>

        <EditSection title="Goals & Capacity">
          <Row2>
            <Field label="Minimum Reward ($)" value={profile.minimumReward?.toString()} onChange={(v) => setField("minimumReward", parseFloat(v) || 0)} placeholder="e.g. 200" type="number" />
            <Field label="Weekly Content Capacity (hrs)" value={profile.weeklyContentCapacity?.toString()} onChange={(v) => setField("weeklyContentCapacity", parseInt(v) || 0)} placeholder="e.g. 10" type="number" />
          </Row2>
          <Field label="Target Monthly Earnings ($)" value={profile.targetMonthlyEarnings?.toString()} onChange={(v) => setField("targetMonthlyEarnings", parseFloat(v) || 0)} placeholder="e.g. 2000" type="number" />
        </EditSection>

        <EditSection title="Self Assessment">
          <TextareaField label="Creator Strengths" value={profile.creatorStrengths} onChange={(v) => setField("creatorStrengths", v)} placeholder="e.g. Strong research skills, can produce videos quickly, existing audience in DeFi..." />
          <TextareaField label="Creator Weaknesses" value={profile.creatorWeaknesses} onChange={(v) => setField("creatorWeaknesses", v)} placeholder="e.g. Limited technical knowledge, no podcast setup..." />
        </EditSection>

        <EditSection title="Portfolio & Notes">
          <TextareaField label="Portfolio Links" value={profile.portfolioLinks} onChange={(v) => setField("portfolioLinks", v)} placeholder="YouTube channel, Mirror, Twitter, personal site..." />
          <TextareaField label="Additional Notes" value={profile.notes} onChange={(v) => setField("notes", v)} placeholder="Anything else about your creator setup..." />
        </EditSection>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving} className="font-mono uppercase tracking-wider">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Profile
          </Button>
          <Button type="button" variant="outline" onClick={() => setMode("view")} className="font-mono uppercase tracking-wider">
            <ArrowLeft className="w-4 h-4 mr-2" /> Cancel
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

// ─── View helpers ──────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 flex flex-col items-center gap-1.5">
        <Icon className={`w-5 h-5 ${color}`} />
        <p className="font-mono text-lg font-bold text-foreground">{value}</p>
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="font-mono text-sm font-semibold text-foreground">{value || "Not set"}</p>
    </div>
  );
}

function ChipGroup({ label, chips, icon: Icon }: { label: string; chips: string[]; icon: React.ElementType }) {
  if (chips.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span key={chip} className="font-mono text-xs px-2 py-1 rounded-sm border border-primary/30 bg-primary/10 text-primary">
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Edit helpers ──────────────────────────────────────────────────────────

function MultiChipSelect({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const selected = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
    onChange(next.join(", "));
  };
  const removeCustom = (opt: string) => { onChange(selected.filter((s) => s !== opt).join(", ")); };
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
            <button key={opt} type="button" onClick={() => toggle(opt)}
              className={`font-mono text-xs px-2.5 py-1 rounded-sm border transition-colors ${active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
              {opt}
            </button>
          );
        })}
        {customItems.map((opt) => (
          <span key={opt} className="font-mono text-xs px-2.5 py-1 rounded-sm border border-primary bg-primary/15 text-primary flex items-center gap-1">
            {opt}
            <button type="button" onClick={() => removeCustom(opt)} className="hover:text-red-400 ml-0.5"><X className="w-2.5 h-2.5" /></button>
          </span>
        ))}
        <div className="flex items-center gap-1">
          <input type="text" value={customInput} onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder="Custom..."
            className="font-mono text-xs px-2 py-1 rounded-sm border border-dashed border-border bg-transparent text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 w-20" />
          {customInput.trim() && (
            <button type="button" onClick={addCustom} className="text-primary hover:text-primary/70"><Plus className="w-3.5 h-3.5" /></button>
          )}
        </div>
      </div>
    </div>
  );
}

function SingleChipSelect({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button key={opt} type="button" onClick={() => onChange(active ? "" : opt)}
              className={`font-mono text-xs px-2.5 py-1 rounded-sm border transition-colors ${active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EditSection({ title, children }: { title: string; children: React.ReactNode }) {
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
