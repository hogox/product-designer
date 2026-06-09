#!/usr/bin/env node
// CLI del orquestador. Esqueleto del paso 0.1; los subcomandos (`run`) llegan en el paso 1.7.

const [, , command] = process.argv;

if (!command) {
  console.log("orchestrator — orquestador mínimo (v0)");
  console.log(
    "Uso: orchestrator <comando>   (subcomandos: pendiente — paso 1.7)",
  );
  process.exit(0);
}

console.error(`Comando no implementado todavía: ${command}`);
process.exit(1);
