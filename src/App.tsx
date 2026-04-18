import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useAuth } from "./contexts/AuthContext";
import CrmLayout from "./components/layout/CrmLayout";
import LoginPage from "./pages/LoginPage";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const ContactsPage = lazy(() => import("./pages/contacts/ContactsPage"));
const ContactDetailPage = lazy(() => import("./pages/contacts/ContactDetailPage"));
const AccountsPage = lazy(() => import("./pages/accounts/AccountsPage"));
const PipelinePage = lazy(() => import("./pages/deals/PipelinePage"));
const DealDetailPage = lazy(() => import("./pages/deals/DealDetailPage"));
const TasksPage = lazy(() => import("./pages/tasks/TasksPage"));
const CalendarPage = lazy(() => import("./pages/calendar/CalendarPage"));
const ProductsPage = lazy(() => import("./pages/products/ProductsPage"));
const AutomationsPage = lazy(() => import("./pages/automations/AutomationsPage"));
const AutomationLogsPage = lazy(() => import("./pages/automations/AutomationLogsPage"));
const CampaignsPage = lazy(() => import("./pages/campaigns/CampaignsPage"));
const CampaignDetailPage = lazy(() => import("./pages/campaigns/CampaignDetailPage"));
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
        <Route element={<CrmLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/contacts/:id" element={<ContactDetailPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/pipeline/:id" element={<DealDetailPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/automations" element={<AutomationsPage />} />
          <Route path="/automations/logs" element={<AutomationLogsPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
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
