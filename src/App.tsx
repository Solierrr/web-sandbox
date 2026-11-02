import { Suspense, lazy, useSyncExternalStore } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Loading, SaaSLayout, Toast } from "@solaria.network/web-lib";
import {
  getSession,
  logout,
  subscribe,
} from "./features/access/access.service";
import LoginPage from "./features/access/pages/LoginPage";
import CatalogPage from "./features/catalog/pages/CatalogPage";

const KeepalivePage = lazy(() => import("./features/keepalive/pages/KeepalivePage"));
const SimulatorPage = lazy(() => import("./features/ai/pages/SimulatorPage"));
const PlaygroundPage = lazy(() => import("./features/ai/pages/PlaygroundPage"));
const ConversationsPage = lazy(() => import("./features/ai/pages/ConversationsPage"));
const ConversationPage = lazy(() => import("./features/ai/pages/ConversationPage"));
const DashboardsPage = lazy(() => import("./features/ai/pages/DashboardsPage"));

function Portal() {
  const session = useSyncExternalStore(subscribe, getSession);
  if (!session) return <LoginPage />;
  return (
    <SaaSLayout
      title="Sandbox"
      identity={session.email}
      onSignOut={() => void logout()}
      groups={[
        {
          title: "Ambiente",
          items: [
            { to: "/", label: "Catálogo", icon: "home" },
            { to: "/keepalive", label: "Keepalive", icon: "refresh" },
          ],
        },
        {
          title: "Fluxo de IA",
          items: [
            { to: "/ia/simulador", label: "Simulador", icon: "sparkles" },
            { to: "/ia/conversas", label: "Conversas", icon: "messages" },
            { to: "/ia/dashboards", label: "Dashboards", icon: "chart" },
          ],
        },
      ]}
    >
      <Suspense fallback={<Loading label="Carregando…" />}>
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/keepalive" element={<KeepalivePage />} />
          <Route path="/ia" element={<Navigate to="/ia/simulador" replace />} />
          <Route path="/ia/simulador" element={<SimulatorPage />} />
          <Route path="/ia/playground" element={<PlaygroundPage />} />
          <Route path="/ia/conversas" element={<ConversationsPage />} />
          <Route path="/ia/conversas/:sessionId" element={<ConversationPage />} />
          <Route path="/ia/dashboards" element={<DashboardsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </SaaSLayout>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <Portal />
      <Toast />
    </BrowserRouter>
  );
}
