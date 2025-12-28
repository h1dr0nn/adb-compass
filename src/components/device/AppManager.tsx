// App Manager - List and manage installed packages
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    Package, Search, Trash2, Loader2, ToggleLeft, ToggleRight,
    AlertTriangle, RefreshCw, Grid, List as ListIcon
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { DeviceInfo } from '../../types';
import { listContainer, listItem } from '../../lib/animations';

interface AppManagerProps {
    device: DeviceInfo;
}

interface AppPackage {
    id: string;
    label?: string;
    icon?: string;
}

// Helper to formatting package name to display name
// e.g. com.google.android.youtube -> Youtube
// com.android.chrome -> Chrome
// Common app package names mapping
const APP_NAME_MAP: Record<string, string> = {
    // Social & Messaging
    'com.facebook.katana': 'Facebook',
    'com.facebook.orca': 'Messenger',
    'com.instagram.android': 'Instagram',
    'com.zhiliaoapp.musically': 'TikTok',
    'com.ss.android.ugc.trill': 'TikTok',
    'com.whatsapp': 'WhatsApp',
    'com.twitter.android': 'X (Twitter)',
    'com.snapchat.android': 'Snapchat',
    'com.linkedin.android': 'LinkedIn',
    'org.telegram.messenger': 'Telegram',
    'com.zing.zalo': 'Zalo',
    'com.discord': 'Discord',
    'com.reddit.frontpage': 'Reddit',
    'com.pinterest': 'Pinterest',
    'com.tumblr': 'Tumblr',
    'jp.naver.line.android': 'LINE',
    'com.viber.voip': 'Viber',
    'com.skype.raider': 'Skype',
    'us.zoom.videomeetings': 'Zoom',

    // Google Suite
    'com.google.android.youtube': 'YouTube',
    'com.google.android.gm': 'Gmail',
    'com.google.android.apps.maps': 'Maps',
    'com.android.chrome': 'Chrome',
    'com.android.vending': 'Play Store',
    'com.google.android.gms': 'Google Play Services',
    'com.google.android.googlequicksearchbox': 'Google',
    'com.google.android.apps.photos': 'Photos',
    'com.google.android.calendar': 'Calendar',
    'com.google.android.deskclock': 'Clock',
    'com.google.android.calculator': 'Calculator',
    'com.google.android.contacts': 'Contacts',
    'com.google.android.apps.messaging': 'Messages',
    'com.google.android.keep': 'Keep Notes',
    'com.google.android.apps.docs': 'Drive',
    'com.google.android.apps.docs.editors.docs': 'Docs',
    'com.google.android.apps.docs.editors.sheets': 'Sheets',
    'com.google.android.apps.docs.editors.slides': 'Slides',
    'com.google.android.apps.translate': 'Translate',
    'com.google.android.music': 'Play Music',
    'com.google.android.videos': 'Play Movies',
    'com.google.android.apps.tachyon': 'Duo',

    // Entertainment & Media
    'com.spotify.music': 'Spotify',
    'com.netflix.mediaclient': 'Netflix',
    'com.amazon.avod.thirdpartyclient': 'Prime Video',
    'com.disney.disneyplus': 'Disney+',
    'tv.twitch.android.app': 'Twitch',
    'com.soundcloud.android': 'SoundCloud',
    'com.shazam.android': 'Shazam',

    // Shopping & Tools
    'com.amazon.mShop.android.shopping': 'Amazon Shopping',
    'com.ebay.mobile': 'eBay',
    'com.alibaba.aliexpresshd': 'AliExpress',
    'com.shopee.vn': 'Shopee',
    'com.shopee.ph': 'Shopee',
    'com.shopee.my': 'Shopee',
    'com.shopee.id': 'Shopee',
    'com.shopee.th': 'Shopee',
    'com.shopee.tw': 'Shopee',
    'com.lazada.android': 'Lazada',
    'com.grabtaxi.passenger': 'Grab',
    'com.ubercab': 'Uber',
    'com.gojek.app': 'Gojek',
    'com.booking': 'Booking.com',
    'com.airbnb.android': 'Airbnb',

    // Microsoft
    'com.microsoft.office.outlook': 'Outlook',
    'com.microsoft.teams': 'Teams',
    'com.microsoft.office.word': 'Word',
    'com.microsoft.office.excel': 'Excel',
    'com.microsoft.office.powerpoint': 'PowerPoint',
    'com.microsoft.emmx': 'Edge',
    'com.microsoft.office.officehubrow': 'Office',

    // System
    'com.android.settings': 'Settings',
    'com.android.camera': 'Camera',
    'com.android.systemui': 'System UI',
    'com.android.phone': 'Phone',
    'com.android.documentsui': 'Files',
    'com.sec.android.app.myfiles': 'My Files (Samsung)',
    'com.mi.android.globalFileexplorer': 'File Manager (Xiaomi)',
};

// Helper to formatting package name to display name
const formatAppLabel = (pkg: string) => {
    // Check map first
    if (APP_NAME_MAP[pkg]) return APP_NAME_MAP[pkg];

    // Fallback: Smart parsing
    const parts = pkg.split('.');
    if (parts.length > 0) {
        // Handle common prefixes like com.google.android.apps.X
        if (parts.length > 4 && parts[0] === 'com' && parts[1] === 'google' && parts[2] === 'android' && parts[3] === 'apps') {
            const name = parts[4];
            return name.charAt(0).toUpperCase() + name.slice(1);
        }

        const last = parts[parts.length - 1];
        // If last part is 'android' (common in weird pkgs), take previous
        if (last === 'android' && parts.length > 1) {
            const prev = parts[parts.length - 2];
            return prev.charAt(0).toUpperCase() + prev.slice(1);
        }

        return last.charAt(0).toUpperCase() + last.slice(1);
    }
    return pkg;
};

export function AppManager({ device }: AppManagerProps) {
    const [packages, setPackages] = useState<AppPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSystem, setShowSystem] = useState(false);
    const [uninstalling, setUninstalling] = useState<string | null>(null);
    const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    const fetchPackages = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await invoke<AppPackage[]>('list_packages', {
                deviceId: device.id,
                includeSystem: showSystem
            });
            // Sort by label (calculated) or id
            setPackages(result.sort((a, b) => {
                const labelA = a.label || formatAppLabel(a.id);
                const labelB = b.label || formatAppLabel(b.id);
                return labelA.localeCompare(labelB);
            }));
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPackages();
    }, [device.id, showSystem]);

    const filteredPackages = useMemo(() => {
        if (!searchQuery.trim()) return packages;
        const query = searchQuery.toLowerCase();
        return packages.filter(pkg => {
            const label = pkg.label || formatAppLabel(pkg.id);
            return label.toLowerCase().includes(query) || pkg.id.toLowerCase().includes(query);
        });
    }, [packages, searchQuery]);

    const handleUninstall = async (packageName: string) => {
        setUninstalling(packageName);
        setConfirmUninstall(null);
        try {
            await invoke('uninstall_app', {
                deviceId: device.id,
                packageName
            });
            toast.success('App uninstalled', { description: packageName });
            setPackages(prev => prev.filter(p => p.id !== packageName));
        } catch (e) {
            toast.error('Uninstall failed', { description: String(e) });
        } finally {
            setUninstalling(null);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Search packages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                    />
                </div>

                <div className="flex bg-surface-elevated rounded-xl border border-border p-1">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                    >
                        <ListIcon size={16} />
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                    >
                        <Grid size={16} />
                    </button>
                </div>

                <button
                    onClick={() => setShowSystem(!showSystem)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${showSystem
                        ? 'bg-accent/10 border-accent/30 text-accent'
                        : 'bg-surface-elevated border-border text-text-muted hover:text-text-secondary'
                        }`}
                    title={showSystem ? 'Showing all apps' : 'Showing user apps only'}
                >
                    {showSystem ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    System
                </button>

                <button
                    onClick={fetchPackages}
                    disabled={loading}
                    className="p-2.5 rounded-xl bg-surface-elevated border border-border text-text-muted hover:text-text-primary hover:border-accent transition-all disabled:opacity-50"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Package Count */}
            <div className="text-xs text-text-muted mb-3 flex justify-between">
                <span>{loading ? 'Loading...' : `${filteredPackages.length} packages found`}</span>
                <span>{showSystem ? 'All Apps' : 'User Apps Only'}</span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={32} className="animate-spin text-accent" />
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-16 text-error">
                            <AlertTriangle size={32} className="mb-2 opacity-60" />
                            <p className="text-sm">{error}</p>
                        </div>
                    ) : filteredPackages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                            <Package size={32} className="mb-2 opacity-40" />
                            <p className="text-sm">No packages found</p>
                        </div>
                    ) : (
                        <motion.div
                            variants={listContainer}
                            initial="initial"
                            animate="animate"
                            className={viewMode === 'list' ? "space-y-2" : "grid grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-fr"}
                        >
                            {filteredPackages.map((pkg) => {
                                const displayLabel = pkg.label || formatAppLabel(pkg.id);


                                return (
                                    <motion.div
                                        key={pkg.id}
                                        variants={listItem}
                                        className={`group relative bg-surface-card border border-border rounded-xl hover:border-accent/30 transition-colors ${viewMode === 'list' ? 'flex items-center gap-3 p-3' : 'p-4 flex flex-col items-center text-center gap-2'
                                            }`}
                                    >
                                        <div
                                            className={`rounded-xl flex items-center justify-center shrink-0 bg-accent/10 overflow-hidden ${viewMode === 'list' ? 'w-10 h-10' : 'w-12 h-12'
                                                }`}
                                        >
                                            {pkg.icon ? (
                                                <img src={`data:image/png;base64,${pkg.icon}`} alt={displayLabel} className="w-full h-full object-contain" />
                                            ) : (
                                                <Package className="text-accent" size={viewMode === 'list' ? 20 : 24} />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-text-primary truncate" title={displayLabel}>
                                                {displayLabel}
                                            </p>
                                            <p className="text-xs text-text-muted truncate font-mono opacity-80" title={pkg.id}>
                                                {pkg.id}
                                            </p>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className={viewMode === 'list' ? "" : "absolute top-2 right-2"}>
                                            {confirmUninstall === pkg.id ? (
                                                <div className={`flex items-center gap-1 ${viewMode === 'grid' ? 'bg-surface-elevated/90 backdrop-blur p-1 rounded-lg shadow-lg' : ''}`}>
                                                    <button
                                                        onClick={() => handleUninstall(pkg.id)}
                                                        className="px-2 py-1 text-xs bg-error text-white rounded-md hover:bg-error/80"
                                                    >
                                                        Confirm
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmUninstall(null)}
                                                        className="p-1 text-text-secondary hover:text-text-primary"
                                                    >
                                                        <AlertTriangle size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setConfirmUninstall(pkg.id)}
                                                    disabled={uninstalling === pkg.id}
                                                    className={`rounded-lg text-text-muted transition-all disabled:opacity-50 ${viewMode === 'list'
                                                        ? 'p-2 opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/10'
                                                        : 'p-1.5 bg-surface-elevated/50 hover:bg-error/10 hover:text-error'
                                                        }`}
                                                    title="Uninstall"
                                                >
                                                    {uninstalling === pkg.id ? (
                                                        <Loader2 size={16} className="animate-spin" />
                                                    ) : (
                                                        <Trash2 size={16} />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
