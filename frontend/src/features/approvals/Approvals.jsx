// Approvals for Recon Ops and the functional manager: the same queue and review window as Central Setup's To do.
import React from "react";
import { useStore } from "@/state/store";
import { useApprovals } from "./useApprovals";
import ReviewQueue from "./ReviewQueue";
import DateRange, { todayRange } from "@/components/DateRange";

export default function Approvals() {
  const { currentUser } = useStore();
  const all = useApprovals();
  const [range, setRange] = React.useState(() => todayRange(false));
  return (
    <div className="inbox-page" data-testid="approvals-inbox">
      <div className="page-head"><div><h1>Approvals</h1></div><DateRange value={range} onChange={setRange} testid="ap-dates" /></div>
      <ReviewQueue items={all} range={range} />
      <p className="muted rq-foot">Signed in as {currentUser}. You can&apos;t approve anything you created.</p>
    </div>
  );
}
