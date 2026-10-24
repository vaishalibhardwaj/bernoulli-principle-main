// What the backend works out from one sample statement, so the maker only confirms.
// (Simulated here from the demo files; in production this runs server-side on the uploaded file.)
import { detectFor, buildPreview, sampleTable, detectAccountInSample } from "@/mock/sampleFiles";
import { MAPPING_FIELDS, matchHeader, suggestIncremental, isStandard } from "@/lib/setupSchema";
import { isAmbiguous } from "@/features/mapping/DateFormatBuilder";

export function analyseSample(fileName, collections) {
  const meta = detectFor(fileName);
  if (!meta) return null;
  const standard = Boolean(meta.standard);
  const preview = buildPreview(fileName);
  const table = sampleTable(fileName);
  const header = table?.header?.map((h) => String(h).trim()) || [];
  const account = detectAccountInSample(fileName);

  // Column mapping by header name, with a confidence per field.
  const fields = MAPPING_FIELDS.map(([sf, attr]) => {
    const hit = standard ? null : header.find((c) => c && matchHeader(sf, c) && !(sf === "BANK_STMT_DATE" && /value/i.test(c)));
    const exact = hit && hit.replace(/[^a-z]/gi, "").toUpperCase() === sf.replace(/[^A-Z]/g, "");
    return { group: "input", systemField: sf, attribute: attr, mappedColumn: hit || "", source: hit ? "header" : "manual", conf: hit ? (exact ? 0.98 : 0.87) : null, mandatory: sf === "VALUE_DATE", incremental: false, status: hit ? "mapped" : "pending" };
  });
  // PRD rule: a combined amount column disables the separate credit / debit fields.
  if (fields.find((f) => f.systemField === "INSTRM_AMOUNT")?.status === "mapped") fields.forEach((f) => { if (/^INSTRM_AMOUNT_(CREDIT|DEBIT)$/.test(f.systemField)) Object.assign(f, { mappedColumn: "", status: "pending", source: "manual", conf: null }); });
  const keys = table ? suggestIncremental(fields, header, table.data) : { keys: [], unique: true, rows: 0 };
  fields.forEach((f) => { f.incremental = keys.keys.includes(f.systemField); });
  const mapped = fields.filter((f) => f.status === "mapped");
  const hasAmount = mapped.some((f) => /^INSTRM_AMOUNT/.test(f.systemField));
  const hasNarr = mapped.some((f) => /BANK_(NARRATION|DESCRIPTION)/.test(f.systemField));
  const hasDate = mapped.some((f) => f.systemField === "VALUE_DATE");
  const lowConf = mapped.filter((f) => f.conf < 0.9).length;

  const hasBalance = standard || header.some((h) => /balance/i.test(h));
  const statusVals = meta.status?.style === "column" && table ? [...new Set(table.data.map((r) => (r[header.indexOf(meta.status.column)] || "").trim()).filter(Boolean))] : meta.status?.values || [];
  const known = (collections.status_map || []).filter((r) => r.status === "active").map((r) => r.source.toUpperCase());
  const unknownStatus = statusVals.filter((v) => !known.includes(v.toUpperCase()));

  // Does this layout already exist for this bank? Then the new account simply uses it.
  const sameBank = account ? (collections.bank_config || []).filter((c) => c.bankName === account.bankName && c.status === "active") : [];
  const layoutMatch = sameBank.find((c) => c.fileConfig?.fileType === meta.detect.fileType && String(c.fileConfig?.startRow) === String(meta.detect.startRow)) || null;
  const mappingExists = account ? (collections.bank_mapping || []).find((m) => m.type === "bank" && m.bankName === account.bankName && m.status === "active") : null;
  const connection = account ? (collections.bank_connections || []).find((b) => b.bankName === account.bankName && b.status !== "rejected") : null;

  return {
    fileName, meta, standard, preview, header,
    fileType: meta.detect.fileType, separator: meta.detect.separator || "", startRow: standard ? "" : String(meta.detect.startRow), startColumn: standard ? "" : String(meta.detect.startColumn),
    account, connection, layoutMatch, mappingExists,
    mapping: { fields, mappedCount: mapped.length, lowConf, ok: standard || (hasAmount && hasNarr && hasDate), keys },
    date: { sample: meta.dateSample, ambiguous: !standard && isAmbiguous(meta.dateSample) },
    balance: { present: hasBalance, mode: hasBalance ? "validate" : "compute" },
    status: { style: standard ? "standard" : meta.status?.style || "separate", note: standard ? "Standard format marks each entry C or D" : meta.status?.note, values: statusVals, unknown: unknownStatus },
    isStandard: isStandard(meta.detect.fileType),
  };
}
