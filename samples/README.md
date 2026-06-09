# samples/ — set de muestra del Agente 1 (SINTÉTICO)

> ⚠️ **Datos sintéticos**, generados de forma determinista por `scripts/gen-samples.mjs`.
> No son datos reales. Reemplázalos por tu set real cuando lo tengas (PRD §20.1–2);
> el Agente 1 (Fase 1) corre igual sobre archivos reales.

Tema: **abandono en la verificación OTP del onboarding**.

| Archivo | Formato | Rol en el loop del Agente 1 |
|---|---|---|
| `entrevistas/entrevista-01.txt`, `-02.txt` | txt | evidencia **cualitativa** (cita textual + locator de párrafo) |
| `entrevistas/entrevista-03.pdf` | pdf | evidencia cualitativa (cita + locator de página/párrafo) |
| `analitica/funnel-otp.csv` / `.xlsx` | csv/xlsx | evidencia **cuantitativa** — se **computa** sobre las filas (invariante 4) |
| `tickets/tickets-soporte.csv` | csv | señales de soporte (texto dentro de tabular) |

## Funnel OTP (computable)
`funnel-otp.csv`/`.xlsx` tiene una fila por sesión con: `llego_a_otp`, `completo_otp`,
`reintentos_otp`, `tiempo_espera_seg`, `segmento`, `canal`. El drop-off OTP se **computa**
(no se estima): `abandonaron / llegaron_a_otp`. Con este set: 315 llegaron al paso OTP,
136 abandonaron → **drop-off = 43.2% (n=315)**.

## Regenerar
```
node scripts/gen-samples.mjs
```
Es determinista: produce siempre los mismos archivos.
