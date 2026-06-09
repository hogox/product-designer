import { useShell } from "../App";
import { AuditPanel } from "../components/AuditPanel";

export function AuditPage() {
  const { audit } = useShell();
  return <AuditPanel entries={audit} />;
}
