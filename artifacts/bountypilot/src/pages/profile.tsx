import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2, User, Pencil, Globe, Award, Coins, Gift, Zap, Target,
  ArrowLeft, CheckCircle, X, Plus, Link2, Copy, Check, Code2,
  Bot, Users, Palette, Search,
} from "lucide-react";
import { usePageMeta } from "@/lib/use-page-meta";

// ─── Role definitions ───────────────────────────────────────────────────────

const ROLES = [
  { key: "creator",   label: "Creator",           icon: Globe,   desc: "Content, videos, threads, podcasts" },
  { key: "developer", label: "Developer",          icon: Code2,   desc: "Smart contracts, frontend, backend" },
  { key: "vibecoder", label: "VibeCoder",          icon: Bot,     desc: "AI tools, agents, vibe coding" },
  { key: "community", label: "Community Builder",  icon: Users,   desc: "Discord, events, ambassador, DAO" },
  { key: "designer",  label: "Designer",           icon: Palette, desc: "UI/UX, branding, NFT art, motion" },
  { key: "researcher",label: "Researcher",         icon: Search,  desc: "On-chain analysis, reports, data" },
] as const;

type RoleKey = typeof ROLES[number]["key"];

interface RoleConfig {
  sectionTitle: string;
  platformsLabel: string;
  formatsLabel: string;
  platforms: string[];
  formats: string[];
  niches: string[];
  bountyTypes: string[];
}

const ROLE_CONFIGS: Record<RoleKey, RoleConfig> = {
  creator: {
    sectionTitle: "Creator Focus",
    platformsLabel: "Main Platforms",
    formatsLabel: "Content Formats",
    platforms: ["YouTube", "Twitter / X", "LinkedIn", "Instagram", "TikTok", "Mirror", "Substack", "Farcaster", "Lens", "Discord", "Telegram", "Medium"],
    formats: ["Article / Thread", "Long-form Video", "Short-form Video", "Podcast", "Newsletter", "Tutorial", "Design", "Infographic", "Comic Strip", "Meme"],
    niches: ["DeFi", "NFTs", "Layer 2", "Gaming", "DePIN", "DAOs", "Infrastructure", "Trading", "Education", "Web3 General"],
    bountyTypes: ["Articles", "Videos", "Threads", "Tutorials", "Technical Writing", "Design", "Memes", "Podcasts"],
  },
  developer: {
    sectionTitle: "Dev Stack",
    platformsLabel: "Platforms & Communities",
    formatsLabel: "Skills & Specializations",
    platforms: ["GitHub", "Discord", "Twitter / X", "Farcaster", "LinkedIn", "Telegram", "DevPost", "Gitcoin"],
    formats: ["Smart Contracts", "Frontend Dev", "Backend Dev", "Full Stack", "DevOps / Infra", "Security / Auditing", "SDK Development", "Integrations", "Testing / QA", "Open Source"],
    niches: ["DeFi", "NFTs", "Layer 2", "Gaming", "DePIN", "DAOs", "Infrastructure", "Cross-chain", "ZK / Privacy", "AI × Web3"],
    bountyTypes: ["Bug Bounty", "Smart Contract Dev", "Frontend Dev", "Backend Dev", "Protocol Integration", "SDK / Tools", "Documentation", "Security Audit", "Open Source"],
  },
  vibecoder: {
    sectionTitle: "Builder Stack",
    platformsLabel: "Platforms & Tools",
    formatsLabel: "Skills & Tools",
    platforms: ["GitHub", "Twitter / X", "Farcaster", "Discord", "LinkedIn", "Product Hunt"],
    formats: ["AI Agents", "Prompt Engineering", "No-Code / Low-Code", "Automation", "Chatbots", "LLM Apps", "Workflow Building", "Vibe Coding", "Rapid Prototyping"],
    niches: ["AI × Web3", "DeFi Automation", "NFT Tooling", "Infrastructure", "GameFi", "SocialFi", "Developer Tools", "DAOs"],
    bountyTypes: ["AI Integration", "Agent Building", "Tool Prototyping", "Automation", "Hackathon", "Demo / MVP", "Workflow", "Open Source"],
  },
  community: {
    sectionTitle: "Community Focus",
    platformsLabel: "Platforms",
    formatsLabel: "Skills & Focus Areas",
    platforms: ["Discord", "Telegram", "Twitter / X", "LinkedIn", "Farcaster", "Mirror", "Reddit", "Notion"],
    formats: ["Community Management", "Moderation", "Events & Spaces", "Onboarding", "Ambassador", "Education", "Partnerships", "DAO Governance", "Growth"],
    niches: ["DeFi", "NFTs", "Layer 2", "Gaming", "DePIN", "DAOs", "Web3 General", "Education", "SocialFi"],
    bountyTypes: ["Community Management", "Moderation", "Events", "Ambassador", "Content", "Onboarding", "DAO Governance", "Growth"],
  },
  designer: {
    sectionTitle: "Design Focus",
    platformsLabel: "Platforms & Tools",
    formatsLabel: "Skills & Specializations",
    platforms: ["Twitter / X", "Figma", "Behance", "Dribbble", "LinkedIn", "Mirror", "Instagram"],
    formats: ["UI / UX", "Brand Design", "NFT / Generative Art", "Motion Graphics", "Web Design", "3D / Blender", "Illustration", "Social Graphics"],
    niches: ["NFTs", "Gaming", "DeFi", "Web3 General", "Infrastructure", "SocialFi"],
    bountyTypes: ["UI / UX Design", "Logo & Branding", "NFT Art", "Illustration", "Motion / Animation", "Web Design", "Social Media Graphics"],
  },
  researcher: {
    sectionTitle: "Research Focus",
    platformsLabel: "Platforms & Publishing",
    formatsLabel: "Skills & Methods",
    platforms: ["Twitter / X", "Mirror", "Substack", "LinkedIn", "Farcaster", "Dune Analytics", "Notion"],
    formats: ["On-chain Analysis", "Market Research", "Protocol Research", "Technical Analysis", "Competitive Analysis", "Data Visualization", "Report Writing", "Tokenomics"],
    niches: ["DeFi", "Trading", "Infrastructure", "Layer 2", "DAOs", "Cross-chain", "RWA", "Stablecoins", "AI × Web3"],
    bountyTypes: ["Research Reports", "Data Analysis", "Market Analysis", "Protocol Analysis", "Technical Writing", "On-chain Analytics", "Tokenomics"],
  },
};

const SKILL_LEVELS = ["Beginner", "Intermediate", "Expert"];

const DEV_LANGUAGES = [
  "Solidity", "Rust", "TypeScript", "JavaScript", "Python", "Go",
  "C++", "Cairo", "Move", "Vyper", "Java", "Haskell",
];

const VIBE_AI_TOOLS = [
  "Cursor", "Windsurf", "Bolt.new", "Lovable", "v0", "Replit",
  "Claude", "ChatGPT", "Gemini", "GitHub Copilot",
  "LangChain", "CrewAI", "n8n", "Make.com", "Zapier",
  "Midjourney", "Runway", "ElevenLabs",
];

// ─── Types ───────────────────────────────────────────────────────────────────

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
  roleType?: string;
  languages?: string;
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

// ─── Main component ──────────────────────────────────────────────────────────

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

  const role = (profile.roleType as RoleKey) || "creator";
  const cfg = ROLE_CONFIGS[role] ?? ROLE_CONFIGS.creator;
  const roleObj = ROLES.find((r) => r.key === role);
  const RoleIcon = roleObj?.icon ?? Globe;

  const platforms = chipList(profile.mainPlatforms);
  const niches = chipList(profile.niche);
  const formats = chipList(profile.contentFormats);
  const bountyTypes = chipList(profile.preferredBountyTypes);
  const languages = chipList(profile.languages);

  // ── View mode ─────────────────────────────────────────────────────────────
  if (mode === "view") {
    return (
      <div className="flex flex-col gap-5 w-full">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center flex-shrink-0">
              <RoleIcon className="w-7 h-7 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold font-sans uppercase tracking-tight truncate">
                {profile.fullName || profile.creatorName || `@${user?.username}`}
              </h1>
              <p className="text-muted-foreground font-mono text-xs truncate">{user?.email}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {roleObj && (
                  <span className="font-mono text-[10px] uppercase tracking-wider border border-primary/30 bg-primary/10 text-primary px-2 py-0.5 rounded-sm">
                    {roleObj.label}
                  </span>
                )}
                {subStatus && (
                  <span className={`font-mono text-[10px] uppercase tracking-wider border px-2 py-0.5 rounded-sm ${subStatus.color} border-current/30`}>
                    {subStatus.plan}
                  </span>
                )}
                {profile.skillLevel && (
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider border border-border px-2 py-0.5 rounded-sm">
                    {profile.skillLevel}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="font-mono text-xs uppercase tracking-wider gap-1.5 flex-shrink-0"
            onClick={() => setMode("edit")}
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard icon={Target} label="Bounties" value={bountyCount} color="text-primary" />
          <StatCard icon={Award} label="Submissions" value={submissionCount} color="text-blue-400" />
          <StatCard icon={Coins} label="Earnings" value={`$${earningsTotal}`} color="text-green-400" />
        </div>

        {/* Referral Link */}
        {user?.username && <ReferralCard username={user.username} />}

        {/* About */}
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex flex-col gap-3">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">About</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoRow label="Handle" value={profile.creatorName} />
              <InfoRow label="Full Name" value={profile.fullName} />
              <InfoRow label="Target Earnings" value={profile.targetMonthlyEarnings ? `$${profile.targetMonthlyEarnings}/mo` : undefined} />
              <InfoRow label="Min. Reward" value={profile.minimumReward ? `$${profile.minimumReward}` : undefined} />
              <InfoRow label="Weekly Capacity" value={profile.weeklyContentCapacity ? `${profile.weeklyContentCapacity} hrs` : undefined} />
              <InfoRow label="Member Since" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : undefined} />
            </div>
          </CardContent>
        </Card>

        {/* Focus section — adapts to role */}
        {(platforms.length > 0 || niches.length > 0 || formats.length > 0 || bountyTypes.length > 0) && (
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex flex-col gap-3">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{cfg.sectionTitle}</p>
              <div className="flex flex-col gap-3">
                <ChipGroup label={cfg.platformsLabel} chips={platforms} icon={Globe} />
                {role === "developer" && languages.length > 0 && (
                  <ChipGroup label="Languages & Frameworks" chips={languages} icon={Code2} />
                )}
                {role === "vibecoder" && languages.length > 0 && (
                  <ChipGroup label="AI Tools" chips={languages} icon={Bot} />
                )}
                <ChipGroup label={cfg.formatsLabel} chips={formats} icon={Zap} />
                <ChipGroup label="Niche" chips={niches} icon={Gift} />
                <ChipGroup label="Bounty Types" chips={bountyTypes} icon={Target} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Self Assessment */}
        {(profile.creatorStrengths || profile.creatorWeaknesses) && (
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex flex-col gap-3">
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
            <CardContent className="p-4 flex flex-col gap-3">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Portfolio & Notes</p>
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
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold font-sans uppercase tracking-tight">Edit Profile</h1>
          <p className="text-muted-foreground font-mono text-xs">The more you fill in, the better the AI matches you</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-5">

        {/* ── Step 1: Role ── */}
        <EditSection title="Your Role">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ROLES.map(({ key, label, icon: Icon, desc }) => {
              const active = (profile.roleType || "creator") === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setField("roleType", key)}
                  className={`flex flex-col items-start gap-1 p-3 rounded-sm border text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-mono text-xs font-bold uppercase tracking-wider">{label}</span>
                  </div>
                  <span className="font-mono text-[10px] leading-tight opacity-70">{desc}</span>
                </button>
              );
            })}
          </div>
        </EditSection>

        {/* ── Step 2: Identity ── */}
        <EditSection title="Identity">
          <Row2>
            <Field label="Full Name" value={profile.fullName} onChange={(v) => setField("fullName", v)} placeholder="Your real name" />
            <Field label="Handle / Creator Name" value={profile.creatorName} onChange={(v) => setField("creatorName", v)} placeholder="@yourhandle" />
          </Row2>
        </EditSection>

        {/* ── Step 3: Role-specific focus ── */}
        <EditSection title={cfg.sectionTitle}>
          <MultiChipSelect
            label={cfg.platformsLabel}
            options={cfg.platforms}
            value={profile.mainPlatforms || ""}
            onChange={(v) => setField("mainPlatforms", v)}
          />
          {role === "developer" && (
            <MultiChipSelect
              label="Languages & Frameworks"
              options={DEV_LANGUAGES}
              value={profile.languages || ""}
              onChange={(v) => setField("languages", v)}
            />
          )}
          {role === "vibecoder" && (
            <MultiChipSelect
              label="AI Tools You Use"
              options={VIBE_AI_TOOLS}
              value={profile.languages || ""}
              onChange={(v) => setField("languages", v)}
            />
          )}
          <MultiChipSelect
            label={cfg.formatsLabel}
            options={cfg.formats}
            value={profile.contentFormats || ""}
            onChange={(v) => setField("contentFormats", v)}
          />
          <MultiChipSelect
            label="Niche"
            options={cfg.niches}
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
              options={cfg.bountyTypes}
              value={profile.preferredBountyTypes || ""}
              onChange={(v) => setField("preferredBountyTypes", v)}
            />
          </Row2>
        </EditSection>

        {/* ── Step 4: Goals ── */}
        <EditSection title="Goals & Capacity">
          <Row2>
            <Field label="Minimum Reward ($)" value={profile.minimumReward?.toString()} onChange={(v) => setField("minimumReward", parseFloat(v) || 0)} placeholder="e.g. 200" type="number" />
            <Field label="Weekly Capacity (hrs)" value={profile.weeklyContentCapacity?.toString()} onChange={(v) => setField("weeklyContentCapacity", parseInt(v) || 0)} placeholder="e.g. 10" type="number" />
          </Row2>
          <Field label="Target Monthly Earnings ($)" value={profile.targetMonthlyEarnings?.toString()} onChange={(v) => setField("targetMonthlyEarnings", parseFloat(v) || 0)} placeholder="e.g. 2000" type="number" />
        </EditSection>

        {/* ── Step 5: Self Assessment ── */}
        <EditSection title="Self Assessment">
          <TextareaField label="Strengths" value={profile.creatorStrengths} onChange={(v) => setField("creatorStrengths", v)} placeholder="What are you especially good at? Any portfolio highlights?" />
          <TextareaField label="Weaknesses / Gaps" value={profile.creatorWeaknesses} onChange={(v) => setField("creatorWeaknesses", v)} placeholder="What areas do you want to avoid or improve?" />
        </EditSection>

        {/* ── Step 6: Portfolio ── */}
        <EditSection title="Portfolio & Notes">
          <TextareaField label="Portfolio / Links" value={profile.portfolioLinks} onChange={(v) => setField("portfolioLinks", v)} placeholder="GitHub, Twitter, Behance, personal site, Mirror..." />
          <TextareaField label="Additional Notes" value={profile.notes} onChange={(v) => setField("notes", v)} placeholder="Anything else you'd like the AI to know about you..." />
        </EditSection>

        <div className="flex flex-wrap items-center gap-3 pt-1">
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

// ─── View helpers ────────────────────────────────────────────────────────────

function ReferralCard({ username }: { username: string }) {
  const link = `${window.location.origin}/signup?ref=${encodeURIComponent(username)}`;
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Card className="bg-card border-border border-primary/20">
      <CardContent className="p-4 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 text-primary" />
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Your Referral Link</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-background border border-border rounded-sm px-3 py-2 font-mono text-xs text-muted-foreground truncate min-w-0">
            {link}
          </div>
          <Button size="sm" variant="outline" onClick={copy} className="shrink-0 gap-1.5 font-mono text-xs uppercase tracking-wider h-9">
            {copied ? <><Check className="w-3.5 h-3.5 text-green-400" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </Button>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          Share this link to earn rewards — every referral counts toward Launchpad campaigns.
        </p>
      </CardContent>
    </Card>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-3 flex flex-col items-center gap-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <p className="font-mono text-base font-bold text-foreground">{value}</p>
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
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span key={chip} className="font-mono text-xs px-2 py-0.5 rounded-sm border border-primary/30 bg-primary/10 text-primary">
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Edit helpers ─────────────────────────────────────────────────────────────

function EditSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 flex flex-col gap-4">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground border-b border-border pb-2">{title}</p>
        {children}
      </CardContent>
    </Card>
  );
}

function Row2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value?: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1.5">{label}</label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-background border border-border rounded-sm px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors"
      />
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder }: {
  label: string; value?: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1.5">{label}</label>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-background border border-border rounded-sm px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors resize-none"
      />
    </div>
  );
}

function MultiChipSelect({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
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
              className={`font-mono text-xs px-2.5 py-1 rounded-sm border transition-colors ${
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}>
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
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder="Custom..."
            className="font-mono text-xs px-2 py-1 rounded-sm border border-dashed border-border bg-transparent text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 w-20"
          />
          {customInput.trim() && (
            <button type="button" onClick={addCustom} className="text-primary hover:text-primary/70"><Plus className="w-3.5 h-3.5" /></button>
          )}
        </div>
      </div>
    </div>
  );
}

function SingleChipSelect({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button key={opt} type="button" onClick={() => onChange(active ? "" : opt)}
              className={`font-mono text-xs px-2.5 py-1 rounded-sm border transition-colors ${
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
