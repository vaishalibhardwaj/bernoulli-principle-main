import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import BankConfigLanding from "@/features/bankConfig/BankConfigLanding";
import BankConfigWizard from "@/features/bankConfig/BankConfigWizard";
import CreditMisLanding from "@/features/creditMis/CreditMisLanding";
import CreditMisWizard from "@/features/creditMis/CreditMisWizard";
import MappingEditor from "@/features/mapping/MappingEditor";
import AuditHistory from "@/features/audit/AuditHistory";
import UserManagement from "@/features/admin/UserManagement";
import RolesAccess from "@/features/admin/RolesAccess";
import Cutoffs from "@/features/cutoffs/Cutoffs";
import ClosingBalances from "@/features/dashboards/ClosingBalances";
import SchedulerMonitor from "@/features/dashboards/SchedulerMonitor";
import FileUpload from "@/features/upload/FileUpload";
import NoActionReview from "@/features/today/NoActionReview";
import CommandCentre from "@/features/command/CommandCentre";
import FileInbox from "@/features/ingestion/FileInbox";
import MatchWorkbench from "@/features/match/MatchWorkbench";
import Exceptions from "@/features/exceptions/Exceptions";
import DocumentExtraction from "@/features/extraction/DocumentExtraction";
import ModulePlaceholder from "@/features/modules/ModulePlaceholder";
import Today from "@/features/today/Today";
import Approvals from "@/features/approvals/Approvals";
import SetupTodo from "@/features/setup/SetupTodo";
import BankProfile, { BankRules } from "@/features/bankConfig/BankProfile";
import AggregatorProfile from "@/features/creditMis/AggregatorProfile";
import FundRelease from "@/features/release/FundRelease";
import Refunds from "@/features/refunds/Refunds";
import { useStore } from "@/state/store";
import { homePath, hasCap } from "@/lib/access";

/** "Setup approvals" was merged into Approvals: checkers go there; makers see their pending setups. */
function SetupApprovalsRedirect() {
  const { perms } = useStore();
  return <Navigate to={hasCap(perms, "setup_approvals", "approve") ? "/setup-todo?tab=approve" : hasCap(perms, "inbox", "approve") ? "/approvals?kind=Bank%20setup" : "/bank-setup?status=pending"} replace />;
}

/** Old Recon setup menus now live inside a bank / aggregator page or in To do; old links land in the right place. */
function MappingRedirect() {
  const [sp] = useSearchParams();
  return <Navigate to={sp.get("tab") === "credit" ? "/credit-mis?view=columns" : "/bank-setup?view=columns"} replace />;
}

function HomeRedirect() {
  const { perms, simple } = useStore();
  return <Navigate to={homePath(perms, simple)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/roles" element={<RolesAccess />} />
          <Route path="/status-standardisation" element={<Navigate to="/bank-setup?view=codes" replace />} />
          <Route path="/admin/status-standardisation" element={<Navigate to="/bank-setup?view=codes" replace />} />
          <Route path="/today" element={<Today />} />
          <Route path="/my-work" element={<Navigate to="/today" replace />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/setup-todo" element={<SetupTodo />} />
          <Route path="/setup-approvals" element={<Navigate to="/setup-todo?tab=approve" replace />} />
          <Route path="/setup-tasks" element={<Navigate to="/setup-todo?tab=requests" replace />} />
          <Route path="/setup-scheduler" element={<SchedulerMonitor />} />
          <Route path="/release" element={<FundRelease />} />
          <Route path="/refunds" element={<Refunds />} />
          <Route path="/reports" element={<HomeRedirect />} />
          <Route path="/command" element={<CommandCentre />} />
          <Route path="/ingestion" element={<FileInbox />} />
          <Route path="/rules" element={<HomeRedirect />} />
          <Route path="/match" element={<MatchWorkbench />} />
          <Route path="/exceptions" element={<Exceptions />} />
          <Route path="/extraction" element={<DocumentExtraction />} />
          <Route path="/dashboard" element={<SetupApprovalsRedirect />} />
          <Route path="/bank-setup" element={<BankConfigLanding />} />
          <Route path="/bank-setup/rules" element={<BankRules />} />
          <Route path="/bank-setup/bank/:name" element={<BankProfile />} />
          <Route path="/bank-setup/:mode/:id" element={<BankConfigWizard />} />
          <Route path="/bank-setup/new" element={<BankConfigWizard />} />
          <Route path="/credit-mis" element={<CreditMisLanding />} />
          <Route path="/credit-mis/pa/:code" element={<AggregatorProfile />} />
          <Route path="/credit-mis/:mode/:id" element={<CreditMisWizard />} />
          <Route path="/credit-mis/new" element={<CreditMisWizard />} />
          <Route path="/mapping" element={<MappingRedirect />} />
          <Route path="/mapping/:type/:id" element={<MappingEditor />} />
          <Route path="/audit" element={<AuditHistory />} />
          <Route path="/cutoffs" element={<Cutoffs />} />
          <Route path="/narration-tags" element={<Navigate to="/bank-setup?view=tags" replace />} />
          <Route path="/closing-balances" element={<ClosingBalances />} />
          <Route path="/scheduler" element={<SchedulerMonitor />} />
          <Route path="/upload" element={<FileUpload />} />
          <Route path="/no-action-review" element={<NoActionReview />} />
          <Route path="/m/:module/:screen" element={<ModulePlaceholder />} />
          <Route path="*" element={<HomeRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
