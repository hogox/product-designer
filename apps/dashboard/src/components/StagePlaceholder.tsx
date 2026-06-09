// Página de etapa MOCKEADA: comunica la visión completa del pipeline mostrando el plan de
// la etapa (artefactos/secciones/gate planificados, del PRD). Etiquetada como mock.

import type { StageDef } from "../stages";

export function StagePlaceholder({ stage }: { stage: StageDef }) {
  return (
    <div className="panel">
      <h2>
        Etapa mockeada <span className="badge mock">mock</span>
      </h2>
      <div className="meta">
        Esta etapa todavía no está implementada (llega en Fase 3+). El motor
        real son por ahora Descubrimiento y Definición. Abajo, el plan de esta
        etapa según el PRD.
      </div>

      <div className="section">
        <h3>Artefactos y secciones planificados</h3>
        {stage.planned && stage.planned.length > 0 ? (
          <ul className="tight">
            {stage.planned.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        ) : (
          <p className="empty">Por definir.</p>
        )}
      </div>

      {stage.gate && (
        <div className="section">
          <h3>Compuerta al cierre</h3>
          <div>
            <span className="gate-tag">{stage.gate}</span>{" "}
            <span className="meta">
              (human-led; el agente propone, el humano aprueba)
            </span>
          </div>
        </div>
      )}

      <div className="section">
        <h3>Contrato de etapa (§8)</h3>
        <div className="meta">
          recolectar → extraer evidencia → derivar → validar (humano) →
          sintetizar → compuerta. El invariante de procedencia no cambia: toda
          afirmación cita su fuente.
        </div>
      </div>
    </div>
  );
}
