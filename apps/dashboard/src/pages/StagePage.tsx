import { Navigate, useParams } from "react-router-dom";

import { findStage, type StageDef } from "../stages";
import { specPath } from "../nav";
import { SectionTabs } from "../components/SectionTabs";
import { FindingsTriage } from "../components/FindingsTriage";
import { EvidenceList } from "../components/EvidenceList";
import { VerificationPanel } from "../components/VerificationPanel";
import { GatePanel } from "../components/GatePanel";
import { Framing } from "../components/Framing";
import { Jtbd } from "../components/Jtbd";
import { Metrics } from "../components/Metrics";
import { StagePlaceholder } from "../components/StagePlaceholder";
import { ConceptsTriage } from "../components/ConceptsTriage";
import { RealMockBadge } from "../components/badges";
import { STAGE_ICON } from "../components/icons";
import { useShell } from "../App";
import { discoveryVerification, type SpecData } from "../api";

/** /spec/:specId/etapa/:stageId → redirige a la primera sección. */
export function StageIndexRedirect() {
  const { specId, stageId } = useParams();
  const stage = findStage(stageId);
  if (!stage) return <Navigate to={specPath(specId)} replace />;
  return (
    <Navigate
      to={specPath(specId, `/etapa/${stage.id}/${stage.sections[0]!.id}`)}
      replace
    />
  );
}

export function StagePage() {
  const { specId, stageId, sectionId } = useParams();
  const stage = findStage(stageId);
  const shell = useShell();
  if (!stage) return <Navigate to={specPath(specId)} replace />;

  const StageIcon = STAGE_ICON[stage.id];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <span
          className={`relative flex size-12 shrink-0 items-center justify-center rounded-xl text-lg font-semibold ${
            stage.real
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {stage.n}
          {StageIcon && (
            <span className="absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-lg border bg-card text-foreground">
              <StageIcon className="size-3.5" />
            </span>
          )}
        </span>
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
            {stage.name}
            <RealMockBadge real={stage.real} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {stage.diamante} · {stage.modo}
            {stage.gate ? ` · gate: ${stage.gate}` : ""}
          </p>
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
          jtbd={(shell.proposed ?? shell.spec)?.jtbd ?? []}
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
        <p className="text-sm text-muted-foreground italic">Cargando spec…</p>
      );
    if (section === "enmarcado")
      return (
        <Framing shown={shown} current={shell.spec} isProposal={isProposal} />
      );
    if (section === "jtbd") return <Jtbd shown={shown} />;
    if (section === "metricas") return <Metrics shown={shown} />;
    if (section === "compuerta")
      return (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
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

  if (stage.id === "exploracion") {
    if (section === "conceptos")
      return (
        <ConceptsTriage
          specId={shell.specId}
          concepts={shell.concepts}
          jobs={shell.spec?.jtbd ?? []}
          onChange={shell.refetch}
        />
      );
  }

  // Etapas mockeadas (D.5): pendiente.
  return (
    <p className="text-sm text-muted-foreground">
      Sección <strong>{section}</strong> — próximo paso.
    </p>
  );
}
