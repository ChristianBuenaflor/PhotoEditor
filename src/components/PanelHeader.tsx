import type { ReactNode } from 'react';

export function PanelHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="h-7 px-3 flex items-center justify-between border-b border-border bg-panel-2">
      <span className="text-[10px] uppercase tracking-[0.15em] text-fg-dim font-mono">
        {title}
      </span>
      <div className="flex items-center gap-1">{actions}</div>
    </div>
  );
}
