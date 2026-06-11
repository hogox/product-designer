// Sesión de usuario (Fase D2 · W5). El LOGIN es mock (sin contraseñas ni sesión de servidor:
// el riesgo sería parecer seguridad real sin serlo). Lo ÚNICO real es la IDENTIDAD: el nombre
// del usuario firma la auditoría (reviewedBy / uploadedBy / aprobador / intake.update) — puente
// directo al RBAC real de la Fase 5. Persiste en localStorage; nada toca el servidor.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface SessionUser {
  name: string;
  role: string;
  email: string;
}

// Usuario por defecto de la demo (plan §5.1): se precarga en el login.
export const DEFAULT_USER: SessionUser = {
  name: "Hugo Muñoz",
  role: "Lead PM",
  email: "munoz.hugo@gmail.com",
};

const STORAGE_KEY = "pda.session.user";

interface SessionCtx {
  user: SessionUser | null;
  login: (user: SessionUser) => void;
  logout: () => void;
  updateProfile: (patch: Partial<SessionUser>) => void;
}

const Ctx = createContext<SessionCtx | null>(null);

function readStored(): SessionUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as Partial<SessionUser>;
    if (!u.name || !u.role) return null;
    return { name: u.name, role: u.role, email: u.email ?? "" };
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => readStored());

  // sincronizar entre pestañas (logout en una cierra en la otra)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setUser(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback((u: SessionUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const updateProfile = useCallback((patch: Partial<SessionUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user, login, logout, updateProfile }),
    [user, login, logout, updateProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession fuera de <SessionProvider>");
  return ctx;
}

/** Identidad que firma la auditoría: "Nombre (Rol)". Real, no mock. */
export function actorLabel(user: SessionUser | null): string {
  if (!user) return "human";
  return `${user.name} (${user.role})`;
}

/** Iniciales para el avatar (1–2 letras). */
export function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
