import { Navigate, useParams } from "react-router-dom";

import { findStage, type StageDef } from "../stages";
import { SectionTabs } from "../components/SectionTabs";
import { FindingsTriage } from "../components/FindingsTriage";
import { EvidenceList } from "../components/EvidenceList";
import { VerificationPanel } from "../components/VerificationPanel";
import { GatePanel } from "../components/GatePanel";
import { Framing } from "../components/Framing";
import { Jtbd } from "../components/Jtbd";
import { Metrics } from "../components/Metrics";
import { StagePlaceholder } from "../components/StagePlaceholder";
import { useShell } from "../App";
import { discoveryVerification, type SpecData } from "../api";

/** /etapa/:stageId → redirige a la primera sección. */
export function StageIndexRedirect() {
  const { stageId } = useParams();
  const stage = findStage(stageId);
  if (!stage) return <Navigate to="/" replace />;
  return (
    <Navigate to={`/etapa/${stage.id}/${stage.sections[0]!.id}`} replace />
  );
}

export function StagePage() {
  const { stageId, sectionId } = useParams();
  const stage = findStage(stageId);
  const shell = useShell();
  if (!stage) return <Navigate to="/" replace />;

  return (
    <div>
      <div className="stage-head">
        <h1>
          {stage.n}. {stage.name}{" "}
          <span className={`badge ${stage.real ? "real" : "mock"}`}>
            {stage.real ? "real" : "mock"}
          </span>
        </h1>
        <div className="meta">
          {stage.diamante} · {stage.modo}
          {stage.gate ? ` · gate: ${stage.gate}` : ""}
        </div>
      </div>

      <SectionTabs stageId={stage.id} sections={stage.sections} />

      <StageContent stage={stage} section={sectionId} shell={shell} />
    </div>
  );
}

function StageContent({
  stage,
  section,
  shell,
}: {
  stage: StageDef;
  section: string | undefined;
  shell: SpecData;
}) {
  if (!stage.real) return <StagePlaceholder stage={stage} />;

  if (stage.id === "descubrimiento") {
    if (section === "hallazgos")
      return (
        <FindingsTriage
          specId={shell.specId}
          findings={shell.findings}
          onChange={shell.refetch}
        />
      );
    if (section === "evidencia")
      return <EvidenceList findings={shell.findings} />;
    if (section === "verificacion")
      return (
        <VerificationPanel
          criteria={discoveryVerification(shell.findings)}
          title="Verificación de Descubrimiento"
        />
      );
  }

  if (stage.id === "definicion") {
    const isProposal = shell.proposed !== null;
    const shown = shell.proposed ?? shell.spec;
    if (!shown)
      return (
        <div className="panel">
          <p className="empty">Cargando spec…</p>
        </div>
      );
    if (section === "enmarcado")
      return (
        <Framing shown={shown} current={shell.spec} isProposal={isProposal} />
      );
    if (section === "jtbd") return <Jtbd shown={shown} />;
    if (section === "metricas") return <Metrics shown={shown} />;
    if (section === "compuerta")
      return (
        <div className="layout">
          <GatePanel
            specId={shell.specId}
            proposed={shell.proposed}
            gateName="enmarcar"
            onChange={shell.refetch}
          />
          <VerificationPanel
            criteria={shown.verification}
            title="Verificación de la propuesta"
          />
        </div>
      );
  }

  // Etapas mockeadas (D.5): pendiente.
  return (
    <div className="panel">
      <p className="meta">
        Sección <strong>{section}</strong> — próximo paso.
      </p>
    </div>
  );
}
