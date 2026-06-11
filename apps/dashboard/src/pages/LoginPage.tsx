// Login MOCK (Fase D2 · W5.1): email + contraseña sin validación real; "Entrar" setea el
// usuario de sesión (Hugo, Lead PM) en localStorage. Badge `mock` declarado: no hay
// autenticación de servidor. Lo único real que sale de acá es la identidad que firma la
// auditoría. Logout vuelve a esta pantalla.

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_USER, useSession } from "../session";

export function LoginPage() {
  const { login } = useSession();
  const [email, setEmail] = useState(DEFAULT_USER.email);
  const [password, setPassword] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Mock: cualquier credencial entra como el usuario por defecto (la demo es de
    // producto, no de seguridad). La identidad real es editable en Configuración.
    login(DEFAULT_USER);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              Product Designer Agéntico
            </div>
            <div className="text-xs text-muted-foreground">
              Spec-Driven Design
            </div>
          </div>
          <Badge variant="mock" className="ml-auto">
            mock
          </Badge>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Contraseña</Label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Login simulado para la demo — sin validación. Entrás como{" "}
          <strong>
            {DEFAULT_USER.name}, {DEFAULT_USER.role}
          </strong>
          .
        </p>
      </Card>
    </div>
  );
}
