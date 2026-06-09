import { useShell } from "../App";

export function OverviewPage() {
  const { spec } = useShell();
  return (
    <div className="panel">
      <h2>Spec viva</h2>
      {spec ? (
        <div>
          <div className="spec-title">{spec.title}</div>
          <div className="meta">
            {spec.id} · v{spec.version} · {spec.status} · etapa{" "}
            {spec.current_stage}
          </div>
          <p className="meta">(Overview holístico — se completa en D.2)</p>
        </div>
      ) : (
        <p className="empty">Cargando spec…</p>
      )}
    </div>
  );
}
