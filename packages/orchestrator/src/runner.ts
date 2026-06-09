// Runners reales de las dos etapas del diamante Problema.
// Descubrimiento = pipeline del Agente 1 (recolectar→extraer→computar→derivar → hallazgos).
// Definición = Agente 2 (hallazgos validados → problem statement + JTBD + métricas).

import type { Evidence, Finding, Spec } from "@pda/spec";
import {
  ingestDir,
  ingestCsv,
  extractTextEvidence,
  createAnthropicProposer,
  computeFunnelMetrics,
  metricToEvidence,
  buildEvidencePool,
  deriveFindings,
  createAnthropicFindingsProposer,
} from "@pda/agent1";
import { defineProblem, createAnthropicDefiner } from "@pda/agent2";

import type { DiscoveryRunner, DefinitionRunner } from "./stage.js";

export interface DiscoveryRunnerOptions {
  entrevistasDir: string;
  funnelCsv: string;
  topic: string;
}

export function createDiscoveryRunner(
  opts: DiscoveryRunnerOptions,
): DiscoveryRunner {
  return {
    async run(_current: Spec) {
      const evidence: Evidence[] = [];

      // cualitativo: citas verificadas de cada entrevista
      const proposer = createAnthropicProposer();
      for (const doc of await ingestDir(opts.entrevistasDir)) {
        if (doc.kind !== "text") continue;
        const { accepted } = await extractTextEvidence(doc, {
          topic: opts.topic,
          proposer,
        });
        evidence.push(...accepted);
      }

      // cuantitativo: métricas computadas del funnel
      const funnel = await ingestCsv(opts.funnelCsv);
      evidence.push(
        ...computeFunnelMetrics(funnel).slice(0, 4).map(metricToEvidence),
      );

      const pool = buildEvidencePool(evidence);
      const { accepted: findings } = await deriveFindings(pool, {
        topic: opts.topic,
        proposer: createAnthropicFindingsProposer(),
      });
      return { findings };
    },
  };
}

export function createDefinitionRunner(opts: {
  topic: string;
}): DefinitionRunner {
  return {
    async run(current: Spec, findings: Finding[]) {
      const { proposed } = await defineProblem(current, findings, {
        topic: opts.topic,
        definer: createAnthropicDefiner(),
      });
      return { proposed };
    },
  };
}
