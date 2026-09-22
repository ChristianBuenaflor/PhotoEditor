import { useEditor } from '../store/editor';
import { PanelHeader } from './PanelHeader';
import { History } from 'lucide-react';

export function HistoryPanel() {
  const history = useEditor((s) => s.history);
  const idx = useEditor((s) => s.historyIndex);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PanelHeader title="History" actions={<History size={12} className="text-fg-dim" />} />
      <div className="flex-1 overflow-auto thin-scroll">
        {history.map((h, i) => (
          <div
            key={i}
            className={`px-3 py-1 text-[11px] font-mono border-l-2 ${
              i === idx
                ? 'bg-accent/15 border-l-accent text-fg'
                : i > idx
                ? 'text-fg-mute border-l-transparent'
                : 'text-fg-dim border-l-transparent hover:bg-panel-2'
            }`}
          >
            <span className="text-fg-mute mr-2">{String(i + 1).padStart(2, '0')}</span>
            {h.label}
          </div>
        ))}
      </div>
    </div>
  );
}
