// Breadcrumb persistente (D2 · W3.2): responde "¿dónde estoy?" en cualquier ruta de
// la spec — <spec> / <etapa> / <sección>. Vive en el shell (App), fuera de las rutas
// hijas, por eso deriva la miga del pathname (useParams ahí solo conoce :specId).

import { Fragment } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { findStage } from "../stages";
import { specPath } from "../nav";

interface Crumb {
  label: string;
  to?: string;
}

export function SpecBreadcrumb() {
  const { specId } = useParams();
  const { pathname } = useLocation();
  if (!specId) return null;

  const rest = pathname
    .replace(specPath(specId), "")
    .split("/")
    .filter(Boolean);
  const crumbs: Crumb[] = [{ label: specId, to: specPath(specId) }];

  if (rest.length === 0) {
    crumbs.push({ label: "Spec viva" });
  } else if (rest[0] === "fuentes") {
    crumbs.push({ label: "Fuentes" });
  } else if (rest[0] === "auditoria") {
    crumbs.push({ label: "Auditoría" });
  } else if (rest[0] === "etapa") {
    const stage = findStage(rest[1]);
    if (stage) {
      crumbs.push({
        label: stage.name,
        to: specPath(specId, `/etapa/${stage.id}`),
      });
      const section = stage.sections.find((s) => s.id === rest[2]);
      if (section) crumbs.push({ label: section.label });
    }
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {last || !c.to ? (
                  <BreadcrumbPage>{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={c.to}>{c.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
