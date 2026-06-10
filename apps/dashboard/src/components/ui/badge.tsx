import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
        // Variantes semánticas (D2 · W3.3): nombradas por significado, no por color.
        // Par uniforme border-{c}-200 bg-{c}-50 text-{c}-700 — el tono -700 sobre -50
        // cumple AA (≥4.5:1) en texto chico (ver ESTADO §7, paleta de chips).
        // real / aprobado = verde "ok"; mock / enPausa = ámbar "atención".
        real: "border-emerald-200 bg-emerald-50 text-emerald-700",
        aprobado: "border-emerald-200 bg-emerald-50 text-emerald-700",
        mock: "border-amber-200 bg-amber-50 text-amber-700",
        enPausa: "border-amber-200 bg-amber-50 text-amber-700",
        rechazado: "border-red-200 bg-red-50 text-red-700",
        pendiente: "border-border bg-muted text-muted-foreground",
        // Evidencia: cita (texto) = sky, cálculo (tabular) = violet.
        cita: "border-sky-200 bg-sky-50 text-sky-700",
        calculo: "border-violet-200 bg-violet-50 text-violet-700",
        // Tipo de hallazgo: separado de evidencia para no confundirse en la misma tarjeta.
        quantitative: "border-indigo-200 bg-indigo-50 text-indigo-700",
        qualitative: "border-teal-200 bg-teal-50 text-teal-700",
        // Categoría HEART (métricas de Definición).
        heart: "border-rose-200 bg-rose-50 text-rose-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
