import { NavLink } from "react-router-dom";
import type { Spec } from "@pda/spec";

import { STAGES } from "../stages";
import type { StageState } from "../api";

const navCls = ({ isActive }: { isActive: boolean }) =>
  `nav-item${isActive ? " active" : ""}`;

export function StageSidebar({
  specs,
  specId,
  onSelect,
  spec,
  state,
}: {
  specs: string[];
  specId: string | null;
  onSelect: (id: string) => void;
  spec: Spec | null;
  state: StageState | null;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">Product Designer Agéntico</div>

      {specs.length > 1 && (
        <select value={specId ?? ""} onChange={(e) => onSelect(e.target.value)}>
          {specs.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}

      {spec && (
        <div className="spec-meta-box">
          <div className="spec-meta">
            <span className="pill">{spec.id}</span>
            <span className="pill">v{spec.version}</span>
            <span className="pill">{spec.status}</span>
          </div>
          <div className="meta" style={{ marginTop: 4 }}>
            etapa: {spec.current_stage}
            {state?.hasProposal ? " · propuesta pendiente" : ""}
          </div>
        </div>
      )}

      <nav>
        <NavLink to="/" end className={navCls}>
          <span className="nm">Spec viva</span>
        </NavLink>

        <div className="nav-group">Pipeline (7 etapas)</div>
        {STAGES.map((s) => (
          <NavLink key={s.id} to={`/etapa/${s.id}`} className={navCls}>
            <span className="num">{s.n}</span>
            <span className="nm">{s.name}</span>
            <span className={`badge ${s.real ? "real" : "mock"}`}>
              {s.real ? "real" : "mock"}
            </span>
          </NavLink>
        ))}

        <div className="nav-group">Trazabilidad</div>
        <NavLink to="/auditoria" className={navCls}>
          <span className="nm">Auditoría</span>
        </NavLink>
      </nav>

      <div className="legend" style={{ marginTop: 16, padding: "0 8px" }}>
        <span>
          <span className="dot real" /> real
        </span>
        <span>
          <span className="dot mock" /> mockeado
        </span>
      </div>
    </aside>
  );
}
