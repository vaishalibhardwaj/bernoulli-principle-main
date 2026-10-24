import { useNavigate } from "react-router-dom";
import { useStore } from "@/state/store";
import { hasCap } from "@/lib/access";
import { scopeToUser } from "@/lib/journey";
import { PLAIN_EXCEPTION } from "@/lib/plain";
import { maskAccount } from "@/lib/format";
import { inr, timeLeftWords } from "@/features/ops/ui";
import { useMatchActions, isFastTrack, isAmbiguous } from "@/features/match/matchActions";
import { toast } from "sonner";

/** Everything a maker could do right now, as one prioritised list (red → amber → green). */
const TONE_ORDER = { red: 0, amber: 1, green: 2 };

export function useWorkItems() {
  const { collections: raw, perms, personaUser, act, currentUser, amcUser } = useStore();
  const collections = scopeToUser(raw, amcUser); // only this person's AMCs
  const nav = useNavigate();
  const { acceptSuggestion, dismissSuggestion, byId, credits, purchases } = useMatchActions();
  const me = personaUser.name;
  const items = [];

  const take = (e) => {
    const res = act({ screen: "exceptions", cap: "edit", kind: "exceptions", id: e.id, patch: { owner: me, status: "in_progress" }, audit: { entityLabel: `${e.ref} · ${e.type}`, action: "Assign", comment: `Picked up by ${me}` } });
    if (res.ok) toast.success("It's yours now. Open it when you're ready.");
  };

  if (hasCap(perms, "exceptions", "edit")) {
    (collections.exceptions || []).filter((e) => ["open", "in_progress"].includes(e.status) && (e.owner === me || (!e.owner && e.amount > 0 && e.interestHoursLeft < 24))).forEach((e) => {
      const mine = e.owner === me; const clock = e.amount > 0;
      items.push({
        id: e.id, tone: clock && e.interestHoursLeft < 24 ? "red" : clock && e.interestHoursLeft < 72 ? "amber" : "green", sort: clock ? e.interestHoursLeft : 999,
        kind: "Problem case", step: 3, title: PLAIN_EXCEPTION[e.type] || e.type,
        detail: `${e.investor !== "—" ? e.investor + " · " : ""}${e.amount ? inr(e.amount) : e.bankName}`,
        when: clock ? timeLeftWords(e.interestHoursLeft) : null,
        hint: mine ? `What to do: ${e.suggestion.action.replace("Open in Match Workbench", "Find the matching purchase").replace("Open File Inbox", "Check the bank file")}` : "Nobody is working on this yet",
        primary: mine ? { label: "Open case", run: () => nav(`/exceptions?case=${e.id}`) } : { label: "Take this case", run: () => take(e) },
      });
    });
  }
  if (hasCap(perms, "match", "edit")) {
    (collections.suggestions || []).filter((s) => !s.decided).forEach((s) => {
      const cs = s.credits.map((id) => byId(credits, id)).filter(Boolean);
      const ps = s.purchases.map((id) => byId(purchases, id)).filter(Boolean);
      if (!cs.length || !ps.length) return;
      const amount = cs.reduce((a, c) => a + c.amount, 0); const sure = s.confidence >= 0.9;
      items.push({
        id: s.id, tone: sure ? "green" : "amber", sort: 500 + (1 - s.confidence) * 100, kind: "Match a payment", step: 2,
        title: cs.length > 1 ? `${cs.length} payments from ${cs[0].remitter} add up to ${ps[0].investor}'s purchase` : ps.length > 1 ? `One payment from ${cs[0].remitter} covers ${ps.length} purchases by ${ps[0].investor}` : `Payment from ${cs[0].remitter} looks like ${ps[0].investor}'s purchase`,
        detail: `${inr(amount)} · ${ps.map((p) => p.appNo).join(", ")}`, light: sure && !isAmbiguous(s) ? "Very likely" : "Please check",
        hint: isAmbiguous(s) ? "Based on amount and name only — check carefully; a checker confirms it" : isFastTrack(s.confidence, amount) ? "Say yes and it's done — no approval needed" : "Say yes and your checker approves it",
        primary: { label: "Yes, match", run: () => acceptSuggestion(s) }, secondary: { label: "Not a match", run: () => dismissSuggestion(s) }, more: { label: "See why", run: () => nav("/match") },
      });
    });
  }
  if (hasCap(perms, "extraction", "edit")) {
    (collections.documents || []).filter((d) => d.status === "needs_review").forEach((d) => {
      const n = d.fields.filter((f) => f.conf < 0.95 || (f.validator && !f.validator.ok)).length + d.lines.reduce((k, l) => k + Object.values(l).filter((v) => v[1] < 0.95).length, 0);
      items.push({ id: d.id, tone: "amber", sort: 600, kind: "Check a document", step: 2, title: `Check ${n} value${n !== 1 ? "s" : ""} the system wasn't sure about`, detail: `${d.docType} · ${d.name}`, hint: "Everything else on it was read correctly", primary: { label: "Check values", run: () => nav(`/extraction?doc=${d.id}`) } });
    });
  }
  if (hasCap(perms, "refunds", "edit")) {
    (collections.refunds || []).filter((r) => r.status === "draft").forEach((r) => items.push({
      id: r.id, tone: r.ageDays >= 4 ? "red" : "amber", sort: 300 - r.ageDays, kind: "Refund", step: 5, title: `Refund ${inr(r.amount)} to ${r.investor}`, detail: `${r.reason} · to ${r.bankAcct}`,
      when: r.ageDays >= 5 ? "Late — interest is being added" : `${5 - r.ageDays} day${5 - r.ageDays !== 1 ? "s" : ""} before interest applies`,
      hint: r.verified ? "Bank account already verified" : "Verify the bank account first", primary: { label: "Prepare refund", run: () => nav(`/refunds?refund=${r.id}`) },
    }));
  }
  if (hasCap(perms, "ingestion", "edit")) {
    const setup = hasCap(perms, "bank_setup", "edit");
    (collections.files || []).filter((f) => ["late", "missing", "check_failed", "retrying", "unknown"].includes(f.status) || (f.status === "drift" && setup)).forEach((f) => {
      const manual = f.channel === "manual";
      const how = { late: manual ? "upload" : "pull", missing: manual ? "upload" : "pull", check_failed: f.corrected ? "reprocess" : "corrected", retrying: "reprocess", unknown: "onboard", drift: "drift" }[f.status];
      items.push({
        id: f.id, tone: ["late", "missing"].includes(f.status) ? "red" : "amber", sort: 100, kind: "Bank file", step: 1,
        title: { upload: `Upload today's ${f.bankName} statement`, pull: `${f.bankName} statement hasn't arrived`, corrected: `${f.bankName} statement balances don't add up`, refetch: `${f.bankName} statement balances don't add up`, reprocess: `Reprocess the ${f.bankName} statement`, onboard: `${f.bankName} sent a file we don't recognise`, drift: `${f.bankName} changed its file layout` }[how],
        detail: `Account ·${f.accountNumber.slice(-4)} · arrives by ${{ manual: "manual upload", email: "email", api: "API", auto: "portal bot" }[f.channel]}`,
        hint: { upload: "Download it from internet banking, then upload it here", pull: "Pull it now, or upload it by hand", corrected: "Ask the bank for a corrected statement, then upload it", refetch: "Re-fetch the full statement, then reprocess", reprocess: "A fresh copy is ready — reprocess it", onboard: "Needs a new setup", drift: "The system has proposed the new mapping — confirm it" }[how],
        primary: { label: { upload: "Upload statement", pull: "Get the file", corrected: "Upload corrected file", refetch: "Open file", reprocess: "Reprocess", onboard: "Open file", drift: "Review new layout" }[how], run: () => nav(`/ingestion?file=${f.id}${["upload", "corrected"].includes(how) ? "&upload=1" : ""}`) },
      });
    });
    const loadedIds = (collections.files || []).filter((f) => ["loaded", "nil"].includes(f.status)).map((f) => f.id);
    // An email alert leaves the focus list once the statement is loaded another way, or it was dismissed / parked.
    const emailOpen = (e) => e.status === "rejected" && !e.dismissed && !e.waiting && e.reason !== "duplicate" && !(e.suggestFileId && loadedIds.includes(e.suggestFileId));
    (collections.emails || []).filter(emailOpen).forEach((e) => { const useful = e.suggestFileId && !loadedIds.includes(e.suggestFileId); items.push({
      id: e.id, tone: useful ? "red" : "amber", sort: 150, kind: "Rejected email", step: 1,
      title: useful ? "A statement email was rejected, but it's the one we're missing" : `Email from ${e.from} was rejected`,
      detail: e.reasonText, hint: e.attachment.name ? `Attachment: ${e.attachment.name}` : "No attachment",
      primary: { label: useful ? "Use this attachment" : "Open email", run: () => nav(`/ingestion?tab=email&email=${e.id}`) },
    }); });
    (collections.connections || []).filter((x) => x.status === "failing" && !x.dismissed).forEach((x) => items.push({
      id: x.id, tone: "amber", sort: 160, kind: "Bank connection", step: 1, title: `${x.bankName} ${x.type === "api" ? "API" : "portal bot"} is failing`, detail: x.error,
      hint: x.captcha ? "Download the statement by hand and upload it" : "The token needs renewing in Bank statement setup",
      primary: { label: "Open connection", run: () => nav("/ingestion?tab=conns") },
    }));
  }
  if (hasCap(perms, "bank_setup", "edit")) {
    (collections.bank_config || []).filter((x) => x.status === "rejected" && x.owner === currentUser).forEach((x) => items.push({
      id: x.id, tone: "amber", sort: 200, kind: "Rejected setup", title: `Fix ${x.bankName} ${maskAccount(x.accountNumber)} — sent back by checker`, detail: x.rejection?.comment || "", hint: "Make the change and resubmit",
      primary: { label: "Fix setup", run: () => nav(`/bank-setup/edit/${x.id}`) },
    }));
  }
  items.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || a.sort - b.sort);
  return items;
}

