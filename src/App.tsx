import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useAuth } from "./contexts/AuthContext";
import CrmLayout from "./components/layout/CrmLayout";
import LoginPage from "./pages/LoginPage";

// Core
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AnalyticsPage = lazy(() => import("./pages/analytics/AnalyticsPage"));
const ContactsPage = lazy(() => import("./pages/contacts/ContactsPage"));
const ContactDetailPage = lazy(() => import("./pages/contacts/ContactDetailPage"));

// Sales
const PipelinePage = lazy(() => import("./pages/deals/PipelinePage"));
const DealDetailPage = lazy(() => import("./pages/deals/DealDetailPage"));

// Meetings
const MeetingsPage = lazy(() => import("./pages/meetings/MeetingsPage"));
const MeetingDetailPage = lazy(() => import("./pages/meetings/MeetingDetailPage"));

// Tasks & Calendar
const TasksPage = lazy(() => import("./pages/tasks/TasksPage"));
const CalendarPage = lazy(() => import("./pages/calendar/CalendarPage"));

// Students / Programs
const EnrollmentsPage = lazy(() => import("./pages/enrollments/EnrollmentsPage"));
const EnrollmentDetailPage = lazy(() => import("./pages/enrollments/EnrollmentDetailPage"));

// Contracts
const ContractsPage = lazy(() => import("./pages/contracts/ContractsPage"));
const ContractDetailPage = lazy(() => import("./pages/contracts/ContractDetailPage"));
const SignContractPage = lazy(() => import("./pages/contracts/SignContractPage"));

// Events & Finance
const EventsPage = lazy(() => import("./pages/events/EventsPage"));
const FinancePage = lazy(() => import("./pages/finance/FinancePage"));

// Campaigns (includes paid ads)
const CampaignsPage = lazy(() => import("./pages/campaigns/CampaignsPage"));
const CampaignDetailPage = lazy(() => import("./pages/campaigns/CampaignDetailPage"));
const AdsPage = lazy(() => import("./pages/ads/AdsPage"));

// Marketing
const ProductsPage = lazy(() => import("./pages/products/ProductsPage"));
const AutomationsPage = lazy(() => import("./pages/automations/AutomationsPage"));
const AutomationLogsPage = lazy(() => import("./pages/automations/AutomationLogsPage"));

// Settings
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));
const PipelineSettingsPage = lazy(() => import("./pages/settings/PipelineSettingsPage"));
const IntegrationSettingsPage = lazy(() => import("./pages/settings/IntegrationSettingsPage"));
const FormsPage = lazy(() => import("./pages/settings/FormsPage"));
const MigrationPage = lazy(() => import("./pages/settings/MigrationPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public: Contract signing (no layout/auth) */}
        <Route path="/sign/:token" element={<SignContractPage />} />

        {/* Authenticated routes */}
        <Route element={<CrmLayout />}>
          {/* Dashboard & Analytics */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/analytics" element={<AnalyticsPage />} />

          {/* Contacts */}
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/contacts/:id" element={<ContactDetailPage />} />

          {/* Sales Pipeline */}
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/pipeline/:id" element={<DealDetailPage />} />

          {/* Meetings */}
          <Route path="/meetings" element={<MeetingsPage />} />
          <Route path="/meetings/:id" element={<MeetingDetailPage />} />

          {/* Tasks & Calendar */}
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/calendar" element={<CalendarPage />} />

          {/* Students / Programs */}
          <Route path="/enrollments" element={<EnrollmentsPage />} />
          <Route path="/enrollments/:id" element={<EnrollmentDetailPage />} />

          {/* Contracts */}
          <Route path="/contracts" element={<ContractsPage />} />
          <Route path="/contracts/:id" element={<ContractDetailPage />} />

          {/* Events & Finance */}
          <Route path="/events" element={<EventsPage />} />
          <Route path="/finance" element={<FinancePage />} />

          {/* Campaigns (messaging + paid ads) */}
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="/campaigns/ads" element={<AdsPage />} />

          {/* Automations & Products */}
          <Route path="/automations" element={<AutomationsPage />} />
          <Route path="/automations/logs" element={<AutomationLogsPage />} />
          <Route path="/products" element={<ProductsPage />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/pipelines" element={<PipelineSettingsPage />} />
          <Route path="/settings/integrations" element={<IntegrationSettingsPage />} />
          <Route path="/settings/forms" element={<FormsPage />} />
          <Route path="/settings/migration" element={<MigrationPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
