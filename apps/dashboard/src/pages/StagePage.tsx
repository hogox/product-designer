import { Navigate, useParams } from "react-router-dom";

import { findStage } from "../stages";
import { SectionTabs } from "../components/SectionTabs";

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

      <div className="panel">
        <p className="meta">
          Sección: <strong>{sectionId}</strong> — contenido en D.3–D.5.
        </p>
      </div>
    </div>
  );
}
