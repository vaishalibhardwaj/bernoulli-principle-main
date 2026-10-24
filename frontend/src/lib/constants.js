import { Sparkles, Pencil, History, Shapes, Hand, DownloadCloud, Upload, Mail, Plug, Heading } from "lucide-react";

export const STATUS = {
  not_started: { label: "Not Started", cls: "pill-not_started" },
  draft: { label: "Draft", cls: "pill-draft" },
  pending: { label: "Pending for approval", cls: "pill-pending" },
  rejected: { label: "Rejected", cls: "pill-rejected" },
  active: { label: "Active", cls: "pill-active" },
  inactive: { label: "Inactive", cls: "pill-inactive" },
};

export const CHIP = {
  auto: { label: "Auto-detected", icon: Sparkles, cls: "chip-auto" },
  edited: { label: "Edited", icon: Pencil, cls: "chip-edited" },
  previous: { label: "From previous mapping", icon: History, cls: "chip-previous" },
  pattern: { label: "Pattern match", icon: Shapes, cls: "chip-pattern" },
  manual: { label: "Manual", icon: Hand, cls: "chip-manual" },
  header: { label: "Header name match", icon: Heading, cls: "chip-auto" },
};

export const BANK_MODES = {
  auto: { label: "Auto Download", icon: DownloadCloud, desc: "Fetch statements automatically from the bank portal on a schedule.", req: "URL, Corporate ID, credentials & a schedule" },
  manual: { label: "Manual Upload (SFTP)", icon: Upload, desc: "Operator uploads the statement file manually via SFTP.", req: "SFTP upload path & file-name pattern" },
  email: { label: "Email", icon: Mail, desc: "Statements arrive as email attachments and are parsed.", req: "Sender, receiver & subject pattern (backup channel)" },
  api: { label: "API", icon: Plug, desc: "Pull statements through the bank's REST API endpoint.", req: "URL, Login ID, credentials & a schedule" },
};

export const CREDIT_MODES = {
  email: { label: "Email", icon: Mail, desc: "Credit MIS files received as email attachments.", req: "From/Receiver email, subject & file pattern" },
  auto: { label: "Auto", icon: DownloadCloud, desc: "Auto-download MIS from the aggregator portal.", req: "URL, User ID & password" },
  manual: { label: "Manual", icon: Upload, desc: "Operator uploads the Credit MIS file manually.", req: "File name pattern only" },
  api: { label: "API", icon: Plug, desc: "Pull Credit MIS through the aggregator API.", req: "Connection handled by platform (N/A step)" },
};

// PRD v1 / Credit MIS PRD: Subscription or Liability (Liability needs a category in Credit MIS).
export const RECON_TYPES = ["Subscription", "Liability"];
export const PA_CODES = ["Razorpay", "CAMSPay", "BillDesk", "PayU", "CCAvenue", "Cashfree"];
export const PAY_MECHANISMS = ["NetBanking", "UPI", "NEFT/RTGS", "Debit Card", "Credit Card", "Mandate"];

export const KIND_LABELS = {
  bank_config: "Bank Config",
  credit_config: "Credit MIS Config",
  bank_mapping: "Bank Mapping",
  credit_mapping: "Credit MIS Mapping",
};

// One status filter set for every setup / master screen.
export const STATUS_FILTERS = [
  { key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "inactive", label: "Inactive" },
  { key: "draft", label: "Draft" }, { key: "pending", label: "Pending for approval" }, { key: "rejected", label: "Rejected" },
];
/** Records not started yet (e.g. a mapping nobody has opened) count as Draft. */
export const statusBucket = (st) => (st === "not_started" ? "draft" : st);
