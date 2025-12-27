import { useState } from 'react';
import { Wifi, Terminal, FileText } from 'lucide-react';
import { WirelessConnectModal } from './modals/WirelessConnectModal';
import { useLanguage } from '../contexts/LanguageContext';

export type ActiveToolView = 'logcat' | 'terminal' | null;

interface ToolsPanelProps {
    onOpenToolView: (view: ActiveToolView) => void;
}

export function ToolsPanel({ onOpenToolView }: ToolsPanelProps) {
    const [showWirelessModal, setShowWirelessModal] = useState(false);
    const { t } = useLanguage();

    const tools = [
        {
            id: 'wireless' as const,
            icon: <Wifi size={20} />,
            title: t.wirelessAdb,
            description: t.wirelessAdbDesc,
            action: () => setShowWirelessModal(true),
        },
        {
            id: 'logcat' as const,
            icon: <FileText size={20} />,
            title: t.logcat,
            description: t.logcatDesc,
            action: () => onOpenToolView('logcat'),
        },
        {
            id: 'terminal' as const,
            icon: <Terminal size={20} />,
            title: t.terminal,
            description: t.terminalDesc,
            action: () => onOpenToolView('terminal'),
        },
    ];

    return (
        <div className="flex flex-col gap-3">
            {tools.map((tool) => (
                <button
                    key={tool.id}
                    onClick={tool.action}
                    className="flex items-center gap-3 p-3 bg-surface-elevated border border-border rounded-xl
                             text-left hover:border-accent hover:bg-surface-card transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-surface-card flex items-center justify-center 
                                  text-text-secondary group-hover:text-accent group-hover:bg-accent/10 transition-colors">
                        {tool.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text-primary">{tool.title}</div>
                        <div className="text-xs text-text-muted truncate">{tool.description}</div>
                    </div>
                </button>
            ))}

            {/* Only Wireless stays as modal */}
            {showWirelessModal && (
                <WirelessConnectModal onClose={() => setShowWirelessModal(false)} />
            )}
        </div>
    );
}
