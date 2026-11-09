// Old links to a separate bank page or to "Rules for every bank" land on Bank statements:
// a bank's accounts open in place; column mapping, transaction type mapping and narration tags are views at the top.
import React from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";

const VIEW = { columns: "columns", codes: "codes", tags: "tags" };

export default function BankProfile() {
  const { name } = useParams();
  const [sp] = useSearchParams();
  const view = VIEW[sp.get("tab")];
  return <Navigate to={view ? `/bank-setup?view=${view}` : `/bank-setup?${new URLSearchParams({ open: decodeURIComponent(name) })}`} replace />;
}

export function BankRules() {
  const [sp] = useSearchParams();
  return <Navigate to={`/bank-setup?view=${sp.get("tab") === "tags" ? "tags" : "codes"}`} replace />;
}
