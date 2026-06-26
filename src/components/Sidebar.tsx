import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, X, ArrowUpDown } from 'lucide-react';
import { ApkManager } from './ApkManager';
import { useLanguage } from '../hooks/useLanguage';
import { useApkStore } from '../stores/apkStore';
import { AppTooltip } from './ui/Tooltip';

export function Sidebar() {
    const { t } = useLanguage();
    const folderHistory = useApkStore((s) => s.folderHistory);
    const removeFromHistory = useApkStore((s) => s.removeFromHistory);
    const scanFolder = useApkStore((s) => s.scanFolder);
    const sortType = useApkStore((s) => s.sortType);
    const setSortType = useApkStore((s) => s.setSortType);

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isSortOpen, setIsSortOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const sortDropdownRef = useRef<HTMLDivElement>(null);

    // Handle clicking outside to close dropdowns
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isHistoryOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsHistoryOpen(false);
            }
            if (isSortOpen && sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
                setIsSortOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isHistoryOpen, isSortOpen]);

    const sortOptions = [
        { value: 'name-asc' as const, label: t.sortNameAsc || 'Name (A-Z)' },
        { value: 'name-desc' as const, label: t.sortNameDesc || 'Name (Z-A)' },
        { value: 'date-desc' as const, label: t.sortDateDesc || 'Date (Newest)' },
        { value: 'date-asc' as const, label: t.sortDateAsc || 'Date (Oldest)' },
        { value: 'size-desc' as const, label: t.sortSizeDesc || 'Size (Largest)' },
        { value: 'size-asc' as const, label: t.sortSizeAsc || 'Size (Smallest)' },
    ];

    return (
        <aside className="w-80 border border-border bg-surface-bg rounded-[12px] overflow-hidden flex flex-col z-20">
            {/* APK Manager Section - Flexible Height */}
            <div className="flex-1 p-3 min-h-0 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-3 px-1 relative">
                    <div className="text-sm font-bold text-text-muted uppercase tracking-wider">
                        {t.library}
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Sort Dropdown */}
                        <div className="relative">
                            <AppTooltip content={t.sortBy || "Sort By"}>
                                <button
                                    onClick={() => setIsSortOpen(!isSortOpen)}
                                    className={`text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-md hover:bg-surface-elevated cursor-pointer ${
                                        isSortOpen ? 'bg-surface-elevated text-text-primary' : ''
                                    }`}
                                >
                                    <ArrowUpDown size={18} />
                                </button>
                            </AppTooltip>

                            <AnimatePresence>
                                {isSortOpen && (
                                    <motion.div
                                        ref={sortDropdownRef}
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 top-10 w-48 bg-surface-card border border-border rounded-xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5"
                                    >
                                        <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-2 py-1 border-b border-border/50 mb-1">
                                            {t.sortBy || 'Sort By'}
                                        </div>
                                        {sortOptions.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => {
                                                    setSortType(opt.value);
                                                    setIsSortOpen(false);
                                                }}
                                                className={`w-full text-left px-2 py-1.5 text-xs rounded-lg hover:bg-surface-hover/60 transition-colors cursor-pointer flex items-center justify-between ${
                                                    sortType === opt.value
                                                        ? 'bg-accent/10 text-accent font-medium'
                                                        : 'text-text-secondary'
                                                }`}
                                            >
                                                <span>{opt.label}</span>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Folder History Dropdown */}
                        <div className="relative">
                            <AppTooltip content="Folder History">
                                <button
                                    onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                                    className={`text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-md hover:bg-surface-elevated cursor-pointer ${
                                        isHistoryOpen ? 'bg-surface-elevated text-text-primary' : ''
                                    }`}
                                >
                                    <History size={18} />
                                </button>
                            </AppTooltip>

                            <AnimatePresence>
                                {isHistoryOpen && (
                                    <motion.div
                                        ref={dropdownRef}
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 top-10 w-72 bg-surface-card border border-border rounded-xl shadow-xl z-50 p-2 flex flex-col max-h-64 overflow-y-auto custom-scrollbar"
                                    >
                                        <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-2 py-1 border-b border-border/50 mb-1">
                                            Scanned Folders
                                        </div>
                                        {folderHistory.length === 0 ? (
                                            <div className="text-text-muted text-xs p-3 text-center italic">
                                                No folder history
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-0.5">
                                                {folderHistory.map((path) => {
                                                    const name = path.split(/[\\/]/).pop() || path;
                                                    return (
                                                        <div
                                                            key={path}
                                                            onClick={() => {
                                                                scanFolder(path);
                                                                setIsHistoryOpen(false);
                                                            }}
                                                            className="group/item flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-surface-hover/60 transition-colors cursor-pointer text-left"
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-xs font-semibold text-text-primary truncate">
                                                                    {name}
                                                                </div>
                                                                <AppTooltip content={path} side="right">
                                                                    <div className="text-[9px] text-text-muted truncate mt-0.5 font-mono">
                                                                        {path}
                                                                    </div>
                                                                </AppTooltip>
                                                            </div>
                                                            <AppTooltip content="Remove from history">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        removeFromHistory(path);
                                                                    }}
                                                                    className="shrink-0 p-1 text-text-muted hover:text-error rounded hover:bg-surface-elevated transition-colors cursor-pointer"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </AppTooltip>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                    <ApkManager />
                </div>
            </div>
        </aside>
    );
}
