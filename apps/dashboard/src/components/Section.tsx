import type { ReactNode } from "react";

export function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="section">
      <h3>
        {title} {badge}
      </h3>
      {children}
    </div>
  );
}

export function Empty() {
  return <p className="empty">Vacío.</p>;
}
