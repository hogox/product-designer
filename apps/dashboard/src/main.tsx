import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider, useSession } from "./session";
import { App } from "./App";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SpecsHomePage } from "./pages/SpecsHomePage";
import { OverviewPage } from "./pages/OverviewPage";
import { StagePage, StageIndexRedirect } from "./pages/StagePage";
import { SourcesPage } from "./pages/SourcesPage";
import { AuditPage } from "./pages/AuditPage";
import "./globals.css";

// Gate de sesión (W5): sin usuario → login mock; con usuario → la app. El login no necesita
// router (no hay rutas dentro). La identidad firma la auditoría (lo único real de W5).
function AppGate() {
  const { user } = useSession();
  if (!user) return <LoginPage />;
  return (
    <BrowserRouter>
      <Routes>
        {/* Home: "Mis specs" (sin spec activa → sin sidebar de etapas) */}
        <Route path="/" element={<SpecsHomePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* Toda spec cuelga de /spec/:specId (D2 · W0.3): la URL aísla el contexto */}
        <Route path="/spec/:specId" element={<App />}>
          <Route index element={<OverviewPage />} />
          <Route path="fuentes" element={<SourcesPage />} />
          <Route path="etapa/:stageId" element={<StageIndexRedirect />} />
          <Route path="etapa/:stageId/:sectionId" element={<StagePage />} />
          <Route path="auditoria" element={<AuditPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <TooltipProvider>
        <AppGate />
      </TooltipProvider>
    </SessionProvider>
  </StrictMode>,
);
