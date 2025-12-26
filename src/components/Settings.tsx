// Settings Component
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Moon, Sun, Monitor, FolderOpen, Globe, Info, FileText } from 'lucide-react';
import { toast } from 'sonner';
// import { open } from '@tauri-apps/plugin-dialog';
// import { open as openUrl } from '@tauri-apps/plugin-opener';
// import { appLogDir } from '@tauri-apps/api/path';
import { Select } from './ui/Select';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsProps {
    onBack: () => void;
}

// Ensure types match what's in useTheme
type ThemeMode = 'light' | 'dark' | 'system';

export function Settings({ onBack }: SettingsProps) {
    // const [theme, setTheme] = useState<ThemeMode>('dark'); // Removed local state
    const [notifications, setNotifications] = useState(true);
    const [adbPath, setAdbPath] = useState('');

    // consume context
    const { language, setLanguage, t } = useLanguage();
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        // Theme init is now in ThemeContext
        const storedNotif = localStorage.getItem('notifications');
        const storedAdbPath = localStorage.getItem('adbPath');

        // if (storedTheme) setTheme(storedTheme);
        if (storedNotif) setNotifications(storedNotif === 'true');
        if (storedAdbPath) setAdbPath(storedAdbPath);
    }, []);

    const languages = [
        { value: 'en', label: 'English', icon: <span className="text-xs">🇺🇸</span> },
        { value: 'vi', label: 'Tiếng Việt', icon: <span className="text-xs">🇻🇳</span> },
    ];

    const themes: { value: ThemeMode; icon: React.ReactNode; label: string }[] = [
        { value: 'light', icon: <Sun size={16} />, label: t.light },
        { value: 'dark', icon: <Moon size={16} />, label: t.dark },
        { value: 'system', icon: <Monitor size={16} />, label: t.system },
    ];

    const handleLanguageChange = (val: string) => {
        // Update context
        setLanguage(val as any);
    };

    const handleThemeChange = (val: ThemeMode) => {
        setTheme(val);
        // localStorage handled in provider
    };

    const handleNotificationToggle = () => {
        const newState = !notifications;
        setNotifications(newState);
        localStorage.setItem('notifications', String(newState));
        toast.success(`Notifications ${newState ? 'Enabled' : 'Disabled'}`);
    };

    const handleBrowseAdb = async () => {
        // try {
        //     const selected = await open({
        //         directory: true,
        //         multiple: false,
        //         title: 'Select ADB Location',
        //     });

        //     if (selected && typeof selected === 'string') {
        //         setAdbPath(selected);
        //         localStorage.setItem('adbPath', selected);
        //         toast.success('ADB Path updated');
        //     }
        // } catch (err) {
        //     console.error('Failed to browse', err);
        //     toast.info("Browser feature not available in web mode");
        // }
        toast.info("Browser unavailable in debug mode");
    };

    const handleViewLogs = async () => {
        // try {
        //     const logDir = await appLogDir();
        //     await openUrl(logDir);
        //     toast.success('Opened Logs Directory');
        // } catch (err) {
        //     console.error('Failed to open logs', err);
        //     toast.info("Logs feature not available in web mode");
        // }
        toast.info("Logs unavailable in debug mode");
    };

    const handleReportIssue = async () => {
        // try {
        //     await openUrl('https://github.com/h1dr0nn/adb-compass/issues/new');
        //     toast.info('Opened GitHub Issues');
        // } catch (err) {
        //     console.error('Failed to open link', err);
        //     window.open('https://github.com/h1dr0nn/adb-compass/issues/new', '_blank');
        // }
        window.open('https://github.com/h1dr0nn/adb-compass/issues/new', '_blank');
    };

    return (
        <motion.div
            className="flex flex-col h-full w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
        >
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2.5 rounded-xl hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-all duration-200 border border-transparent hover:border-border"
                >
                    <ArrowLeft size={22} />
                </button>
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold text-text-primary">{t.settings}</h2>
                    <p className="text-sm text-text-secondary">{t.managePrefs}</p>
                </div>
            </div>

            <div className="grid gap-6 pb-8 overflow-y-auto no-scrollbar" style={{ scrollbarWidth: 'none' }}>
                {/* Appearance Section */}
                <section className="bg-surface-card border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                        <Monitor size={18} className="text-accent" />
                        {t.appearance}
                    </h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-text-primary">{t.appTheme}</p>
                            <p className="text-xs text-text-secondary mt-0.5">{t.selectTheme}</p>
                        </div>
                        <div className="flex bg-surface-elevated rounded-lg p-1 border border-border/50 relative isolate">
                            {themes.map((tItem) => (
                                <button
                                    key={tItem.value}
                                    onClick={() => handleThemeChange(tItem.value)}
                                    className={`relative px-3 py-1.5 rounded-md transition-colors duration-200 flex items-center justify-center ${theme === tItem.value ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
                                    title={tItem.label}
                                >
                                    <span className="relative z-10">{tItem.icon}</span>
                                    {theme === tItem.value && (
                                        <motion.div
                                            layoutId="activeTheme"
                                            className="absolute inset-0 bg-surface-card rounded-md shadow-sm border border-border/10 z-0"
                                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ADB Configuration */}
                <section className="bg-surface-card border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                        <FolderOpen size={18} className="text-accent" />
                        {t.adbConfig}
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-primary mb-1.5">{t.customPath}</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder={t.bundledAdb}
                                    value={adbPath}
                                    className="flex-1 bg-surface-elevated border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all placeholder:text-text-muted/50"
                                    readOnly
                                />
                                <button
                                    onClick={handleBrowseAdb}
                                    className="px-4 py-2 bg-surface-elevated border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all hover:bg-surface-hover"
                                >
                                    {t.browse}
                                </button>
                            </div>
                            <p className="text-xs text-text-muted mt-2 ml-1">{t.leaveEmpty}</p>
                        </div>
                    </div>
                </section>

                {/* General Settings */}
                <section className="bg-surface-card border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                        <Globe size={18} className="text-accent" />
                        {t.general}
                    </h3>
                    <div className="space-y-5">
                        <div className="flex items-center justify-between pb-5 border-b border-border/50">
                            <div>
                                <p className="text-sm font-medium text-text-primary">{t.language}</p>
                                <p className="text-xs text-text-secondary mt-0.5">{t.changeLang}</p>
                            </div>
                            <div className="w-40">
                                <Select
                                    options={languages}
                                    value={language}
                                    onChange={handleLanguageChange}
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-text-primary">{t.notifications}</p>
                                <p className="text-xs text-text-secondary mt-0.5">{t.showNotif}</p>
                            </div>
                            <button
                                onClick={handleNotificationToggle}
                                className={`relative w-11 h-6 rounded-full flex items-center px-1 transition-colors duration-300 focus:outline-none ${notifications ? 'bg-accent' : 'bg-surface-elevated border border-border'}`}
                            >
                                <motion.div
                                    className="w-4 h-4 bg-white rounded-full shadow-sm"
                                    layout
                                    animate={{
                                        x: notifications ? 20 : 0
                                    }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </button>
                        </div>
                    </div>
                </section>

                {/* About & Logs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <section className="bg-surface-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-text-primary mb-2 flex items-center gap-2">
                                <Info size={18} className="text-accent" />
                                {t.about}
                            </h3>
                            <p className="text-sm text-text-secondary mb-4">{t.aboutDesc}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-muted bg-surface-elevated/50 p-2 rounded-lg w-fit">
                            <span className="font-mono">Version 0.1.0</span>
                            <span className="w-1 h-1 bg-text-muted rounded-full"></span>
                            <button
                                onClick={() => toast.info('You are on the latest version')}
                                className="hover:text-accent transition-colors"
                            >
                                {t.checkUpdates}
                            </button>
                        </div>
                    </section>

                    <section className="bg-surface-card border border-border rounded-xl p-6 shadow-sm">
                        <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                            <FileText size={18} className="text-accent" />
                            {t.logs}
                        </h3>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={handleViewLogs}
                                className="flex items-center justify-between w-full px-3 py-2 bg-surface-elevated rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors text-left group"
                            >
                                <span>{t.viewLogs}</span>
                                <ArrowLeft size={16} className="rotate-180 transition-transform group-hover:translate-x-1" />
                            </button>
                            <button
                                onClick={handleReportIssue}
                                className="flex items-center justify-between w-full px-3 py-2 bg-surface-elevated rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors text-left group"
                            >
                                <span>{t.reportIssue}</span>
                                <ArrowLeft size={16} className="rotate-180 transition-transform group-hover:translate-x-1" />
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </motion.div>
    );
}
