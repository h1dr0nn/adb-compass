import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, RefreshCw, Trash2, Pause, Play, Filter, Smartphone } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { Select } from './ui/Select';

interface LogcatViewProps {
    onBack: () => void;
}

type LogLevel = 'V' | 'D' | 'I' | 'W' | 'E';

export function LogcatView({ onBack }: LogcatViewProps) {
    const [logs, setLogs] = useState('');
    const [loading, setLoading] = useState(false);
    const [paused, setPaused] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<string>('');
    const [devices, setDevices] = useState<Array<{ id: string; model?: string; status: string }>>([]);
    const [logLevel, setLogLevel] = useState<LogLevel>('V');
    const [lines, setLines] = useState(100);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        invoke<Array<{ id: string; model?: string; status: string }>>('get_devices')
            .then((devs) => {
                const authorizedDevices = devs.filter((d) => d.status === 'Device');
                setDevices(authorizedDevices);
                if (authorizedDevices.length > 0) {
                    setSelectedDevice(authorizedDevices[0].id);
                }
            })
            .catch(console.error);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (selectedDevice && !paused) {
            fetchLogs();
            intervalRef.current = window.setInterval(fetchLogs, 2000);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [selectedDevice, paused, logLevel, lines]);

    const fetchLogs = async () => {
        if (!selectedDevice) return;

        try {
            const filter = logLevel !== 'V' ? `*:${logLevel}` : undefined;
            const result = await invoke<string>('get_logcat', {
                deviceId: selectedDevice,
                lines,
                filter,
            });
            setLogs(result);
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        }
    };

    const handleRefresh = async () => {
        setLoading(true);
        await fetchLogs();
        setLoading(false);
    };

    const handleClear = async () => {
        if (!selectedDevice) return;

        try {
            await invoke('clear_logcat', { deviceId: selectedDevice });
            setLogs('');
            toast.success('Logcat cleared');
        } catch (err) {
            toast.error(String(err));
        }
    };

    const getLogColor = (line: string) => {
        if (line.includes(' E ') || line.includes('/E ')) return 'text-error';
        if (line.includes(' W ') || line.includes('/W ')) return 'text-warning';
        if (line.includes(' I ') || line.includes('/I ')) return 'text-accent';
        if (line.includes(' D ') || line.includes('/D ')) return 'text-text-secondary';
        return 'text-text-muted';
    };

    const logLevels: { value: LogLevel; label: string; color: string }[] = [
        { value: 'V', label: 'Verbose', color: 'text-text-muted' },
        { value: 'D', label: 'Debug', color: 'text-text-secondary' },
        { value: 'I', label: 'Info', color: 'text-accent' },
        { value: 'W', label: 'Warning', color: 'text-warning' },
        { value: 'E', label: 'Error', color: 'text-error' },
    ];

    // Prepare options for Select components
    const deviceOptions = devices.map((d) => ({
        value: d.id,
        label: d.model || d.id,
        icon: <Smartphone size={14} className="text-accent" />,
    }));

    const linesOptions = [
        { value: '50', label: '50 lines' },
        { value: '100', label: '100 lines' },
        { value: '200', label: '200 lines' },
        { value: '500', label: '500 lines' },
    ];

    return (
        <motion.div
            className="flex flex-col h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
        >
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
                <button
                    onClick={onBack}
                    className="p-2.5 rounded-xl hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-all duration-200 border border-transparent hover:border-border"
                >
                    <ArrowLeft size={22} />
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                        <FileText className="text-accent" size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-text-primary">Logcat Viewer</h2>
                        <p className="text-sm text-text-muted">Real-time device logs</p>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="w-48">
                    <Select
                        options={deviceOptions}
                        value={selectedDevice}
                        onChange={setSelectedDevice}
                        placeholder="Select device..."
                    />
                </div>

                <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-1 border border-border">
                    <Filter size={14} className="text-text-muted ml-2" />
                    {logLevels.map((level) => (
                        <button
                            key={level.value}
                            onClick={() => setLogLevel(level.value)}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${logLevel === level.value
                                ? 'bg-surface-card text-text-primary shadow-sm'
                                : `${level.color} hover:bg-surface-card/50`
                                }`}
                        >
                            {level.value}
                        </button>
                    ))}
                </div>

                <div className="w-32">
                    <Select
                        options={linesOptions}
                        value={String(lines)}
                        onChange={(val) => setLines(Number(val))}
                        placeholder="Lines..."
                    />
                </div>

                <div className="flex-1" />

                <button
                    onClick={() => setPaused(!paused)}
                    className={`p-2 rounded-lg border transition-colors ${paused
                        ? 'bg-accent text-white border-accent'
                        : 'bg-surface-elevated border-border text-text-secondary hover:text-text-primary'
                        }`}
                    title={paused ? 'Resume' : 'Pause'}
                >
                    {paused ? <Play size={16} /> : <Pause size={16} />}
                </button>
                <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="p-2 rounded-lg bg-surface-elevated border border-border text-text-secondary hover:text-text-primary transition-colors"
                    title="Refresh"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
                <button
                    onClick={handleClear}
                    className="p-2 rounded-lg bg-surface-elevated border border-border text-text-secondary hover:text-error transition-colors"
                    title="Clear logs"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Logs Content */}
            <div className="flex-1 overflow-auto font-mono text-xs bg-surface-card border border-border rounded-xl p-4 custom-scrollbar">
                {logs ? (
                    <pre className="whitespace-pre-wrap">
                        {logs.split('\n').map((line, i) => (
                            <div key={i} className={`${getLogColor(line)} hover:bg-surface-elevated/50 px-1`}>
                                {line}
                            </div>
                        ))}
                    </pre>
                ) : (
                    <div className="flex items-center justify-center h-full text-text-muted">
                        {selectedDevice ? 'Loading logs...' : 'Select a device to view logs'}
                    </div>
                )}
                <div ref={logsEndRef} />
            </div>
        </motion.div>
    );
}
