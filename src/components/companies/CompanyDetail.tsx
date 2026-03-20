"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FindDrugsButton } from "@/components/discovery/FindDrugsButton";
import {
  Globe,
  MapPin,
  Star,
  Mail,
  Linkedin,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  Phone,
  Users,
  Send,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BdStatus =
  | "prospect"
  | "contacted"
  | "engaged"
  | "negotiating"
  | "contracted"
  | "disqualified";

const BD_STAGES: { value: BdStatus; label: string }[] = [
  { value: "prospect", label: "Prospect" },
  { value: "contacted", label: "Contacted" },
  { value: "engaged", label: "Engaged" },
  { value: "negotiating", label: "Negotiating" },
  { value: "contracted", label: "Contracted" },
  { value: "disqualified", label: "Disqualified" },
];

const ACTIVITY_TYPES = [
  { value: "note", label: "Note", icon: MessageSquare },
  { value: "email_sent", label: "Email Sent", icon: Send },
  { value: "email_received", label: "Email Received", icon: Mail },
  { value: "call", label: "Call", icon: Phone },
  { value: "meeting", label: "Meeting", icon: Users },
] as const;

function ActivityIcon({ type }: { type: string }) {
  const map: Record<string, typeof MessageSquare> = {
    note: MessageSquare,
    email_sent: Send,
    email_received: Mail,
    call: Phone,
    meeting: Users,
    stage_change: ChevronUp,
    deal_update: Star,
  };
  const Icon = map[type] ?? MessageSquare;
  return <Icon className="h-3.5 w-3.5 shrink-0" />;
}

interface CompanyDetailProps {
  companyId: string;
}

export function CompanyDetail({ companyId }: CompanyDetailProps) {
  const company = useQuery(api.companies.get, {
    id: companyId as Id<"companies">,
  });
  const activities = useQuery(api.bdActivities.list, {
    companyId: companyId as Id<"companies">,
    limit: 20,
  });

  const updateCompany = useMutation(api.companies.update);
  const moveStage = useMutation(api.companies.moveStage);
  const addActivity = useMutation(api.bdActivities.create);
  const scoreCompany = useAction(api.discovery.scoreCompanyForBD);

  const [showBD, setShowBD] = useState(true);
  const [isScoring, setIsScoring] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [activityType, setActivityType] = useState<"note" | "email_sent" | "email_received" | "call" | "meeting">("note");
  const [savingNotes, setSavingNotes] = useState(false);
  const [bdNotes, setBdNotes] = useState<string | undefined>(undefined);

  if (company === undefined) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 space-y-3 mb-8">
        <Skeleton className="h-6 w-1/3 bg-zinc-800" />
        <Skeleton className="h-4 w-1/4 bg-zinc-800" />
        <Skeleton className="h-4 w-full bg-zinc-800" />
      </div>
    );
  }

  if (!company) return null;

  const effectiveNotes = bdNotes ?? company.bdNotes ?? "";

  async function handleScore() {
    setIsScoring(true);
    try {
      await scoreCompany({ companyId: companyId as Id<"companies"> });
    } finally {
      setIsScoring(false);
    }
  }

  async function handleStageChange(newStatus: BdStatus) {
    await moveStage({ id: companyId as Id<"companies">, newStatus });
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    await addActivity({
      companyId: companyId as Id<"companies">,
      type: activityType,
      content: newNote.trim(),
    });
    setNewNote("");
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    await updateCompany({
      id: companyId as Id<"companies">,
      bdNotes: effectiveNotes,
    });
    setSavingNotes(false);
  }

  return (
    <div className="space-y-6 mb-8">
      {/* Main company card */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">{company.name}</h2>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-zinc-500">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {company.country}
              </span>
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-zinc-300 transition-colors"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Website
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FindDrugsButton companyId={companyId} />
            <Badge
              variant={company.status === "active" ? "default" : "secondary"}
              className={
                company.status === "active"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-zinc-800 text-zinc-400"
              }
            >
              {company.status}
            </Badge>
          </div>
        </div>

        {company.description && (
          <p className="text-sm text-zinc-400 mb-4">{company.description}</p>
        )}

        {company.therapeuticAreas.length > 0 && (
          <div>
            <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">
              Therapeutic Areas
            </p>
            <div className="flex flex-wrap gap-2">
              {company.therapeuticAreas.map((area) => (
                <Badge
                  key={area}
                  variant="secondary"
                  className="bg-zinc-800 text-zinc-300 border-0"
                >
                  {area}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BD Status Panel */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900">
        <button
          onClick={() => setShowBD((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-zinc-300 uppercase tracking-wider hover:bg-zinc-800/50 transition-colors rounded-lg"
        >
          <span className="flex items-center gap-2">
            <Star className="h-4 w-4 text-orange-400" />
            BD Assessment
            {company.bdScore != null && (
              <span className="text-orange-400 font-bold">{company.bdScore.toFixed(1)}/10</span>
            )}
          </span>
          {showBD ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showBD && (
          <div className="px-6 pb-6 space-y-5 border-t border-zinc-800 pt-4">
            {/* Stage + Score row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-zinc-500 mb-1.5">BD Stage</p>
                <Select
                  value={company.bdStatus ?? "prospect"}
                  onValueChange={(v) => handleStageChange(v as BdStatus)}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {BD_STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-1.5">Company Size</p>
                <div className="h-9 flex items-center">
                  <span className={`text-sm px-2 py-1 rounded ${
                    company.companySize === "sme"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : company.companySize === "mid"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : company.companySize === "large"
                          ? "bg-red-500/10 text-red-400"
                          : "text-zinc-500"
                  }`}>
                    {company.companySize ?? "Unknown"}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-1.5">MENA Presence</p>
                <div className="h-9 flex items-center">
                  <span className={`text-sm px-2 py-1 rounded ${
                    company.menaPresence === "none"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : company.menaPresence === "limited"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : company.menaPresence === "established"
                          ? "bg-red-500/10 text-red-400"
                          : "text-zinc-500"
                  }`}>
                    {company.menaPresence ?? "Unknown"}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-1.5">BD Score</p>
                <div className="flex items-center gap-2 h-9">
                  {company.bdScore != null ? (
                    <span className="text-xl font-bold text-white">
                      {company.bdScore.toFixed(1)}
                      <span className="text-sm text-zinc-500">/10</span>
                    </span>
                  ) : (
                    <span className="text-sm text-zinc-500">Not scored</span>
                  )}
                </div>
              </div>
            </div>

            {/* Score rationale */}
            {company.bdScoreRationale && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Score Rationale</p>
                <p className="text-sm text-zinc-400">{company.bdScoreRationale}</p>
              </div>
            )}

            {/* Revenue / employees */}
            {(company.revenueEstimate || company.employeeCount) && (
              <div className="flex gap-6">
                {company.revenueEstimate && (
                  <div>
                    <p className="text-xs text-zinc-500">Revenue</p>
                    <p className="text-sm text-zinc-300">{company.revenueEstimate}</p>
                  </div>
                )}
                {company.employeeCount && (
                  <div>
                    <p className="text-xs text-zinc-500">Employees</p>
                    <p className="text-sm text-zinc-300">{company.employeeCount}</p>
                  </div>
                )}
              </div>
            )}

            {/* Contact info */}
            {(company.contactName || company.contactEmail) && (
              <div className="rounded-md bg-zinc-800 p-3 space-y-1">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  Key Contact
                </p>
                {company.contactName && (
                  <p className="text-sm text-white font-medium">
                    {company.contactName}
                    {company.contactTitle && (
                      <span className="text-zinc-500 font-normal">
                        {" "}· {company.contactTitle}
                      </span>
                    )}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  {company.contactEmail && (
                    <a
                      href={`mailto:${company.contactEmail}`}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Mail className="h-3 w-3" />
                      {company.contactEmail}
                    </a>
                  )}
                  {company.linkedinUrl && (
                    <a
                      href={company.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Linkedin className="h-3 w-3" />
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* BD Notes */}
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">BD Notes</p>
              <textarea
                value={effectiveNotes}
                onChange={(e) => setBdNotes(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="Add notes about this company's BD potential, last conversation, next steps..."
                className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded p-3 text-zinc-300 resize-none h-24 focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
              />
              {savingNotes && (
                <p className="text-xs text-zinc-600 mt-0.5">Saving...</p>
              )}
            </div>

            {/* Rescore button */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleScore}
                disabled={isScoring}
                className="border-zinc-700 hover:bg-zinc-800"
              >
                {isScoring ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                    Scoring...
                  </>
                ) : (
                  <>
                    <Star className="h-3 w-3 mr-1.5" />
                    Run BD Scoring
                  </>
                )}
              </Button>
              {company.bdScoredAt && (
                <span className="text-xs text-zinc-600 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last scored {new Date(company.bdScoredAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
          Activity Log
        </h3>

        {/* Add activity form */}
        <div className="space-y-2 mb-4">
          <div className="flex gap-2">
            <Select
              value={activityType}
              onValueChange={(v) => setActivityType(v as typeof activityType)}
            >
              <SelectTrigger className="w-36 bg-zinc-800 border-zinc-700 text-white h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
              placeholder="Log an activity or note..."
              className="flex-1 text-sm bg-zinc-800 border border-zinc-700 rounded px-3 h-9 text-white focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
            />
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!newNote.trim()}
              className="h-9 bg-zinc-700 hover:bg-zinc-600 shrink-0"
            >
              Log
            </Button>
          </div>
        </div>

        {/* Activity list */}
        {activities === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center py-4">
            No activities logged yet
          </p>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div
                key={activity._id}
                className="flex items-start gap-2.5 text-sm"
              >
                <div className="mt-0.5 text-zinc-600">
                  <ActivityIcon type={activity.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-300 leading-snug">{activity.content}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {activity.type.replace("_", " ")} ·{" "}
                    {new Date(activity.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
