import { Suspense, lazy, useEffect, useState, useSyncExternalStore } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Loading, SaaSLayout, Toast, WhiteButton, notify } from "@solaria.network/web-lib";
import {
  getSession,
  logout,
  subscribe,
  restoreSession,
} from "./features/access/access.service";
import LoginPage from "./features/access/pages/LoginPage";
import CatalogPage from "./features/catalog/pages/CatalogPage";

const KeepalivePage = lazy(() => import("./features/keepalive/pages/KeepalivePage"));
// Tela do fluxo de IA: reservada, será implementada por outra pessoa.
// const AiFlowPage = lazy(() => import("./features/ai/pages/AiFlowPage"));

function Portal() {
  const session = useSyncExternalStore(subscribe, getSession);
  const [restoring, setRestoring] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void restoreSession().catch(() => { if (active) setRestoreFailed(true); }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [attempt]);
  if (restoring) return <Loading label="Restaurando sessão…" />;
  if (restoreFailed) return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
    <p role="alert">Não foi possível restaurar sua sessão agora. Tente novamente quando o serviço responder.</p>
    <WhiteButton content="Tentar novamente" description="Restaurar a sessão salva" onClick={() => { setRestoreFailed(false); setRestoring(true); setAttempt(value => value + 1); }} />
  </main>;
  if (!session) return <LoginPage />;
  return (
    <SaaSLayout
      title="Sandbox"
      identity={session.email}
      onSignOut={() => void logout().catch(() => notify("Você saiu deste navegador, mas não foi possível confirmar a saída no servidor. Tente novamente quando a conexão voltar."))}
      groups={[
        {
          title: "Ambiente",
          items: [
            { to: "/", label: "Catálogo", icon: "home" },
            { to: "/keepalive", label: "Keepalive", icon: "refresh" },
            // { to: "/ia", label: "Fluxo de IA", icon: "sparkles" },
          ],
        },
      ]}
    >
      <Suspense fallback={<Loading label="Carregando…" />}>
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/keepalive" element={<KeepalivePage />} />
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
