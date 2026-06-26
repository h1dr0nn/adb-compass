import { useState, useEffect, useMemo } from 'react';
import {
    FolderOpen, RefreshCw, Package, FileCheck, X
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import * as tauri from '../lib/tauri';
import type { ApkInfo } from '../types';
import { ApkDropzone } from './ApkDropzone';
import { useLanguage } from '../hooks/useLanguage';
import { useApkStore } from '../stores/apkStore';
import { AppTooltip } from './ui/Tooltip';

export function ApkManager() {
    const { t } = useLanguage();

    const apkInfo = useApkStore((s) => s.apkInfo);
    const folderPath = useApkStore((s) => s.folderPath);
    const scannedApks = useApkStore((s) => s.scannedApks);
    const manualApks = useApkStore((s) => s.manualApks);
    const sortType = useApkStore((s) => s.sortType);
    const clearApk = useApkStore((s) => s.clearApk);
    const scanFolder = useApkStore((s) => s.scanFolder);
    const setApkFromList = useApkStore((s) => s.setApkFromList);
    const setManualApks = useApkStore((s) => s.setManualApks);

    const [scanning, setScanning] = useState(false);

    const sortedScannedApks = useMemo(() => {
        return [...scannedApks].sort((a, b) => {
            if (sortType === 'name-asc') {
                return a.file_name.localeCompare(b.file_name);
            }
            if (sortType === 'name-desc') {
                return b.file_name.localeCompare(a.file_name);
            }
            if (sortType === 'date-desc') {
                return (b.last_modified || 0) - (a.last_modified || 0);
            }
            if (sortType === 'date-asc') {
                return (a.last_modified || 0) - (b.last_modified || 0);
            }
            if (sortType === 'size-desc') {
                return b.size_bytes - a.size_bytes;
            }
            if (sortType === 'size-asc') {
                return a.size_bytes - b.size_bytes;
            }
            return 0;
        });
    }, [scannedApks, sortType]);

    const sortedManualApks = useMemo(() => {
        return [...manualApks].sort((a, b) => {
            if (sortType === 'name-asc') {
                return a.file_name.localeCompare(b.file_name);
            }
            if (sortType === 'name-desc') {
                return b.file_name.localeCompare(a.file_name);
            }
            if (sortType === 'date-desc') {
                return (b.last_modified || 0) - (a.last_modified || 0);
            }
            if (sortType === 'date-asc') {
                return (a.last_modified || 0) - (b.last_modified || 0);
            }
            if (sortType === 'size-desc') {
                return b.size_bytes - a.size_bytes;
            }
            if (sortType === 'size-asc') {
                return a.size_bytes - b.size_bytes;
            }
            return 0;
        });
    }, [manualApks, sortType]);

    const handleSelectFolder = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
            });
            if (selected && typeof selected === 'string') {
                handleScan(selected);
            }
        } catch (error) {
            console.error('Error selecting folder:', error);
        }
    };

    const handleScan = async (path: string) => {
        setScanning(true);
        try {
            await Promise.all([
                scanFolder(path),
                new Promise(resolve => setTimeout(resolve, 500))
            ]);
        } finally {
            setScanning(false);
        }
    };

    useEffect(() => {
        if (!folderPath) return;

        const unlistenPromise = tauri.onApkFolderChanged((changedPath) => {
            if (changedPath === folderPath) {
                console.log(`[ApkManager] APK folder changed: ${changedPath}, auto-reloading...`);
                handleScan(changedPath);
            }
        });

        return () => {
            unlistenPromise.then((fn) => fn());
        };
    }, [folderPath]);

    const handleManualApkSelected = async (path: string) => {
        try {
            // Check manual list for duplicates
            if (manualApks.some(a => a.path === path)) {
                const existing = manualApks.find(a => a.path === path);
                if (existing) setApkFromList(existing);
                return;
            }

            // Invoke validation to get info
            const info = await tauri.validateApk(path);

            if (info && info.valid) {
                setManualApks([...manualApks, info]);
                setApkFromList(info);
            }
        } catch (e) {
            console.error("Failed to add manual apk", e);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto px-1">
                <div className="flex flex-col gap-6 pb-4">
                        {/* Section 1: Folder Selection */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleSelectFolder}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 
                                            bg-surface-elevated border border-border rounded-lg 
                                            text-xs font-medium text-text-primary hover:border-accent transition-all"
                                >
                                    <FolderOpen size={14} />
                                    <span className="truncate max-w-[120px]">
                                        {folderPath ? folderPath.split(/[\\/]/).pop() : t.selectFolder}
                                    </span>
                                </button>
                                {folderPath && (
                                    <AppTooltip content={t.reloadFolder}>
                                        <button
                                            onClick={() => handleScan(folderPath)}
                                            className="p-2 bg-surface-elevated border border-border rounded-lg 
                                                text-text-secondary hover:text-accent disabled:cursor-not-allowed"
                                            disabled={scanning}
                                        >
                                            <RefreshCw size={14} className={scanning ? 'animate-spin text-accent' : ''} />
                                        </button>
                                    </AppTooltip>
                                )}
                            </div>

                            {/* Folder List */}
                            {folderPath && (
                                <div className="space-y-2">
                                    {sortedScannedApks.length === 0 && !scanning && (
                                        <div className="text-center text-text-muted text-xs italic">
                                            {t.noValidApks}
                                        </div>
                                    )}
                                    {sortedScannedApks.map((apk) => (
                                        <ApkListItem
                                            key={apk.path}
                                            apk={apk}
                                            isSelected={apkInfo?.path === apk.path}
                                            onSelect={() => {
                                                if (apkInfo?.path === apk.path) {
                                                    clearApk();
                                                } else {
                                                    setApkFromList(apk);
                                                }
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Section 2: Manual Selection */}
                        <div className="space-y-3 pt-6 border-t border-border">
                            <ApkDropzone
                                apkInfo={null}
                                onApkSelected={handleManualApkSelected}
                                onApkClear={() => { }}
                            />

                            {/* Manual List */}
                            {manualApks.length > 0 && (
                                <div className="space-y-2">
                                    {sortedManualApks.map((apk) => (
                                        <ApkListItem
                                            key={apk.path}
                                            apk={apk}
                                            isSelected={apkInfo?.path === apk.path}
                                            onSelect={() => {
                                                if (apkInfo?.path === apk.path) {
                                                    clearApk();
                                                } else {
                                                    setApkFromList(apk);
                                                }
                                            }}
                                            onRemove={() => {
                                                setManualApks(manualApks.filter(a => a.path !== apk.path));
                                                if (apkInfo?.path === apk.path) clearApk();
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                </div>
            </div>
        </div>
    );
}

// Sub-component for list item
function ApkListItem({ apk, isSelected, onSelect, onRemove }: { apk: ApkInfo, isSelected: boolean, onSelect: () => void, onRemove?: () => void }) {
    const { t } = useLanguage();
    // Format date modified
    const dateStr = apk.last_modified
        ? new Date(Number(apk.last_modified)).toLocaleDateString()
        : '';

    return (
        <div className="group relative">
            <button
                onClick={onSelect}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${isSelected
                    ? 'bg-accent/10 border-accent'
                    : 'bg-surface-elevated border-transparent hover:border-border'
                    }`}
            >
                <div className="mt-0.5 text-accent">
                    <Package size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">
                        {apk.file_name}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted font-mono">
                        {dateStr && (
                            <span className="bg-surface-card px-1.5 py-0.5 rounded">
                                {dateStr}
                            </span>
                        )}
                        <span className="bg-surface-card px-1.5 py-0.5 rounded">
                            {(apk.size_bytes / (1024 * 1024)).toFixed(1)} MB
                        </span>
                    </div>
                </div>
                {isSelected && (
                    <FileCheck size={14} className="text-success mt-0.5" />
                )}
            </button>
            {onRemove && (
                <AppTooltip content={t.removeFromList}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                        className="absolute right-2 top-2 p-1 text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X size={14} />
                    </button>
                </AppTooltip>
            )}
        </div>
    );
}
