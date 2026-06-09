// AppShell: layout persistente (sidebar de etapas + meta de spec siempre visible) + <Outlet>.
// El dashboard es CENTRADO EN LA SPEC: la spec se carga acá y se comparte a todas las páginas.

import { useEffect, useState } from "react";
import { Outlet, useOutletContext } from "react-router-dom";

import { getJson, useSpecData, type SpecData } from "./api";
import { StageSidebar } from "./components/StageSidebar";

export function App() {
  const [specs, setSpecs] = useState<string[]>([]);
  const [specId, setSpecId] = useState<string | null>(null);

  useEffect(() => {
    getJson<string[]>("/api/specs")
      .then((ids) => {
        setSpecs(ids);
        setSpecId((cur) => cur ?? ids[0] ?? null);
      })
      .catch(() => {});
  }, []);

  const data = useSpecData(specId);

  return (
    <div className="shell">
      <StageSidebar
        specs={specs}
        specId={specId}
        onSelect={setSpecId}
        spec={data.spec}
        state={data.state}
      />
      <main className="content">
        {data.error && <div className="panel error">Error: {data.error}</div>}
        <Outlet context={data} />
      </main>
    </div>
  );
}

/** Acceso a los datos de la spec desde cualquier página (provistos por AppShell). */
export function useShell(): SpecData {
  return useOutletContext<SpecData>();
}
