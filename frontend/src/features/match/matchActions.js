import { useStore } from "@/state/store";
import { uid } from "@/lib/format";
import { inr } from "@/features/ops/ui";
import { toast } from "sonner";

export const FAST_TRACK = { conf: 0.9, amount: 200000 }; // risk-tiered: low-risk AI matches skip the checker

export const isFastTrack = (confidence, amount) => confidence >= FAST_TRACK.conf && amount <= FAST_TRACK.amount;

/**
 * A suggestion is ambiguous when nothing deterministic (UTR, PAN, cheque + bank + account) backs it —
 * amount and name alone. Ambiguous matches are never confirmed automatically, whatever the confidence.
 */
export const isAmbiguous = (s) => !(s.reasons || []).some((r) => r.ok && /UTR|PAN|cheque/i.test(r.text));

/** Shared by Match Workbench and My Work, so a match proposed from either place behaves the same. */
export function useMatchActions() {
  const { collections, act, upsert, currentUser, simple } = useStore();
  const credits = collections.credits || [];
  const purchases = collections.purchases || [];
  const byId = (list, id) => list.find((x) => x.id === id);

  const setStatus = (ids, kind, status) => ids.forEach((id) => { const x = byId(kind === "credits" ? credits : purchases, id); if (x) upsert(kind, { ...x, status }); });

  const propose = (creditIds, purchaseIds, source, confidence, ambiguous = false) => {
    const amount = creditIds.reduce((s, id) => s + (byId(credits, id)?.amount || 0), 0);
    const fast = source === "ai" && !ambiguous && isFastTrack(confidence, amount);
    const m = { id: uid("m"), credits: creditIds, purchases: purchaseIds, amount, source, confidence, status: fast ? "confirmed" : "pending", owner: currentUser, createdAt: new Date().toISOString(), type: `${creditIds.length > 1 ? "N" : "1"}:${purchaseIds.length > 1 ? "N" : "1"}` };
    const res = act({ screen: "match", cap: "edit", audit: { entityLabel: `${m.type} match ${inr(amount)}`, action: fast ? "Match confirmed (fast-track)" : "Propose match", to: fast ? "Matched" : "Pending checker", comment: source === "ai" ? `AI suggestion, confidence ${(confidence * 100).toFixed(0)}%` : "Manual selection" } });
    if (!res.ok) { toast.error(res.error); return false; }
    upsert("matches", m);
    setStatus(creditIds, "credits", fast ? "matched" : "proposed");
    setStatus(purchaseIds, "purchases", fast ? "matched" : "proposed");
    if (simple) toast.success(fast ? "Matched. Nothing else to do." : "Sent to your team lead for approval.");
    else toast.success(fast ? "Low-risk match confirmed (fast-track, no checker needed)" : "Match proposed — waiting for a checker");
    return true;
  };

  const acceptSuggestion = (s) => { if (propose(s.credits, s.purchases, "ai", s.confidence, isAmbiguous(s))) upsert("suggestions", { ...s, decided: "accepted" }); };
  const dismissSuggestion = (s) => {
    upsert("suggestions", { ...s, decided: "dismissed" });
    toast(simple ? "OK — marked as not a match." : "Suggestion dismissed — it stays visible in the 'Why not matched' explainer");
  };

  return { propose, acceptSuggestion, dismissSuggestion, setStatus, byId, credits, purchases };
}
