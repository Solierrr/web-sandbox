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
const DocumentationPage = lazy(() => import("./features/documentation/DocumentationPage"));
// Tela do fluxo de IA: reservada, será implementada por outra pessoa.
// const AiFlowPage = lazy(() => import("./features/ai/pages/AiFlowPage"));

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
            { to: "/docs", label: "Documentação", icon: "book" },
            // { to: "/ia", label: "Fluxo de IA", icon: "sparkles" },
          ],
        },
      ]}
    >
      <Suspense fallback={<Loading label="Carregando…" />}>
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/keepalive" element={<KeepalivePage />} />
          <Route path="/docs" element={<DocumentationPage />} />
          <Route path="/docs/:id" element={<DocumentationPage />} />
          {/* <Route path="/ia" element={<AiFlowPage />} /> */}
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
