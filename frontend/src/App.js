import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import BankConfigLanding from "@/features/bankConfig/BankConfigLanding";
import BankConfigWizard from "@/features/bankConfig/BankConfigWizard";
import QuickSetup from "@/features/bankConfig/QuickSetup";
import CreditMisLanding from "@/features/creditMis/CreditMisLanding";
import CreditMisWizard from "@/features/creditMis/CreditMisWizard";
import MappingSummary from "@/features/mapping/MappingSummary";
import MappingEditor from "@/features/mapping/MappingEditor";
import AuditHistory from "@/features/audit/AuditHistory";
import UserManagement from "@/features/admin/UserManagement";
import RolesAccess from "@/features/admin/RolesAccess";
import StatusStandardisation from "@/features/admin/StatusStandardisation";
import Cutoffs from "@/features/cutoffs/Cutoffs";
import NarrationTags from "@/features/narration/NarrationTags";
import ClosingBalances from "@/features/dashboards/ClosingBalances";
import SchedulerMonitor from "@/features/dashboards/SchedulerMonitor";
import CommandCentre from "@/features/command/CommandCentre";
import FileInbox from "@/features/ingestion/FileInbox";
import MatchRules from "@/features/rules/MatchRules";
import MatchWorkbench from "@/features/match/MatchWorkbench";
import Exceptions from "@/features/exceptions/Exceptions";
import DocumentExtraction from "@/features/extraction/DocumentExtraction";
import ModulePlaceholder from "@/features/modules/ModulePlaceholder";
import Today from "@/features/today/Today";
import Approvals from "@/features/approvals/Approvals";
import FundRelease from "@/features/release/FundRelease";
import Refunds from "@/features/refunds/Refunds";
import Reports from "@/features/reports/Reports";
import { useStore } from "@/state/store";
import { homePath, hasCap } from "@/lib/access";

/** "Setup approvals" was merged into Approvals: checkers go there; makers see their pending setups. */
function SetupApprovalsRedirect() {
  const { perms } = useStore();
  return <Navigate to={hasCap(perms, "inbox", "approve") ? "/approvals?kind=Bank%20setup" : "/bank-setup?status=pending"} replace />;
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
          <Route path="/admin/status-standardisation" element={<StatusStandardisation />} />
          <Route path="/today" element={<Today />} />
          <Route path="/my-work" element={<Navigate to="/today" replace />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/release" element={<FundRelease />} />
          <Route path="/refunds" element={<Refunds />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/command" element={<CommandCentre />} />
          <Route path="/ingestion" element={<FileInbox />} />
          <Route path="/rules" element={<MatchRules />} />
          <Route path="/match" element={<MatchWorkbench />} />
          <Route path="/exceptions" element={<Exceptions />} />
          <Route path="/extraction" element={<DocumentExtraction />} />
          <Route path="/dashboard" element={<SetupApprovalsRedirect />} />
          <Route path="/bank-setup" element={<BankConfigLanding />} />
          <Route path="/bank-setup/:mode/:id" element={<BankConfigWizard />} />
          <Route path="/bank-setup/new" element={<QuickSetup />} />
          <Route path="/bank-setup/new/manual" element={<BankConfigWizard />} />
          <Route path="/credit-mis" element={<CreditMisLanding />} />
          <Route path="/credit-mis/:mode/:id" element={<CreditMisWizard />} />
          <Route path="/credit-mis/new" element={<CreditMisWizard />} />
          <Route path="/mapping" element={<MappingSummary />} />
          <Route path="/mapping/:type/:id" element={<MappingEditor />} />
          <Route path="/audit" element={<AuditHistory />} />
          <Route path="/cutoffs" element={<Cutoffs />} />
          <Route path="/narration-tags" element={<NarrationTags />} />
          <Route path="/closing-balances" element={<ClosingBalances />} />
          <Route path="/scheduler" element={<SchedulerMonitor />} />
          <Route path="/m/:module/:screen" element={<ModulePlaceholder />} />
          <Route path="*" element={<HomeRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
