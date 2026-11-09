// Old aggregator-page links land on Credit MIS: feeds open in place; column mapping and transaction type mapping are views at the top.
import React from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";

export default function AggregatorProfile() {
  const { code } = useParams();
  const [sp] = useSearchParams();
  const view = { columns: "columns", codes: "codes" }[sp.get("tab")];
  return <Navigate to={view ? `/credit-mis?view=${view}` : `/credit-mis?${new URLSearchParams({ open: decodeURIComponent(code) })}`} replace />;
}
