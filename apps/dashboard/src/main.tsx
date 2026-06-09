import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { App } from "./App";
import { OverviewPage } from "./pages/OverviewPage";
import { StagePage, StageIndexRedirect } from "./pages/StagePage";
import { AuditPage } from "./pages/AuditPage";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<OverviewPage />} />
          <Route path="etapa/:stageId" element={<StageIndexRedirect />} />
          <Route path="etapa/:stageId/:sectionId" element={<StagePage />} />
          <Route path="auditoria" element={<AuditPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
