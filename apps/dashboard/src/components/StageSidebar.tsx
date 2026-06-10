import { Link, NavLink, useNavigate } from "react-router-dom";
import type { Spec } from "@pda/spec";

import { STAGES } from "../stages";
import { specPath } from "../nav";
import type { StageState, SpecGroup } from "../api";

const navCls = ({ isActive }: { isActive: boolean }) =>
  `nav-item${isActive ? " active" : ""}`;

export function StageSidebar({
  specId,
  groups,
  spec,
  state,
}: {
  specId: string | null;
  groups: SpecGroup[];
  spec: Spec | null;
  state: StageState | null;
}) {
  const navigate = useNavigate();

  // Switcher: specs activas del MISMO producto que la spec actual (D2 · W0.4).
  const product = spec?.product;
  const sameProduct =
    product != null
      ? (groups.find((g) => g.product === product)?.specs ?? []).filter(
          (s) => s.status === "activa",
        )
      : [];

  return (
    <aside className="sidebar">
      <div className="brand">
        <Link to="/" className="brand-link">
          Product Designer Agéntico
        </Link>
      </div>

      <div className="spec-switcher">
        {sameProduct.length > 1 && (
          <select
            value={specId ?? ""}
            onChange={(e) => navigate(specPath(e.target.value))}
            aria-label={`Specs de ${product}`}
          >
            {sameProduct.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <Link to="/" className="switcher-all">
          Ver todas las specs
        </Link>
      </div>

      {spec && (
        <div className="spec-meta-box">
          <div className="meta" style={{ marginBottom: 4 }}>
            {spec.product}
          </div>
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
        <NavLink to={specPath(specId)} end className={navCls}>
          <span className="nm">Spec viva</span>
        </NavLink>

        <div className="nav-group">Pipeline (7 etapas)</div>
        {STAGES.map((s) => (
          <NavLink
            key={s.id}
            to={specPath(specId, `/etapa/${s.id}`)}
            className={navCls}
          >
            <span className="num">{s.n}</span>
            <span className="nm">{s.name}</span>
            <span className={`badge ${s.real ? "real" : "mock"}`}>
              {s.real ? "real" : "mock"}
            </span>
          </NavLink>
        ))}

        <div className="nav-group">Trazabilidad</div>
        <NavLink to={specPath(specId, "/auditoria")} className={navCls}>
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
