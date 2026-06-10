import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { TooltipProvider } from "@/components/ui/tooltip";
import { App } from "./App";
import { SpecsHomePage } from "./pages/SpecsHomePage";
import { OverviewPage } from "./pages/OverviewPage";
import { StagePage, StageIndexRedirect } from "./pages/StagePage";
import { SourcesPage } from "./pages/SourcesPage";
import { AuditPage } from "./pages/AuditPage";
import "./globals.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          {/* Home: "Mis specs" (sin spec activa → sin sidebar de etapas) */}
          <Route path="/" element={<SpecsHomePage />} />
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
    </TooltipProvider>
  </StrictMode>,
);
