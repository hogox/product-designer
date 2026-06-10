// AppShell: layout persistente (sidebar de etapas + meta de spec siempre visible) + <Outlet>.
// El dashboard es CENTRADO EN LA SPEC: la spec se carga acá y se comparte a todas las páginas.

import { useEffect, useState } from "react";
import { Link, Outlet, useOutletContext, useParams } from "react-router-dom";

import { getSpecGroups, useSpecData, type SpecData, type SpecGroup } from "./api";
import { StageSidebar } from "./components/StageSidebar";

export function App() {
  // El specId vive en la URL (D2 · W0.3): refresh lo conserva y dos pestañas son
  // independientes. Nada de estado compartido entre specs salvo el índice.
  const { specId } = useParams();
  const [groups, setGroups] = useState<SpecGroup[]>([]);

  useEffect(() => {
    // grupos para el switcher del sidebar (specs del mismo producto + "ver todas")
    getSpecGroups().then(setGroups).catch(() => {});
  }, []);

  const data = useSpecData(specId ?? null);

  return (
    <div className="shell">
      <StageSidebar
        specId={specId ?? null}
        groups={groups}
        spec={data.spec}
        state={data.state}
      />
      <main className="content">
        {data.error && (
          <div className="panel error">
            Error: {data.error}
            <div style={{ marginTop: 8 }}>
              <Link to="/">← Mis specs</Link>
            </div>
          </div>
        )}
        <Outlet context={data} />
      </main>
    </div>
  );
}

/** Acceso a los datos de la spec desde cualquier página (provistos por AppShell). */
export function useShell(): SpecData {
  return useOutletContext<SpecData>();
}
