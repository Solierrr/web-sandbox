import { Suspense, lazy, useSyncExternalStore } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import { OperationalPage, SaaSLayout, Toast } from "@solaria.network/web-lib";
import {
  getSession,
  logout,
  subscribe,
} from "./features/access/access.service";
import LoginPage from "./features/access/pages/LoginPage";
import RepositoriesPage from "./features/repositories/pages/RepositoriesPage";
import ServicePage from "./features/services/pages/ServicePage";
import { services } from "./config/services";
import { apis, findApi } from "./config/apis";

const DocsOverviewPage = lazy(() => import("./features/docs/pages/DocsOverviewPage"));
const ApiDocsPage = lazy(() => import("./features/docs/pages/ApiDocsPage"));
const DevicesPage = lazy(() => import("./features/devices/pages/DevicesPage"));

function ServiceRoute() {
  const { serviceId } = useParams();
  const service = services.find((item) => item.id === serviceId);
  return service ? (
    <ServicePage key={service.id} service={service} />
  ) : (
    <OperationalPage
      title="Página não encontrada"
      description="Oops… Parece que essa página não existe…"
      centered
      sideBackground
    />
  );
}
function DocsRoute() {
  const { apiId } = useParams();
  const api = findApi(apiId);
  return api ? (
    <ApiDocsPage key={api.id} api={api} />
  ) : (
    <Navigate to="/docs" replace />
  );
}
function Portal() {
  const session = useSyncExternalStore(subscribe, getSession);
  if (!session) return <LoginPage />;
  return (
    <SaaSLayout
      title="Sandbox"
      identity={session.email}
      badge={
        <span className="rounded-medium bg-operational-surface px-2 py-1 text-xs">
          QA
        </span>
      }
      onSignOut={() => void logout()}
      groups={[
        {
          title: "Ambiente",
          items: [
            { to: "/", label: "Atalhos", icon: "home" },
            { to: "/devices", label: "Dispositivos QA", icon: "settings" as const },
          ],
        },
        {
          title: "Documentação",
          items: [
            { to: "/docs", label: "Todas as APIs", icon: "document" as const },
            ...apis.map((api) => ({
              to: `/docs/${api.id}`,
              label: api.id,
              icon: "document" as const,
            })),
          ],
        },
        {
          title: "Serviços",
          items: services.map((service) => ({
            to: `/services/${service.id}`,
            label: service.id,
            icon:
              service.kind === "chat"
                ? "sparkles"
                : service.kind === "messenger"
                  ? "messages"
                  : "settings",
          })),
        },
      ]}
    >
      <Suspense fallback={<p role="status" className="p-6">Carregando…</p>}>
      <Routes>
        <Route path="/" element={<RepositoriesPage />} />
        <Route path="/services/:serviceId" element={<ServiceRoute />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/docs" element={<DocsOverviewPage />} />
        <Route path="/docs/:apiId" element={<DocsRoute />} />
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
