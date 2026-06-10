# ANEXO D2 — Dirección visual (Sesiones 7–8: W3.1–W3.4)

> Complementa PLAN-FASE-D2-experiencia-dashboard.md. Referencia visual: Stratify (claro, modular,
> tarjetas con aire). Restricción rectora: **shadcn/ui lo más stock posible** — la identidad sale
> de los tokens y la composición, NO de personalizar componentes.

## 0. Disciplina shadcn-stock (reglas duras)

1. **Un solo punto de personalización**: las CSS variables del tema en `globals.css` (convención
   shadcn: `--background`, `--card`, `--primary`, `--muted`, `--radius`, etc.). Nada de CSS custom
   por componente ni archivos de estilos paralelos.
2. **No editar los archivos de componentes shadcn** (`components/ui/*`) salvo UNA excepción:
   variantes nuevas de `Badge` vía `cva` (ver §3). Todo lo demás se resuelve componiendo
   componentes stock + utilidades Tailwind en las páginas/componentes propios.
3. **Cero dependencias nuevas de UI.** Iconos: los que ya estén (lucide-react). Tipografía: la
   default del stack (una sola familia, sin display fonts).
4. Si algo "pide" un componente custom, primero preguntarse: ¿se resuelve con Card + Badge +
   Separator + Tabs + Tooltip + Breadcrumb + Sheet + Dialog stock? En esta fase, la respuesta es sí.

## 1. Tokens (W3.1) — el único lugar donde vive la identidad

Tema claro único (decisión cerrada en el plan; eliminar las vars `.dark` o dejarlas sin uso,
documentando la decisión).

| Token | Dirección | Intención |
|---|---|---|
| `--background` | gris-azulado muy claro (≈ hsl 210 35% 97%) | el "lienzo aire" de Stratify |
| `--card` | blanco puro | módulos que flotan sobre el fondo |
| `--border` | gris frío sutil (≈ hsl 214 20% 90%) | separación sin peso |
| `--muted` / `--muted-foreground` | base slate stock | NO bajar más el contraste del texto secundario |
| `--primary` | un azul sobrio (≈ hsl 217 80% 50%) o el slate stock | un solo acento de acción |
| `--radius` | 0.75rem | el redondeo generoso hace el 80% del look Stratify |

Sombra: `shadow-sm` en tarjetas, `shadow-md` solo en superficies elevadas (popover/modal/drawer).
No inventar sombras custom.

Colores semánticos (vía clases Tailwind en variantes de Badge, no como tokens nuevos):
- `real` → verde (emerald) · `mock` → ámbar (amber)
- Revisión: aprobado=emerald · rechazado=red · en_pausa=amber · pendiente=slate
- Evidencia: cálculo=violet · cita=sky (o ambos slate con icono distinto, si se prefiere sobriedad)

## 2. Layout (W3.2) — composición modular

- **Página = pila de Cards**, cada una con `CardHeader` propio: icono + título + Badge de tipo de
  contenido + contador (`CardDescription` para el subtítulo). Nunca un lienzo continuo de texto.
  Gap entre tarjetas `gap-4`/`gap-6`; ancho de contenido máx ~`max-w-5xl` centrado.
- **Breadcrumb stock** persistente bajo el header: `<spec> / <etapa> / <tab>`.
- **Sidebar**: mantener estructura actual (switcher de spec + 7 etapas + trazabilidad) migrada a
  claro; estados activos con `bg-muted`, badges real/mock a la derecha. Si el proyecto ya usa el
  componente `sidebar` de shadcn, quedarse ahí; si es custom, NO reescribirlo en esta sesión —
  solo re-tokenizar.
- **Pipeline del overview clickeable**: cada etapa es un link (Card interactiva con `hover:bg-muted/50`).
- **Jerarquía de la evidencia (corrección clave)**: el anclaje (archivo · locator · cálculo/cita)
  sube de jerarquía — `text-sm text-foreground` para la cita/cálculo, y el locator como chip
  `font-mono text-xs` con `Badge variant="outline"`. Deja de ser la letra más chica de la pantalla.
- Densidad: `p-6` en tarjetas, `space-y-*` consistente. Ante la duda, más aire.

## 3. Sistema de chips (W3.3, sesión 8 — anticipado aquí para no improvisar)

Un único `Badge` con variantes cva nombradas por semántica, no por color:
`real | mock | aprobado | rechazado | enPausa | pendiente | calculo | cita | quantitative |
qualitative | heart`. Es la ÚNICA edición permitida dentro de `components/ui/`.
Eliminar todos los estilos de chip ad-hoc existentes y migrar a estas variantes.

## 4. Qué NO hacer en la sesión 7

- No tocar drawer/modales (eso es W4, sesiones 8–9; usar `Sheet` y `Dialog` stock cuando llegue).
- No reorganizar información ni renombrar secciones — es cambio de piel, no de IA.
- No animaciones custom; las transiciones default de shadcn bastan.
- No romper el etiquetado real/mock (invariante U-3): migra a Badge, pero visible en todas las vistas.

## 5. Verificación visual de cierre (sesión 7)

Checklist contra capturas, lado a lado con las referencias de Stratify:
1. Fondo claro gris-azulado, tarjetas blancas flotando con radio generoso — sí/no.
2. Cada bloque de contenido tiene header con icono + título + badge + contador — sí/no.
3. Breadcrumb responde "¿dónde estoy?" en cualquier ruta — sí/no.
4. La evidencia anclada se lee sin esfuerzo (ya no es el texto más chico) — sí/no.
5. real/mock distinguible en sidebar, pipeline y headers — sí/no.
6. `git diff` de `components/ui/` = vacío (la excepción Badge llega en sesión 8) — sí/no.
