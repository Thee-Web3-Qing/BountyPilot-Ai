import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth";
import { usePrivy, useLinkAccount } from "@privy-io/react-auth";
import { usePrivyLogin } from "@/hooks/use-privy-login";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2, User, Pencil, Globe, Award, Coins, Gift, Zap, Target,
  ArrowLeft, CheckCircle, X, Plus, Link2, Copy, Check, Code2,
  Bot, Users, Palette, Search, ExternalLink, Wallet,
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
  const { user: privyUser, authenticated: privyAuthenticated, unlinkGoogle, unlinkTwitter, unlinkDiscord, unlinkGithub } = usePrivy();
  const { linkGoogle, linkTwitter, linkDiscord, linkGithub } = useLinkAccount();
  const { loginWithPrivy, exchangeWithCurrentUser, loading: privyLoginLoading } = usePrivyLogin();
  const [unlinkingType, setUnlinkingType] = useState<string | null>(null);
  const [connectingPrivy, setConnectingPrivy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const prevPrivyAuth = useRef(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [savedWallet, setSavedWallet] = useState<string | null>(null);
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletSaved, setWalletSaved] = useState(false);
  const [editingWallet, setEditingWallet] = useState(false);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [profile, setProfile] = useState<ProfileData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bountyCount, setBountyCount] = useState(0);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [earningsTotal, setEarningsTotal] = useState(0);

  const subStatus = computeSubscriptionStatus(user);

  // When a user who was NOT Privy-authenticated completes Privy login (e.g. from
  // the "Connect social accounts" button), exchange the Privy token to link
  // their privy_id to their existing BountyPilot account.
  useEffect(() => {
    if (privyAuthenticated && !prevPrivyAuth.current && connectingPrivy) {
      setConnectingPrivy(false);
      setConnectError(null);
      exchangeWithCurrentUser().then((result) => {
        if (!result) setConnectError("Could not link account — please try again.");
      }).catch(() => setConnectError("Could not link account — please try again."));
    }
    prevPrivyAuth.current = privyAuthenticated;
  }, [privyAuthenticated, connectingPrivy, exchangeWithCurrentUser]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/bounties", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ bounties: [] })),
      fetch("/api/submissions", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ submissions: [] })),
      fetch("/api/earnings", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ totalEarned: 0 })),
    ]).then(([me, bounties, submissions, earnings]) => {
      if (me.profile) setProfile(me.profile);
      if (me.walletAddress) { setSavedWallet(me.walletAddress); setWalletAddress(me.walletAddress); }
      setBountyCount(bounties.bounties?.length || 0);
      setSubmissionCount(submissions.submissions?.length || 0);
      setEarningsTotal(earnings.totalEarned || 0);
    }).finally(() => setLoading(false));
  }, [token]);

  const saveWallet = async () => {
    if (!token) return;
    setWalletSaving(true);
    setWalletError(null);
    setWalletSaved(false);
    try {
      const res = await fetch("/api/auth/wallet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress: walletAddress.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setWalletError(data.error || "Failed to save wallet"); return; }
      setSavedWallet(data.walletAddress);
      setEditingWallet(false);
      setWalletSaved(true);
      setTimeout(() => setWalletSaved(false), 3000);
    } finally { setWalletSaving(false); }
  };

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

        {/* Payout Wallet */}
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-primary" />
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Payout Wallet</p>
              </div>
              {savedWallet && !editingWallet && (
                <button
                  onClick={() => setEditingWallet(true)}
                  className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <Pencil className="w-3 h-3" />Edit
                </button>
              )}
            </div>

            {!savedWallet || editingWallet ? (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[11px] text-muted-foreground">
                  Paste your crypto wallet address — this is where referral payouts will be sent.
                </p>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={e => { setWalletAddress(e.target.value); setWalletError(null); }}
                  placeholder="0x... or Solana address"
                  className="w-full bg-background border border-border rounded-sm px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60"
                />
                {walletError && (
                  <p className="font-mono text-[10px] text-red-400">{walletError}</p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={saveWallet}
                    disabled={walletSaving || !walletAddress.trim()}
                    className="font-mono uppercase tracking-wider text-xs gap-2 flex-1"
                  >
                    {walletSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : <><Check className="w-3.5 h-3.5" />Save Wallet</>}
                  </Button>
                  {editingWallet && (
                    <Button
                      variant="ghost"
                      onClick={() => { setEditingWallet(false); setWalletAddress(savedWallet ?? ""); setWalletError(null); }}
                      className="font-mono uppercase tracking-wider text-xs px-3"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 bg-background border border-primary/20 rounded-sm px-3 py-2.5">
                  <Wallet className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-mono text-xs text-foreground truncate flex-1">{savedWallet}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(savedWallet!); }}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy address"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                {walletSaved && (
                  <p className="font-mono text-[10px] text-green-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />Wallet saved successfully
                  </p>
                )}
                <p className="font-mono text-[10px] text-muted-foreground">
                  Supports EVM (0x...) and Solana addresses. Used for all referral payouts.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connected Accounts — always shown */}
        <ConnectedAccountsCard
          privyUser={privyAuthenticated && privyUser ? privyUser : null}
          unlinkingType={unlinkingType}
          connecting={connectingPrivy || privyLoginLoading}
          connectError={connectError}
          onConnect={async () => {
            setConnectingPrivy(true);
            setConnectError(null);
            await loginWithPrivy();
          }}
          onLink={{ google: linkGoogle, twitter: linkTwitter, discord: linkDiscord, github: linkGithub }}
          onUnlink={{
            google: async (subject) => { setUnlinkingType("google_oauth"); try { await unlinkGoogle(subject); } finally { setUnlinkingType(null); } },
            twitter: async (subject) => { setUnlinkingType("twitter_oauth"); try { await unlinkTwitter(subject); } finally { setUnlinkingType(null); } },
            discord: async (subject) => { setUnlinkingType("discord_oauth"); try { await unlinkDiscord(subject); } finally { setUnlinkingType(null); } },
            github: async (subject) => { setUnlinkingType("github_oauth"); try { await unlinkGithub(subject); } finally { setUnlinkingType(null); } },
          }}
        />

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

// ─── SVG icons for social providers ─────────────────────────────────────────

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.261 5.631 5.903-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  );
}

// ─── Connected Accounts card ──────────────────────────────────────────────────

type PrivyLinkedAccount = { type: string; subject?: string; email?: string | null; username?: string | null; name?: string | null };

const SOCIAL_PROVIDERS = [
  {
    type: "google_oauth",
    label: "Google",
    Icon: GoogleIcon,
    getLabel: (a: PrivyLinkedAccount) => a.email || a.name || "Linked",
  },
  {
    type: "twitter_oauth",
    label: "X / Twitter",
    Icon: XIcon,
    getLabel: (a: PrivyLinkedAccount) => a.username ? `@${a.username}` : "Linked",
  },
  {
    type: "discord_oauth",
    label: "Discord",
    Icon: DiscordIcon,
    getLabel: (a: PrivyLinkedAccount) => a.username ? `@${a.username}` : (a.email || "Linked"),
  },
  {
    type: "github_oauth",
    label: "GitHub",
    Icon: GitHubIcon,
    getLabel: (a: PrivyLinkedAccount) => a.username ? `@${a.username}` : (a.email || "Linked"),
  },
] as const;

function ConnectedAccountsCard({
  privyUser,
  unlinkingType,
  connecting,
  connectError,
  onConnect,
  onLink,
  onUnlink,
}: {
  privyUser: { linkedAccounts?: PrivyLinkedAccount[] } | null;
  unlinkingType: string | null;
  connecting: boolean;
  connectError: string | null;
  onConnect: () => void;
  onLink: { google: () => void; twitter: () => void; discord: () => void; github: () => void };
  onUnlink: { google: (s: string) => void; twitter: (s: string) => void; discord: (s: string) => void; github: (s: string) => void };
}) {
  const linked = privyUser?.linkedAccounts ?? [];
  const linkedCount = SOCIAL_PROVIDERS.filter(p => linked.some(a => a.type === p.type)).length;
  const walletAccount = linked.find(a => a.type === "wallet");

  const linkFn = { google_oauth: onLink.google, twitter_oauth: onLink.twitter, discord_oauth: onLink.discord, github_oauth: onLink.github } as Record<string, () => void>;
  const unlinkFn = { google_oauth: (s: string) => onUnlink.google(s), twitter_oauth: (s: string) => onUnlink.twitter(s), discord_oauth: (s: string) => onUnlink.discord(s), github_oauth: (s: string) => onUnlink.github(s) } as Record<string, (s: string) => void>;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-primary" />
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Connected Accounts</p>
          </div>
          {privyUser && (
            <span className="font-mono text-[10px] text-muted-foreground">{linkedCount} of {SOCIAL_PROVIDERS.length} linked</span>
          )}
        </div>

        {/* Not yet connected to Privy */}
        {!privyUser && (
          <div className="flex flex-col gap-3">
            <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
              Link social accounts and a crypto wallet to your profile — sign in with any of them next time, and enable crypto payouts.
            </p>
            {connectError && (
              <p className="font-mono text-[10px] text-red-400 border border-red-500/20 bg-red-500/5 rounded px-3 py-2">{connectError}</p>
            )}
            <Button
              onClick={onConnect}
              disabled={connecting}
              className="font-mono uppercase tracking-wider text-xs gap-2 w-full"
            >
              {connecting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Connecting…</>
                : <><Wallet className="w-3.5 h-3.5" />Connect Wallet &amp; Social Accounts</>
              }
            </Button>
            <div className="grid grid-cols-4 gap-1.5 opacity-50">
              {SOCIAL_PROVIDERS.map(({ type, label, Icon }) => (
                <div key={type} className="flex flex-col items-center gap-1 px-2 py-2 rounded-sm border border-border">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono text-[9px] text-muted-foreground uppercase">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connected — show wallet + social rows */}
        {privyUser && (
          <>
            {walletAccount && (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-sm border border-primary/20 bg-primary/5">
                <div className="w-7 h-7 rounded-sm flex items-center justify-center flex-shrink-0 bg-primary/10">
                  <Wallet className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Payout Wallet</p>
                  <p className="font-mono text-xs text-foreground truncate">{(walletAccount as PrivyLinkedAccount & { address?: string }).address ?? "Linked"}</p>
                </div>
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              {SOCIAL_PROVIDERS.map(({ type, label, Icon, getLabel }) => {
                const account = linked.find(a => a.type === type);
                const isLinked = !!account;
                const isUnlinking = unlinkingType === type;
                const canUnlink = linkedCount > 1;

                return (
                  <div
                    key={type}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-sm border transition-colors ${
                      isLinked ? "border-primary/20 bg-primary/5" : "border-border bg-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-sm flex items-center justify-center flex-shrink-0 ${isLinked ? "bg-primary/10" : "bg-muted/30"}`}>
                        <Icon className={`w-4 h-4 ${isLinked ? "text-foreground" : "text-muted-foreground"}`} />
                      </div>
                      <div className="min-w-0">
                        <p className={`font-mono text-xs font-semibold uppercase tracking-wider ${isLinked ? "text-foreground" : "text-muted-foreground"}`}>
                          {label}
                        </p>
                        {isLinked && account && (
                          <p className="font-mono text-[10px] text-muted-foreground truncate">{getLabel(account)}</p>
                        )}
                      </div>
                    </div>
                    {isLinked ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isUnlinking || !canUnlink}
                        onClick={() => account?.subject && unlinkFn[type]?.(account.subject)}
                        className="font-mono text-[10px] uppercase tracking-wider h-7 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                        title={!canUnlink ? "Can't unlink your only login method" : "Unlink account"}
                      >
                        {isUnlinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <><X className="w-3 h-3 mr-1" />Unlink</>}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => linkFn[type]?.()}
                        className="font-mono text-[10px] uppercase tracking-wider h-7 px-2.5 border-primary/30 text-primary hover:bg-primary/10 flex-shrink-0"
                      >
                        <Plus className="w-3 h-3 mr-1" />Link
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
              Link multiple accounts to sign in with any of them. Your wallet address is used for crypto payouts.
            </p>
          </>
        )}
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
