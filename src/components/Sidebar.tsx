import { ApkManager } from './ApkManager';
import { useLanguage } from '../contexts/LanguageContext';
import type { ApkInfo } from '../types';
import { Settings } from 'lucide-react';
import type { ActiveToolView } from './ToolsPanel';

interface SidebarProps {
    apkInfo: ApkInfo | null;
    onSelectApk: (path: string) => void;
    onClearApk: () => void;
    onScanApk: (path: string) => Promise<ApkInfo[]>;
    onSelectApkFromList: (info: ApkInfo) => void;
    onOpenSettings: () => void;
    onOpenToolView: (view: ActiveToolView) => void;
}

export function Sidebar({
    apkInfo,
    onSelectApk,
    onClearApk,
    onScanApk,
    onSelectApkFromList,
    onOpenSettings,
    onOpenToolView
}: SidebarProps) {
    const { t } = useLanguage();

    return (
        <aside className="w-80 border-r border-border bg-surface-card flex flex-col shadow-xl z-20">
            {/* APK Manager Section - Flexible Height */}
            <div className="flex-1 px-4 py-4 min-h-0 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-3 px-2">
                    <div className="text-sm font-bold text-text-muted uppercase tracking-wider">
                        LIBRARY
                    </div>
                    <button
                        onClick={onOpenSettings}
                        className="text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-md hover:bg-surface-elevated"
                        title={t.settings}
                    >
                        <Settings size={18} />
                    </button>
                </div>
                <div className="flex-1 min-h-0 bg-surface-bg/50 rounded-2xl border border-border/50 p-4 overflow-hidden">
                    <ApkManager
                        apkInfo={apkInfo}
                        onSelect={onSelectApk}
                        onClear={onClearApk}
                        onScan={onScanApk}
                        onSelectFromList={onSelectApkFromList}
                        onOpenToolView={onOpenToolView}
                    />
                </div>
            </div>
        </aside>
    );
}
