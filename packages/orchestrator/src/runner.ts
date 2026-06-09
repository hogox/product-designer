// Runner real de la etapa de Descubrimiento: compone el pipeline del Agente 1
// (recolectar → extraer → computar → derivar → sintetizar) en un DiscoveryRunner.

import type { Evidence, Spec } from "@pda/spec";
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
  synthesizeProposal,
  createAnthropicSynthesizer,
} from "@pda/agent1";

import type { DiscoveryRunner } from "./stage.js";

export interface Agent1RunnerOptions {
  entrevistasDir: string;
  funnelCsv: string;
  topic: string;
}

export function createAgent1Runner(opts: Agent1RunnerOptions): DiscoveryRunner {
  return {
    async run(current: Spec) {
      const evidence: Evidence[] = [];

      // evidencia cualitativa: citas verificadas de cada entrevista
      const proposer = createAnthropicProposer();
      for (const doc of await ingestDir(opts.entrevistasDir)) {
        if (doc.kind !== "text") continue;
        const { accepted } = await extractTextEvidence(doc, {
          topic: opts.topic,
          proposer,
        });
        evidence.push(...accepted);
      }

      // evidencia cuantitativa: métricas computadas del funnel
      const funnel = await ingestCsv(opts.funnelCsv);
      evidence.push(
        ...computeFunnelMetrics(funnel).slice(0, 4).map(metricToEvidence),
      );

      // derivar hallazgos (solo desde el pool) → sintetizar propuesta
      const pool = buildEvidencePool(evidence);
      const { accepted: findings } = await deriveFindings(pool, {
        topic: opts.topic,
        proposer: createAnthropicFindingsProposer(),
      });
      const proposed = await synthesizeProposal(current, findings, {
        topic: opts.topic,
        synthesizer: createAnthropicSynthesizer(),
      });

      return { findings: proposed.findings, proposed };
    },
  };
}
