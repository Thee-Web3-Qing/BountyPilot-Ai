import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useParams, useLocation } from "wouter";
import {
  useGetBounty,
  getGetBountyQueryKey,
  useGetResearchBriefByBounty,
  getGetResearchBriefByBountyQueryKey,
  useGetProductionPlanByBounty,
  getGetProductionPlanByBountyQueryKey,
  useUpdateBounty,
  useCreateSubmission,
  getListBountiesQueryKey,
  getGetDashboardSummaryQueryKey,
  getListSubmissionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ExternalLink, RefreshCw, Loader2, CheckCircle, AlertCircle, Sparkles, Flag, X, Users, Linkedin, Twitter, Globe, Bot, FileText, Copy, Check, Code2, Layers, UsersRound, Tag, Clock, Zap, Wrench } from "lucide-react";
import { AIFeatureGate } from "@/components/trial-gate";

// ── Copy Link button ─────────────────────────────────────────
function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors text-sm"
    >
      {copied
        ? <><Check className="w-3.5 h-3.5 text-green-400" /><span className="font-mono text-xs text-green-400">Copied!</span></>
        : <><Copy className="w-3.5 h-3.5" /><span className="font-mono text-xs">Copy Link</span></>
      }
    </button>
  );
}

// ── Team helpers ─────────────────────────────────────────────
function buildTeamSearchUrl(companyName: string | null | undefined, _platform: string | null | undefined, _url: string | null | undefined): string | null {
  if (!companyName) return null;
  const clean = companyName.trim();
  if (clean.length < 2) return null;
  const slug = clean.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (slug.length >= 3 && slug.length <= 30) {
    return `https://www.linkedin.com/company/${slug}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(clean + " LinkedIn")}`;
}

function buildXSearchUrl(companyName: string | null | undefined): string | null {
  if (!companyName) return null;
  const clean = companyName.trim();
  if (clean.length < 2) return null;
  return `https://x.com/search?q=${encodeURIComponent(clean)}`;
}

function buildWebsiteSearchUrl(companyName: string | null | undefined): string | null {
  if (!companyName) return null;
  const clean = companyName.trim();
  if (clean.length < 2) return null;
  return `https://www.google.com/search?q=${encodeURIComponent(clean + " official website")}`;
}

function getCompanyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Try to extract company name from Devpost subdomain
  const devpostMatch = url.match(/^https?:\/\/([a-z0-9-]+)\.devpost\.com/);
  if (devpostMatch) {
    const subdomain = devpostMatch[1];
    // Map known subdomains to company names
    const known: Record<string, string> = {
      slackhack: "Salesforce",
      splunk: "Splunk",
      uipath: "UiPath",
      xprize: "XPRIZE",
      mindtheproduct: "Mind the Product",
      qwencloud: "Alibaba Cloud",
      nextgenhacks: "NextGenHacks",
      findevil: "SANS",
      h01: "AWS",
      dsh: "DSH",
    };
    if (known[subdomain]) return known[subdomain];
    // Otherwise guess: convert kebab-case to title case
    return subdomain
      .split(/[-_]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  // Try to extract from other URLs
  const domainMatch = url.match(/\/\/([^\/]+)/);
  if (domainMatch) {
    const domain = domainMatch[1].replace(/^www\./, "");
    const parts = domain.split(".");
    if (parts.length >= 2) {
      const name = parts[parts.length - 2];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }
  return null;
}

function TeamCard({ companyName, platform, url }: { companyName: string | null | undefined; platform: string | null | undefined; url: string | null | undefined }) {
  const orgName = companyName || getCompanyFromUrl(url) || null;
  const linkedInUrl = buildTeamSearchUrl(orgName, platform, url);
  const xUrl = buildXSearchUrl(orgName);
  const websiteUrl = buildWebsiteSearchUrl(orgName);

  if (!orgName && !linkedInUrl) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Organizer / Team
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {orgName && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{orgName}</span>
            <span className="text-xs font-mono text-muted-foreground">{platform}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {linkedInUrl && (
            <a
              href={linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-border bg-secondary text-xs font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <Linkedin className="w-3 h-3" /> Find on LinkedIn
            </a>
          )}
          {xUrl && (
            <a
              href={xUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-border bg-secondary text-xs font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <Twitter className="w-3 h-3" /> Find on X
            </a>
          )}
          {websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-border bg-secondary text-xs font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <Globe className="w-3 h-3" /> Find Website
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function timeLeft(deadline: string | null): string | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / 86400000);
  const hrs = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (days > 0) return `${days}d ${hrs}h ${mins}m ${secs}s`;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  return Math.round((new Date(deadline).getTime() - Date.now()) / 86400000);
}

const STATUS_COLORS: Record<string, string> = {
  discovered:    "bg-blue-500/20 text-blue-300 border-blue-500/30",
  saved_for_later: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  approved:      "bg-green-500/20 text-green-300 border-green-500/30",
  rejected:      "bg-red-500/20 text-red-300 border-red-500/30",
  researching:   "bg-purple-500/20 text-purple-300 border-purple-500/30",
  scripting:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  recording:     "bg-pink-500/20 text-pink-300 border-pink-500/30",
  editing:       "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  drafting:      "bg-sky-500/20 text-sky-300 border-sky-500/30",
  reviewing:     "bg-lime-500/20 text-lime-300 border-lime-500/30",
  planning:      "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  building:      "bg-violet-500/20 text-violet-300 border-violet-500/30",
  testing:       "bg-amber-500/20 text-amber-300 border-amber-500/30",
  concepting:    "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
  designing:     "bg-rose-500/20 text-rose-300 border-rose-500/30",
  revising:      "bg-red-400/20 text-red-300 border-red-400/30",
  executing:     "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  applying:      "bg-blue-400/20 text-blue-200 border-blue-400/30",
  submitted:     "bg-teal-500/20 text-teal-300 border-teal-500/30",
  won:           "bg-primary/20 text-primary border-primary/30",
  lost:          "bg-muted text-muted-foreground border-border",
};

const SCORE_COLOR = (score: number) => {
  if (score >= 7) return "text-green-400";
  if (score >= 4) return "text-yellow-400";
  return "text-red-400";
};

// ── Type-specific detail card ─────────────────────────────────
interface TypeDetailsCardProps {
  opportunityType: string | null | undefined;
  contentFormat: string | null | undefined;
  techStack: string | null | undefined;
  programmingLanguages: string | null | undefined;
  teamSize: string | null | undefined;
  trackCategory: string | null | undefined;
  difficulty: string | null | undefined;
  skillsRequired: string | null | undefined;
  estimatedHours: string | null | undefined;
}

interface TypeChip { label: string; icon: React.ReactNode }

function TypeDetailsCard({ opportunityType, contentFormat, techStack, programmingLanguages, teamSize, trackCategory, difficulty, skillsRequired, estimatedHours }: TypeDetailsCardProps) {
  const t = (opportunityType || "").toLowerCase();
  const f = (contentFormat || "").toLowerCase();

  const isHackathon = t.includes("hackathon");
  const isDev = t.includes("bug bounty") || t.includes("security") || f.includes("code") || f.includes("develop") || f.includes("smart contract") || f.includes("github");
  const isJob = t === "job";
  const isTask = t === "task" || t === "bounty" || t === "campaign" || t === "contest";
  const isDesign = f.includes("design") || f.includes("ui") || f.includes("ux") || f.includes("figma");
  const isContent = f.includes("video") || f.includes("article") || f.includes("blog") || f.includes("thread") || f.includes("podcast");

  type FieldItem = { icon: React.ReactNode; label: string; value: string };
  const fields: FieldItem[] = [];

  if (isHackathon || isDev) {
    if (techStack) fields.push({ icon: <Layers className="w-3.5 h-3.5" />, label: "Tech Stack", value: techStack });
    if (programmingLanguages) fields.push({ icon: <Code2 className="w-3.5 h-3.5" />, label: "Languages", value: programmingLanguages });
  }
  if (isHackathon) {
    if (teamSize) fields.push({ icon: <UsersRound className="w-3.5 h-3.5" />, label: "Team Size", value: teamSize });
    if (trackCategory) fields.push({ icon: <Tag className="w-3.5 h-3.5" />, label: "Track / Theme", value: trackCategory });
  }
  if (isJob || isTask || isContent || isDesign) {
    if (skillsRequired) fields.push({ icon: <Zap className="w-3.5 h-3.5" />, label: "Skills", value: skillsRequired });
  }
  if (isDev && skillsRequired) {
    fields.push({ icon: <Zap className="w-3.5 h-3.5" />, label: "Skills", value: skillsRequired });
  }
  if (isTask || isContent) {
    if (estimatedHours) fields.push({ icon: <Clock className="w-3.5 h-3.5" />, label: "Est. Time", value: estimatedHours });
  }
  if (difficulty) fields.push({ icon: <Wrench className="w-3.5 h-3.5" />, label: "Difficulty", value: difficulty });

  if (fields.length === 0) return null;

  const cardTitle = isHackathon ? "Hackathon Details"
    : isDev ? "Technical Details"
    : isJob ? "Role Details"
    : isDesign ? "Design Details"
    : isContent ? "Content Details"
    : "Task Details";

  const accentClass = isHackathon
    ? "border-blue-500/30 bg-blue-500/5"
    : isDev
    ? "border-purple-500/30 bg-purple-500/5"
    : "border-border bg-card";

  return (
    <Card className={accentClass}>
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          {isHackathon ? <Code2 className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
          {cardTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f, i) => (
          <div key={i}>
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {f.icon}
              {f.label}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {f.value.split(",").map((chip, j) => chip.trim() && (
                <span
                  key={j}
                  className="px-2 py-0.5 rounded text-xs font-mono border border-border bg-secondary text-foreground"
                >
                  {chip.trim()}
                </span>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface OpportunityConfig {
  workflowStatuses: string[];
  showContentFormat: boolean;
  briefCardTitle: string;
  planCardTitle: string;
  planLabels: { scriptOutline: string; shotList: string; captionDraft: string };
}

function getOpportunityConfig(
  opportunityType: string | null | undefined,
  contentFormat: string | null | undefined,
): OpportunityConfig {
  const t = (opportunityType || "").toLowerCase();
  const f = (contentFormat || "").toLowerCase();

  const isHackathon = t === "hackathon" || t.includes("hackathon");
  const isBugBounty = t === "bug bounty" || t.includes("bug bounty") || t.includes("security");
  const isJob = t === "job";
  const isGrant = t === "grant";
  const isVideo = f.includes("video") || f.includes("youtube") || f.includes("tiktok") || f.includes("reel") || f.includes("short");
  const isPodcast = f.includes("podcast") || f.includes("audio") || f.includes("space");
  const isThread = f.includes("thread") || f.includes("tweet") || f.includes("twitter") || f.includes("x post");
  const isArticle = f.includes("article") || f.includes("blog") || f.includes("mirror") || f.includes("newsletter") || f.includes("writ");
  const isDesign = f.includes("design") || f.includes("ui") || f.includes("ux") || f.includes("figma") || f.includes("art") || f.includes("graphic");
  const isDev = isBugBounty || f.includes("code") || f.includes("develop") || f.includes("smart contract") || f.includes("github");

  if (isHackathon) return {
    workflowStatuses: ["approved", "planning", "building", "testing"],
    showContentFormat: false,
    briefCardTitle: "Project Brief",
    planCardTitle: "Build Plan",
    planLabels: { scriptOutline: "Build Plan", shotList: "Architecture Notes", captionDraft: "Submission Pitch" },
  };
  if (isDev) return {
    workflowStatuses: ["approved", "planning", "building", "testing"],
    showContentFormat: false,
    briefCardTitle: "Research Brief",
    planCardTitle: "Build Plan",
    planLabels: { scriptOutline: "Implementation Plan", shotList: "Technical Notes", captionDraft: "Submission Pitch" },
  };
  if (isJob) return {
    workflowStatuses: ["approved", "researching", "applying"],
    showContentFormat: false,
    briefCardTitle: "Company Research",
    planCardTitle: "Application Plan",
    planLabels: { scriptOutline: "Application Outline", shotList: "Portfolio Items", captionDraft: "Cover Letter Opening" },
  };
  if (isGrant) return {
    workflowStatuses: ["approved", "researching", "drafting", "reviewing"],
    showContentFormat: false,
    briefCardTitle: "Research Brief",
    planCardTitle: "Proposal Plan",
    planLabels: { scriptOutline: "Proposal Outline", shotList: "Supporting Materials", captionDraft: "Executive Summary" },
  };
  if (isVideo || isPodcast) return {
    workflowStatuses: ["approved", "researching", "scripting", "recording", "editing"],
    showContentFormat: true,
    briefCardTitle: "Research Brief",
    planCardTitle: "Production Plan",
    planLabels: { scriptOutline: "Script Outline", shotList: isPodcast ? "Episode Structure" : "Shot List", captionDraft: "Caption Draft" },
  };
  if (isThread) return {
    workflowStatuses: ["approved", "researching", "drafting", "reviewing"],
    showContentFormat: true,
    briefCardTitle: "Research Brief",
    planCardTitle: "Content Plan",
    planLabels: { scriptOutline: "Thread Outline", shotList: "Tweet Structure", captionDraft: "Promo Caption" },
  };
  if (isArticle) return {
    workflowStatuses: ["approved", "researching", "drafting", "reviewing"],
    showContentFormat: true,
    briefCardTitle: "Research Brief",
    planCardTitle: "Content Plan",
    planLabels: { scriptOutline: "Article Outline", shotList: "Section Structure", captionDraft: "Promo Caption" },
  };
  if (isDesign) return {
    workflowStatuses: ["approved", "concepting", "designing", "revising"],
    showContentFormat: true,
    briefCardTitle: "Design Brief",
    planCardTitle: "Design Plan",
    planLabels: { scriptOutline: "Design Brief", shotList: "Asset List", captionDraft: "Submission Note" },
  };
  return {
    workflowStatuses: ["approved", "researching", "scripting", "recording", "editing"],
    showContentFormat: true,
    briefCardTitle: "Research Brief",
    planCardTitle: "Production Plan",
    planLabels: { scriptOutline: "Script Outline", shotList: "Shot List", captionDraft: "Caption Draft" },
  };
}

export function BountyDetail() {
  const { id } = useParams<{ id: string }>();
  const bountyId = parseInt(id ?? "0");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { token } = useAuth();

  const { data: bounty, isLoading: loadingBounty } = useGetBounty(bountyId, {
    query: { enabled: !!bountyId, queryKey: getGetBountyQueryKey(bountyId) },
  });
  const { data: brief, isLoading: loadingBrief } = useGetResearchBriefByBounty(bountyId, {
    query: { enabled: !!bountyId, queryKey: getGetResearchBriefByBountyQueryKey(bountyId) },
  });
  const { data: plan, isLoading: loadingPlan } = useGetProductionPlanByBounty(bountyId, {
    query: { enabled: !!bountyId, queryKey: getGetProductionPlanByBountyQueryKey(bountyId) },
  });

  const updateMutation = useUpdateBounty();
  const createSubmission = useCreateSubmission();

  // Submit form state
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitDate, setSubmitDate] = useState(new Date().toISOString().slice(0, 10));

  // Rescrape state
  const [rescraping, setRescraping] = useState(false);
  const [rescrapeResult, setRescrapeResult] = useState<{ prevConfidence: number; newConfidence: number } | null>(null);

  // AI generation state
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  // Report state
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  // AI Application Drafter state
  const [draftingApp, setDraftingApp] = useState(false);
  const [appDraft, setAppDraft] = useState<{ opening: string; creatorFit: string; approach: string; closing: string; fullDraft: string } | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Human-in-the-loop checkpoint state
  const [showHitL, setShowHitL] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const commitStatusChange = (status: string) => {
    updateMutation.mutate(
      { id: bountyId, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBountyQueryKey(bountyId) });
          queryClient.invalidateQueries({ queryKey: getListBountiesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
      }
    );
  };

  const handleStatusChange = (status: string) => {
    if (bounty?.status === "discovered" && bounty?.opportunityScore != null) {
      setPendingStatus(status);
      setShowHitL(true);
      return;
    }
    commitStatusChange(status);
  };

  const handleMarkSubmitted = (e: React.FormEvent) => {
    e.preventDefault();
    createSubmission.mutate(
      {
        data: {
          bountyId,
          submissionUrl: submitUrl || undefined,
          submittedAt: new Date(submitDate).toISOString(),
          notes: undefined,
        },
      },
      {
        onSuccess: () => {
          setShowSubmitForm(false);
          setSubmitUrl("");
          queryClient.invalidateQueries({ queryKey: getGetBountyQueryKey(bountyId) });
          queryClient.invalidateQueries({ queryKey: getListBountiesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSubmissionsQueryKey() });
        },
      }
    );
  };

  const handleGenerateBrief = async () => {
    if (!token || generatingBrief) return;
    setGeneratingBrief(true);
    try {
      const resp = await fetch(`/api/research-briefs/bounty/${bountyId}/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        queryClient.invalidateQueries({ queryKey: getGetResearchBriefByBountyQueryKey(bountyId) });
      }
    } finally {
      setGeneratingBrief(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!token || generatingPlan) return;
    setGeneratingPlan(true);
    try {
      const resp = await fetch(`/api/production-plans/bounty/${bountyId}/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        queryClient.invalidateQueries({ queryKey: getGetProductionPlanByBountyQueryKey(bountyId) });
      }
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleRescrape = async () => {
    if (!token || rescraping) return;
    setRescraping(true);
    setRescrapeResult(null);
    try {
      const resp = await fetch(`/api/bounties/${bountyId}/rescrape`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setRescrapeResult({ prevConfidence: data.prevConfidence, newConfidence: data.newConfidence });
        queryClient.invalidateQueries({ queryKey: getGetBountyQueryKey(bountyId) });
        queryClient.invalidateQueries({ queryKey: getListBountiesQueryKey() });
      }
    } finally {
      setRescraping(false);
    }
  };

  const handleDraftApplication = async () => {
    if (!token || draftingApp) return;
    setDraftingApp(true);
    try {
      const resp = await fetch(`/api/bounties/${bountyId}/draft-application`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setAppDraft(data);
        setShowDraftModal(true);
      }
    } finally {
      setDraftingApp(false);
    }
  };

  const handleCopyDraft = async () => {
    if (!appDraft) return;
    await navigator.clipboard.writeText(appDraft.fullDraft);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  const handleReport = async () => {
    if (!token || reporting || !reportReason) return;
    setReporting(true);
    try {
      const resp = await fetch(`/api/bounties/${bountyId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reportReason, note: reportNote || undefined }),
      });
      if (resp.ok) {
        setReportSent(true);
        setTimeout(() => { setShowReport(false); setReportSent(false); setReportReason(""); setReportNote(""); }, 2000);
      }
    } finally {
      setReporting(false);
    }
  };

  if (loadingBounty) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="text-center py-20 text-muted-foreground font-mono">
        <p>Bounty not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/bounties")}>
          Back to Bounties
        </Button>
      </div>
    );
  }

  const confidencePct = Math.round(bounty.confidenceScore ?? 0);
  const lowConfidence = (bounty.confidenceScore ?? 100) < 55;
  const config = getOpportunityConfig(bounty.opportunityType, bounty.contentFormat);

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/bounties")} className="font-mono">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-start gap-4 justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold font-sans uppercase tracking-tight">
            {bounty.title || "Untitled Bounty"}
          </h1>
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`text-xs font-mono px-2 py-0.5 rounded border ${STATUS_COLORS[bounty.status] || "bg-muted"}`}>
              {bounty.status.replace(/_/g, " ").toUpperCase()}
            </span>
            {bounty.platform && (
              <span className="text-xs font-mono px-2 py-0.5 rounded border border-border bg-secondary text-muted-foreground">
                {bounty.platform}
              </span>
            )}
            {bounty.confidenceScore != null && (
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${lowConfidence ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400" : "border-border text-muted-foreground"}`}>
                {confidencePct}% confidence
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2">
          {bounty.opportunityScore != null && (
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl md:text-5xl font-bold font-mono ${SCORE_COLOR(bounty.opportunityScore)}`}>
                {bounty.opportunityScore}
              </span>
              <span className="text-muted-foreground font-mono text-lg">/100</span>
              <span className="inline-block ml-1 px-1.5 py-0 bg-primary/10 rounded text-xs text-primary/70 font-mono">AI</span>
            </div>
          )}
          <span className="text-primary font-bold font-mono text-xl">
            {bounty.rewardAmount ? (bounty.rewardAmount.includes("-") ? bounty.rewardAmount : `$${bounty.rewardAmount}`) : "TBD"}
            {bounty.rewardCurrency && <span className="text-sm ml-1 text-muted-foreground">{bounty.rewardCurrency}</span>}
            {bounty.prizeRank && (
              <span className="inline-block ml-2 px-2 py-0 bg-primary/10 border border-primary/30 rounded text-sm font-mono">{bounty.prizeRank}</span>
            )}
          </span>
          {/* Prize Breakdown */}
          {bounty.prizeBreakdown && (() => {
            try {
              const breakdown = JSON.parse(bounty.prizeBreakdown) as Array<{rank: string; amount: string; currency: string; count?: number}>;
              if (breakdown.length === 0) return null;
              return (
                <div className="mt-2 space-y-1">
                  {breakdown.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 font-mono text-sm">
                      <span className="w-16 text-muted-foreground text-xs">{p.rank}</span>
                      <span className="font-bold">${p.amount}</span>
                      <span className="text-muted-foreground text-xs">{p.currency}</span>
                      {p.count && p.count > 1 && (
                        <span className="text-xs text-muted-foreground">x{p.count} winners</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            } catch { return null; }
          })()}
          <button
            onClick={() => setShowReport(true)}
            className="text-[10px] font-mono text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <Flag className="w-3 h-3" /> Report
          </button>
        </div>
      </div>

      <AIFeatureGate>
        {bounty.opportunityScore != null && bounty.scoreExplanation && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Score Explanation</p>
                  <span className="hidden sm:inline-block px-1.5 py-0 bg-primary/10 rounded text-[9px] text-primary/70 font-mono">AI-Generated</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDraftApplication}
                  disabled={draftingApp}
                  className="font-mono text-xs uppercase tracking-wider border-primary/30 text-primary hover:bg-primary/10 h-7 px-2 flex-shrink-0"
                >
                  {draftingApp
                    ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Drafting…</>
                    : <><Bot className="w-3 h-3 mr-1.5" />Draft</>}
                </Button>
              </div>
              <p className="text-sm">{bounty.scoreExplanation}</p>

              {/* Score Breakdown */}
              {(() => {
                if (!bounty.scoreBreakdown) return null;
                try {
                  const breakdown = JSON.parse(bounty.scoreBreakdown) as Array<{label: string; score: number; note: string}>;
                  if (!Array.isArray(breakdown) || breakdown.length === 0) return null;
                  return (
                    <div className="mt-3 space-y-2">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Score Breakdown</p>
                      {breakdown.map((c, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-16 font-mono text-[10px] text-muted-foreground uppercase flex-shrink-0">{c.label}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-0">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${(c.score / 10) * 100}%` }}
                            />
                          </div>
                          <span className="w-5 font-mono text-xs font-bold text-right flex-shrink-0">{c.score}</span>
                          <span className="hidden sm:block flex-1 text-xs text-muted-foreground">{c.note}</span>
                        </div>
                      ))}
                    </div>
                  );
                } catch { return null; }
              })()}
            </CardContent>
          </Card>
        )}
      </AIFeatureGate>

      {/* Agentic Retry Extraction */}
      {(lowConfidence || rescrapeResult) && (
        <Card className={`border ${lowConfidence && !rescrapeResult ? "border-yellow-500/30 bg-yellow-500/5" : "border-border bg-card"}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${lowConfidence && !rescrapeResult ? "text-yellow-400" : "text-muted-foreground"}`} />
              <div className="flex-1">
                {rescrapeResult ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="font-mono text-xs text-green-400">
                      Extraction retry complete — confidence {Math.round(rescrapeResult.prevConfidence)}% → {Math.round(rescrapeResult.newConfidence)}%
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="font-mono text-xs text-yellow-400 uppercase tracking-wider">Low extraction confidence ({confidencePct}%)</p>
                    <p className="text-xs text-muted-foreground mt-1">Some fields may be missing or inaccurate. The agent can retry extraction to improve the data.</p>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRescrape}
                disabled={rescraping}
                className="font-mono text-xs uppercase tracking-wider border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 flex-shrink-0"
              >
                {rescraping ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                {rescraping ? "Retrying..." : "Retry Extraction"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Bounty Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Field label="Platform" value={bounty.platform} />
          <Field label="Project" value={bounty.projectName} />
          <Field label="Deadline" value={bounty.deadline ? `${timeLeft(bounty.deadline)} (${new Date(bounty.deadline).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })})` : null} />
          {bounty.opportunityType && (
            <Field label="Opportunity Type" value={bounty.opportunityType} />
          )}
          {config.showContentFormat && bounty.contentFormat && (
            <Field label="Content Format" value={bounty.contentFormat} />
          )}
          <Field label="Deliverables" value={bounty.deliverables} className="md:col-span-2" />
          <Field label="Submission Requirements" value={bounty.submissionRequirements} className="md:col-span-2" />
          <Field label="Eligibility Rules" value={bounty.eligibilityRules} className="md:col-span-2" />
          <Field label="Important Notes" value={bounty.importantNotes} className="md:col-span-2" />
          {bounty.submissionLink && (
            <div className="md:col-span-2">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1">Submission Link</p>
              <a
                href={bounty.submissionLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary flex items-center gap-1 text-sm hover:underline"
              >
                {bounty.submissionLink} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <a href={bounty.url} target="_blank" rel="noopener noreferrer"
              className="text-primary flex items-center gap-1 text-sm hover:underline">
              Original URL <ExternalLink className="w-3 h-3" />
            </a>
            <CopyLinkButton url={`${window.location.origin}/bounties/${bounty.id}`} />
          </div>
        </CardContent>
      </Card>

      {/* Type-specific details */}
      <TypeDetailsCard
        opportunityType={bounty.opportunityType}
        contentFormat={bounty.contentFormat}
        techStack={bounty.techStack}
        programmingLanguages={bounty.programmingLanguages}
        teamSize={bounty.teamSize}
        trackCategory={bounty.trackCategory}
        difficulty={bounty.difficulty}
        skillsRequired={bounty.skillsRequired}
        estimatedHours={bounty.estimatedHours}
      />

      {/* Team / Organizer */}
      <TeamCard companyName={bounty.projectName} platform={bounty.platform} url={bounty.url} />

      {bounty.status !== "rejected" && bounty.status !== "lost" && bounty.status !== "won" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Update Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {config.workflowStatuses.map((s) => (
                <Button
                  key={s}
                  variant={bounty.status === s ? "default" : "outline"}
                  size="sm"
                  className="font-mono uppercase text-xs"
                  onClick={() => handleStatusChange(s)}
                  disabled={updateMutation.isPending}
                >
                  {s.replace(/_/g, " ")}
                </Button>
              ))}
              {bounty.status !== "submitted" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono uppercase text-xs border-teal-500/30 text-teal-400 hover:bg-teal-500/10"
                  onClick={() => setShowSubmitForm(!showSubmitForm)}
                  disabled={updateMutation.isPending}
                >
                  ✓ Mark as Submitted
                </Button>
              )}
            </div>

            {showSubmitForm && (
              <form onSubmit={handleMarkSubmitted} className="border border-teal-500/20 rounded-sm p-4 bg-teal-500/5 flex flex-col gap-3">
                <p className="font-mono text-xs uppercase tracking-wider text-teal-400">Log Submission</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1">Submission URL</label>
                    <Input
                      value={submitUrl}
                      onChange={(e) => setSubmitUrl(e.target.value)}
                      placeholder="https://..."
                      className="font-mono text-sm bg-background border-border"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1">Date Submitted</label>
                    <Input
                      type="date"
                      value={submitDate}
                      onChange={(e) => setSubmitDate(e.target.value)}
                      className="font-mono text-sm bg-background border-border"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createSubmission.isPending}
                    className="font-mono uppercase text-xs bg-teal-600 hover:bg-teal-500 text-white border-0"
                  >
                    {createSubmission.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                    Confirm Submission
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="font-mono uppercase text-xs"
                    onClick={() => setShowSubmitForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* Won / Lost result update */}
      {bounty.status === "submitted" && (
        <Card className="bg-card border-teal-500/20">
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Record Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="font-mono uppercase text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                onClick={() => handleStatusChange("won")}
                disabled={updateMutation.isPending}
              >
                🏆 Won
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="font-mono uppercase text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => handleStatusChange("lost")}
                disabled={updateMutation.isPending}
              >
                ✗ Lost
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AIFeatureGate>
        {loadingBrief ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{config.briefCardTitle}</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateBrief}
                disabled={generatingBrief}
                className="font-mono text-xs uppercase tracking-wider border-primary/30 text-primary hover:bg-primary/10 h-7 px-2"
              >
                {generatingBrief
                  ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Generating…</>
                  : <><Sparkles className="w-3 h-3 mr-1.5" />{brief ? "Regenerate" : "Generate with AI"}</>}
              </Button>
            </CardHeader>
            <CardContent className="text-sm">
              {brief ? (
                brief.fullContent ? (
                  <BriefMarkdown content={brief.fullContent} />
                ) : (
                  <div className="flex flex-col gap-4">
                    <Field label="Summary" value={brief.summary} />
                    <Field label="Content Angles" value={brief.contentAngles} />
                    <Field label="Key Points" value={brief.keyPoints} />
                    <Field label="Target Audience" value={brief.targetAudience} />
                    <Field label="Competitor Analysis" value={brief.competitorAnalysis} />
                  </div>
                )
              ) : (
                <p className="text-sm text-muted-foreground font-mono py-2">
                  {generatingBrief ? "AI is generating your research brief… This may take up to 60 seconds." : "No research brief yet. Click Generate with AI to create one."}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </AIFeatureGate>

      <AIFeatureGate>
        {loadingPlan ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{config.planCardTitle}</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGeneratePlan}
                disabled={generatingPlan}
                className="font-mono text-xs uppercase tracking-wider border-primary/30 text-primary hover:bg-primary/10 h-7 px-2"
              >
                {generatingPlan
                  ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Generating…</>
                  : <><Sparkles className="w-3 h-3 mr-1.5" />{plan ? "Regenerate" : "Generate with AI"}</>}
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              {plan ? (
                <>
                  {plan.estimatedHours && (
                    <div>
                      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1">Estimated Time</p>
                      <p className="text-primary font-bold font-mono">{plan.estimatedHours}h</p>
                    </div>
                  )}
                  <PreField label={config.planLabels.scriptOutline} value={plan.scriptOutline} />
                  <PreField label={config.planLabels.shotList} value={plan.shotList} />
                  <Field label={config.planLabels.captionDraft} value={plan.captionDraft} />
                  <PreField label="Submission Checklist" value={plan.submissionChecklist} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground font-mono">
                  {generatingPlan ? "AI is building your production plan…" : "No production plan yet. Click Generate with AI to create one."}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </AIFeatureGate>

      <ReportModal
        show={showReport}
        onClose={() => setShowReport(false)}
        reason={reportReason}
        setReason={setReportReason}
        note={reportNote}
        setNote={setReportNote}
        onSubmit={handleReport}
        sending={reporting}
        sent={reportSent}
      />

      {/* ── AI Application Drafter Modal ─────────────────────── */}
      {showDraftModal && appDraft && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowDraftModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono font-bold text-base flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" /> AI Application Draft
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Generated by Qwen AI · personalised to your profile and this bounty
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyDraft}
                  className="font-mono text-xs h-7 px-2 border-primary/30 text-primary hover:bg-primary/10"
                >
                  {copiedDraft
                    ? <><Check className="w-3 h-3 mr-1" />Copied</>
                    : <><Copy className="w-3 h-3 mr-1" />Copy</>}
                </Button>
                <button onClick={() => setShowDraftModal(false)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { label: "Opening", value: appDraft.opening },
                { label: "Why I'm a Good Fit", value: appDraft.creatorFit },
                { label: "My Approach", value: appDraft.approach },
                { label: "Closing", value: appDraft.closing },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                  <p className="text-sm bg-muted/30 rounded-sm p-3 leading-relaxed">{value}</p>
                </div>
              ))}
            </div>

            <div className="pt-1">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Full Draft (ready to submit)</p>
              <pre className="text-sm bg-muted/30 rounded-sm p-3 whitespace-pre-wrap leading-relaxed font-sans border border-border">
                {appDraft.fullDraft}
              </pre>
            </div>

            <Button
              className="w-full font-mono uppercase text-xs tracking-wider"
              onClick={handleCopyDraft}
            >
              {copiedDraft ? <><Check className="w-3 h-3 mr-1.5" />Copied to clipboard</> : <><Copy className="w-3 h-3 mr-1.5" />Copy full draft</>}
            </Button>
          </div>
        </div>
      )}

      {/* ── Human-in-the-Loop Checkpoint Modal ───────────────── */}
      {showHitL && bounty && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowHitL(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono font-bold text-base flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" /> Agent Checkpoint
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Review the AI reasoning before committing to this opportunity
                </p>
              </div>
              <button onClick={() => setShowHitL(false)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {bounty.opportunityScore != null && (
              <div className="flex items-center gap-4 p-3 rounded-sm border border-primary/30 bg-primary/5">
                <div className="text-center">
                  <p className={`text-3xl font-bold font-mono ${bounty.opportunityScore >= 7 ? "text-green-400" : bounty.opportunityScore >= 5 ? "text-yellow-400" : "text-red-400"}`}>
                    {bounty.opportunityScore}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">/100</p>
                </div>
                <div className="flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Qwen AI Score</p>
                  <p className="text-sm leading-relaxed">{bounty.scoreExplanation}</p>
                </div>
              </div>
            )}

            {bounty.scoreBreakdown && (() => {
              try {
                const bd = JSON.parse(bounty.scoreBreakdown) as Array<{ label: string; score: number; note: string }>;
                if (!Array.isArray(bd) || bd.length === 0) return null;
                return (
                  <div className="space-y-2">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Score Breakdown</p>
                    {bd.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-16 font-mono text-[10px] text-muted-foreground uppercase flex-shrink-0">{c.label}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-0">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(c.score / 10) * 100}%` }} />
                        </div>
                        <span className="w-5 font-mono text-xs font-bold text-right flex-shrink-0">{c.score}</span>
                        <span className="hidden sm:block flex-1 text-xs text-muted-foreground min-w-0 truncate">{c.note}</span>
                      </div>
                    ))}
                  </div>
                );
              } catch { return null; }
            })()}

            <p className="text-sm text-muted-foreground">
              The autopilot has evaluated this opportunity. You're about to move it to <span className="font-mono text-foreground">{pendingStatus?.replace(/_/g, " ").toUpperCase()}</span>. Confirm to proceed.
            </p>

            <div className="flex gap-3">
              <Button
                className="flex-1 font-mono uppercase text-xs tracking-wider"
                onClick={() => {
                  setShowHitL(false);
                  if (pendingStatus) commitStatusChange(pendingStatus);
                  setPendingStatus(null);
                }}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Confirm &amp; Pursue
              </Button>
              <Button
                variant="outline"
                className="flex-1 font-mono uppercase text-xs tracking-wider"
                onClick={() => { setShowHitL(false); setPendingStatus(null); }}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportModal({ show, onClose, reason, setReason, note, setNote, onSubmit, sending, sent }: {
  show: boolean; onClose: () => void; reason: string; setReason: (r: string) => void;
  note: string; setNote: (n: string) => void; onSubmit: () => void; sending: boolean; sent: boolean;
}) {
  if (!show) return null;
  const reasons = [
    { key: "broken_link", label: "Broken link" },
    { key: "wrong_info", label: "Wrong information" },
    { key: "spam", label: "Spam / scam" },
    { key: "expired", label: "Bounty expired" },
    { key: "other", label: "Other" },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono font-bold text-base flex items-center gap-2"><Flag className="w-4 h-4 text-red-400" /> Report Bounty</p>
            <p className="text-xs text-muted-foreground mt-1">Flag this opportunity so the admin can review it.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"><X className="w-4 h-4" /></button>
        </div>
        {sent ? (
          <div className="text-center py-6">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="font-mono text-sm text-green-400">Report sent. Thanks for helping keep the platform clean.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Reason</p>
              <div className="grid grid-cols-2 gap-2">
                {reasons.map(r => (
                  <button
                    key={r.key}
                    onClick={() => setReason(r.key)}
                    className={`text-left px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
                      reason === r.key
                        ? "bg-red-500/10 border-red-500/30 text-red-400"
                        : "bg-card border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Note <span className="normal-case text-muted-foreground/50">(optional)</span></p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Describe the issue in more detail..."
                rows={3}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-red-400/50 transition-colors resize-none placeholder:text-muted-foreground/50"
              />
            </div>
            <Button
              onClick={onSubmit}
              disabled={sending || !reason}
              className="w-full font-mono uppercase tracking-wider bg-red-500 hover:bg-red-400 text-white"
            >
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {sending ? "Sending..." : "Send Report"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function BriefMarkdown({ content }: { content: string }) {
  return (
    <div className="brief-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mt-6 mb-2 pt-4 border-t border-border first:mt-0 first:pt-0 first:border-t-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-sans font-bold text-sm uppercase tracking-tight mt-3 mb-1.5 text-foreground">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-sm leading-relaxed mb-2 text-foreground/90">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="flex flex-col gap-1.5 mb-3">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="flex flex-col gap-1.5 mb-3 list-none">{children}</ol>
          ),
          li: ({ children, ...props }) => {
            const ordered = (props as any).ordered;
            return (
              <li className="flex gap-2 text-sm leading-relaxed">
                <span className="text-primary font-mono flex-shrink-0 mt-0.5">{ordered ? "→" : "→"}</span>
                <span className="text-foreground/90">{children}</span>
              </li>
            );
          },
          strong: ({ children }) => (
            <strong className="font-bold text-foreground">{children}</strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-primary">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground text-sm my-2">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-border my-4" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function parseAiContent(value: string): string[] | null {
  const trimmed = value.trim();
  // JSON array like ["a","b"]
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {}
  }
  // Qwen sometimes returns {"a","b"} or {"a","b","c"}
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const inner = trimmed.slice(1, -1);
    try {
      const arr = JSON.parse(`[${inner}]`);
      if (Array.isArray(arr) && arr.length > 1) return arr.map(String);
    } catch {}
  }
  // Comma-separated multi-line bullets starting with - or •
  const lines = trimmed.split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  if (lines.length > 1 && trimmed.includes("\n")) return lines;
  return null;
}

function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  if (!value) return null;
  const items = parseAiContent(value);
  return (
    <div className={className}>
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      {items ? (
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="text-primary font-mono mt-0.5 flex-shrink-0">→</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed">{value}</p>
      )}
    </div>
  );
}

function PreField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  const items = parseAiContent(value);
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      {items ? (
        <ul className="flex flex-col gap-2.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="text-primary font-mono mt-0.5 flex-shrink-0 text-xs">{String(i + 1).padStart(2, "0")}.</span>
              <span className="font-mono text-sm">{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <pre className="text-sm font-mono whitespace-pre-wrap bg-background border border-border rounded-sm p-3 leading-relaxed">
          {value}
        </pre>
      )}
    </div>
  );
}
