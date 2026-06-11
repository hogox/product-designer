// Configuración (Fase D2 · W5.3). Mini-roadmap honesto: el PERFIL es real (nombre/rol editables
// → firman la auditoría), y lo demás son placeholders declarados `mock` de lo que llega en la
// Fase 5 (conectores MCP/OAuth, RBAC, miembros del equipo), con referencia al PRD. Nada acá
// simula seguridad real (ver invariante U-3 del plan D2).

import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, KeyRound, Plug, Users } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SectionIcon } from "../components/icons";
import { useSession, userInitials } from "../session";

export function SettingsPage() {
  const { user, updateProfile } = useSession();
  const [name, setName] = useState(user?.name ?? "");
  const [role, setRole] = useState(user?.role ?? "");
  const [saved, setSaved] = useState(false);

  const dirty = name.trim() !== user?.name || role.trim() !== user?.role;

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !role.trim()) return;
    updateProfile({ name: name.trim(), role: role.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Mis specs
      </Link>
      <h1 className="text-2xl font-semibold">Configuración</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        El perfil es real y firma la auditoría. El resto es un anticipo honesto de
        la Fase 5.
      </p>

      <div className="space-y-4">
        {/* Perfil — REAL: el nombre/rol firman reviewedBy/uploadedBy/aprobador */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Avatar>
                <AvatarFallback className="bg-primary/10 font-medium text-primary">
                  {userInitials(user?.name ?? "?")}
                </AvatarFallback>
              </Avatar>
              Perfil
              <Badge variant="real">real</Badge>
            </CardTitle>
            <CardDescription>
              Tu identidad firma cada acción en el log de auditoría (puente al RBAC
              de la Fase 5).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-name">Nombre</Label>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profile-role">Rol</Label>
                  <Input
                    id="profile-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Lead PM, Lead de diseño…"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={!dirty || !name.trim() || !role.trim()}>
                  Guardar
                </Button>
                {saved && (
                  <span className="text-sm text-emerald-700">Guardado ✓</span>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Placeholders honestos de la Fase 5 (todos mock) */}
        <RoadmapCard
          icon={Plug}
          title="Conectores"
          desc="Integrar fuentes externas por MCP y OAuth por usuario (Drive, Notion, analítica)."
          prd="PRD §D — Fase 5 (gobernanza/conectores)"
        />
        <RoadmapCard
          icon={KeyRound}
          title="Control de acceso (RBAC)"
          desc="Roles y permisos reales; hoy la identidad es un nombre configurable que firma la auditoría."
          prd="PRD §15 — Fase 5 (RBAC)"
        />
        <RoadmapCard
          icon={Users}
          title="Miembros del equipo"
          desc="Invitar y administrar personas por producto; multiusuario con sesiones reales."
          prd="PRD §15 — Fase 5"
        />
      </div>
    </div>
  );
}

function RoadmapCard({
  icon,
  title,
  desc,
  prd,
}: {
  icon: typeof Plug;
  title: string;
  desc: string;
  prd: string;
}) {
  return (
    <Card className="opacity-90">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SectionIcon icon={icon} tone="slate" />
          {title}
          <Badge variant="mock">mock · Fase 5</Badge>
        </CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <span className="text-xs text-muted-foreground">{prd}</span>
      </CardContent>
    </Card>
  );
}
