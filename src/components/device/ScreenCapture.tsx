// Screen Capture Tab - Screenshot and Screen Recording
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Camera, Video, VideoOff, RefreshCw,
    FolderOpen, Image, ExternalLink, Zap, Settings,
    Home, Square, Power, Volume2, Volume1, VolumeX,
    Menu, Sun, Moon, Bell, Play, Triangle
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { DeviceInfo } from '../../types';
import { listItem } from '../../lib/animations';
import { StreamPlayer } from './StreamPlayer';

interface ScreenCaptureProps {
    device: DeviceInfo;
}

interface CaptureResult {
    success: boolean;
    path?: string;
    error?: string;
}

interface ScrcpyStatus {
    running: boolean;
    device_id: string | null;
    port: number | null;
}

type StreamMode = 'standard' | 'high-perf';

export function ScreenCapture({ device }: ScreenCaptureProps) {
    const [isCapturing, setIsCapturing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);

    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [aspectRatio, setAspectRatio] = useState<number>(9 / 19.5); // Default modern phone ratio
    const [isLive, setIsLive] = useState(false);
    const [showFps, setShowFps] = useState(true);
    const [allowTouch, setAllowTouch] = useState(false);

    // High-performance mode state
    const [streamMode, setStreamMode] = useState<StreamMode>('standard');
    const [scrcpyStatus, setScrcpyStatus] = useState<ScrcpyStatus | null>(null);
    const [isStartingScrcpy, setIsStartingScrcpy] = useState(false);
    const [screenWidth, setScreenWidth] = useState(1080);
    const [screenHeight, setScreenHeight] = useState(2340);

    // Fetch device aspect ratio and resolution
    useEffect(() => {
        const fetchProps = async () => {
            try {
                const props = await invoke<{ screen_resolution: string | null }>('get_device_props', { deviceId: device.id });
                if (props.screen_resolution) {
                    console.log('Device resolution raw:', props.screen_resolution);
                    const [w, h] = props.screen_resolution.replace('Physical size: ', '').replace('Override size: ', '').split('x').map(Number);
                    console.log('Parsed resolution:', w, 'x', h, '→ ratio:', w / h);
                    if (w && h) {
                        setAspectRatio(w / h);
                        setScreenWidth(w);
                        setScreenHeight(h);
                    }
                }
            } catch (e) {
                console.error('Failed to fetch device props:', e);
            }
        };
        fetchProps();
    }, [device.id]);

    // Stop scrcpy when unmounting or switching modes
    useEffect(() => {
        return () => {
            if (scrcpyStatus?.running) {
                invoke('stop_scrcpy_server', { deviceId: device.id }).catch(console.error);
            }
        };
    }, [device.id, scrcpyStatus?.running]);

    // Recording timer
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isRecording) {
            interval = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    // Format recording time
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Take screenshot
    const handleScreenshot = async () => {
        setIsCapturing(true);
        try {
            const result = await invoke<CaptureResult>('take_screenshot', {
                deviceId: device.id
            });

            if (result.success && result.path) {
                toast.success('Screenshot saved', {
                    description: result.path
                });
            } else {
                toast.error('Screenshot failed', {
                    description: result.error || 'Unknown error'
                });
            }
        } catch (error) {
            toast.error('Screenshot failed', {
                description: String(error)
            });
        } finally {
            setIsCapturing(false);
        }
    };

    // Start/stop recording
    const handleRecordingToggle = async () => {
        if (isRecording) {
            // Stop recording
            try {
                const result = await invoke<CaptureResult>('stop_screen_recording', {
                    deviceId: device.id
                });

                setIsRecording(false);
                setRecordingTime(0);

                if (result.success && result.path) {
                    toast.success('Recording saved', {
                        description: result.path
                    });
                }
            } catch (error) {
                toast.error('Failed to stop recording', {
                    description: String(error)
                });
            }
        } else {
            // Start recording
            try {
                await invoke('start_screen_recording', {
                    deviceId: device.id
                });
                setIsRecording(true);
                toast.info('Recording started');
            } catch (error) {
                toast.error('Failed to start recording', {
                    description: String(error)
                });
            }
        }
    };

    // Refresh screen preview
    const handleRefreshPreview = async () => {
        setIsLoadingPreview(true);
        try {
            const result = await invoke<number[]>('get_screen_frame', {
                deviceId: device.id
            });

            if (result && result.length > 0) {
                // Convert to base64
                const bytes = new Uint8Array(result);
                const blob = new Blob([bytes], { type: 'image/png' });
                const url = URL.createObjectURL(blob);
                setPreviewImage(url);
            }
        } catch (error) {
            toast.error('Failed to get screen preview', {
                description: String(error)
            });
        } finally {
            setIsLoadingPreview(false);
        }
    };

    // Live loop
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isLive) {
            interval = setInterval(() => {
                if (!isLoadingPreview && !isCapturing) {
                    handleRefreshPreview();
                }
            }, 1000); // 1 FPS fallback for ADB
        }
        return () => clearInterval(interval);
    }, [isLive, isLoadingPreview, isCapturing]);

    // Touch Event Handler
    const handleTouch = async (e: React.MouseEvent<HTMLDivElement>) => {
        if (!allowTouch || !previewImage) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const xPercent = (e.clientX - rect.left) / rect.width;
        const yPercent = (e.clientY - rect.top) / rect.height;

        // Fetch real resolution to map coordinates
        try {
            const props = await invoke<{ screen_resolution: string | null }>('get_device_props', { deviceId: device.id });
            if (props.screen_resolution) {
                const [w, h] = props.screen_resolution.replace('Physical size: ', '').replace('Override size: ', '').split('x').map(Number);
                if (w && h) {
                    const tapX = Math.round(xPercent * w);
                    const tapY = Math.round(yPercent * h);

                    await invoke('input_tap', { deviceId: device.id, x: tapX, y: tapY });

                    // Visual feedback
                    toast.success(`Tap: ${tapX}, ${tapY}`, { duration: 500 });
                }
            }
        } catch (error) {
            console.error('Touch failed', error);
        }
    };

    // Open Save Folder
    const handleOpenFolder = async () => {
        try {
            await invoke('open_captures_folder');
            toast.success('Folder opened');
        } catch (error) {
            toast.error('Failed to open folder', { description: String(error) });
        }
    };

    // Toggle high-performance mode
    const toggleHighPerfMode = async () => {
        if (streamMode === 'standard') {
            // Switch to high-perf mode
            setIsStartingScrcpy(true);
            try {
                console.log('Starting scrcpy server for device:', device.id);
                const status = await invoke<ScrcpyStatus>('start_scrcpy_server', {
                    deviceId: device.id,
                    maxSize: 1024,
                    bitRate: 8000000,
                    maxFps: 60,
                });
                console.log('Scrcpy status:', status);
                setScrcpyStatus(status);
                setStreamMode('high-perf');
                setIsLive(false); // Disable standard live mode
                toast.success('High-performance mode enabled', { description: `Streaming on port ${status.port}` });
            } catch (error) {
                console.error('Scrcpy start error:', error);
                toast.error('Failed to start high-performance mode', { description: String(error) });
            } finally {
                setIsStartingScrcpy(false);
            }
        } else {
            // Switch back to standard mode
            try {
                await invoke('stop_scrcpy_server', { deviceId: device.id });
                setScrcpyStatus(null);
                setStreamMode('standard');
                toast.success('Switched to standard mode');
            } catch (error) {
                toast.error('Failed to stop high-performance mode', { description: String(error) });
            }
        }
    };

    // Scrcpy touch handler
    const handleScrcpyTouch = useCallback(async (x: number, y: number, action: 'down' | 'up' | 'move') => {
        if (!allowTouch) return;
        const actionMap = { down: 0, up: 1, move: 2 };
        try {
            await invoke('scrcpy_touch', {
                deviceId: device.id,
                action: actionMap[action],
                x,
                y,
                width: screenWidth,
                height: screenHeight,
            });
        } catch (error) {
            console.error('Touch failed:', error);
        }
    }, [device.id, allowTouch, screenWidth, screenHeight]);

    // Scrcpy scroll handler
    const handleScrcpyScroll = useCallback(async (x: number, y: number, deltaX: number, deltaY: number) => {
        if (!allowTouch) return;
        try {
            await invoke('scrcpy_scroll', {
                deviceId: device.id,
                x,
                y,
                hScroll: Math.round(deltaX / 120) * -1,
                vScroll: Math.round(deltaY / 120) * -1,
                width: screenWidth,
                height: screenHeight,
            });
        } catch (error) {
            console.error('Scroll failed:', error);
        }
    }, [device.id, allowTouch, screenWidth, screenHeight]);

    // Handle Quick Actions (Key Events)
    const handleKeyEvent = async (keycode: number) => {
        try {
            await invoke('execute_shell', {
                deviceId: device.id,
                command: `input keyevent ${keycode}`
            });
        } catch (error) {
            console.error('Key event failed:', error);
            toast.error('Failed to send key event');
        }
    };

    return (
        <div className="h-full flex gap-4">
            {/* Controls Panel - Expands */}
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                {/* Top Row - Capture Actions */}
                <motion.div variants={listItem} className="bg-surface-elevated border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                            <Camera size={16} className="text-accent" />
                            Capture
                        </h4>
                        {isRecording && (
                            <div className="flex items-center gap-1.5 text-error text-sm font-mono">
                                <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                                {formatTime(recordingTime)}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleScreenshot}
                            disabled={isCapturing}
                            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-text-primary rounded-lg transition-all disabled:opacity-50"
                        >
                            {isCapturing ? <RefreshCw size={16} className="animate-spin" /> : <Camera size={16} />}
                            <span className="text-sm font-medium">Screenshot</span>
                        </button>
                        <button
                            onClick={handleRecordingToggle}
                            className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${isRecording
                                ? 'bg-error/20 text-error border border-error/30'
                                : 'bg-surface-card hover:bg-surface-hover border border-border'
                                }`}
                        >
                            {isRecording ? <VideoOff size={16} /> : <Video size={16} />}
                            <span className="text-sm font-medium">{isRecording ? 'Stop Recording' : 'Record'}</span>
                        </button>
                    </div>
                </motion.div>

                {/* Bottom Row - Config & Storage side by side */}
                <div className="flex flex-wrap gap-4">
                    {/* Configuration */}
                    <motion.div variants={listItem} className="flex-1 min-w-[200px] bg-surface-elevated border border-border rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                            <Settings size={16} className="text-accent" />
                            Configuration
                        </h4>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-text-secondary">Live Preview</span>
                                <button
                                    onClick={toggleHighPerfMode}
                                    disabled={isStartingScrcpy}
                                    className={`w-10 h-6 rounded-full transition-colors flex items-center p-1 ${streamMode === 'high-perf' ? 'bg-success' : 'bg-surface-card border border-border'
                                        } disabled:opacity-50`}
                                >
                                    <motion.div
                                        animate={{ x: streamMode === 'high-perf' ? 16 : 0 }}
                                        className="w-4 h-4 rounded-full bg-white shadow-sm"
                                    />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-text-secondary">Enable Touch</span>
                                <button
                                    onClick={() => setAllowTouch(!allowTouch)}
                                    className={`w-10 h-6 rounded-full transition-colors flex items-center p-1 ${allowTouch ? 'bg-accent' : 'bg-surface-card border border-border'
                                        }`}
                                >
                                    <motion.div
                                        animate={{ x: allowTouch ? 16 : 0 }}
                                        className="w-4 h-4 rounded-full bg-white shadow-sm"
                                    />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-text-secondary">Show FPS</span>
                                <button
                                    onClick={() => setShowFps(!showFps)}
                                    className={`w-10 h-6 rounded-full transition-colors flex items-center p-1 ${showFps ? 'bg-accent' : 'bg-surface-card border border-border'
                                        }`}
                                >
                                    <motion.div
                                        animate={{ x: showFps ? 16 : 0 }}
                                        className="w-4 h-4 rounded-full bg-white shadow-sm"
                                    />
                                </button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Storage */}
                    <motion.div variants={listItem} className="flex-1 min-w-[200px] bg-surface-elevated border border-border rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                            <FolderOpen size={16} className="text-accent" />
                            Storage
                        </h4>
                        <p className="text-xs text-text-muted mb-3">Captures saved to:</p>
                        <p className="text-sm text-text-secondary mb-4 font-mono">~/Pictures/ADB Compass/</p>
                        <button
                            onClick={handleOpenFolder}
                            className="flex items-center gap-2 px-3 py-2 bg-surface-card hover:bg-surface-hover border border-border text-text-secondary hover:text-text-primary rounded-lg transition-all text-sm"
                        >
                            <ExternalLink size={14} />
                            Open Folder
                        </button>
                    </motion.div>

                </div>

                {/* Quick Actions - Full Width Row */}
                <motion.div variants={listItem} className="bg-surface-elevated border border-border rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                        <Zap size={16} className="text-accent" />
                        Quick Actions
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                        {/* Row 1: Navigation */}
                        <button onClick={() => handleKeyEvent(4)} className="p-2 bg-surface-card hover:bg-surface-hover border border-border rounded-lg flex items-center justify-center transition-colors" title="Back">
                            <Triangle size={18} className="text-text-secondary -rotate-90" />
                        </button>
                        <button onClick={() => handleKeyEvent(3)} className="p-2 bg-surface-card hover:bg-surface-hover border border-border rounded-lg flex items-center justify-center transition-colors" title="Home">
                            <Home size={18} className="text-text-secondary" />
                        </button>
                        <button onClick={() => handleKeyEvent(187)} className="p-2 bg-surface-card hover:bg-surface-hover border border-border rounded-lg flex items-center justify-center transition-colors" title="Recents">
                            <Square size={18} className="text-text-secondary" />
                        </button>
                        <button onClick={() => handleKeyEvent(82)} className="p-2 bg-surface-card hover:bg-surface-hover border border-border rounded-lg flex items-center justify-center transition-colors" title="Menu">
                            <Menu size={18} className="text-text-secondary" />
                        </button>

                        {/* Row 2: Volume & Power */}
                        <button onClick={() => handleKeyEvent(25)} className="p-2 bg-surface-card hover:bg-surface-hover border border-border rounded-lg flex items-center justify-center transition-colors" title="Volume Down">
                            <Volume1 size={18} className="text-text-secondary" />
                        </button>
                        <button onClick={() => handleKeyEvent(24)} className="p-2 bg-surface-card hover:bg-surface-hover border border-border rounded-lg flex items-center justify-center transition-colors" title="Volume Up">
                            <Volume2 size={18} className="text-text-secondary" />
                        </button>
                        <button onClick={() => handleKeyEvent(164)} className="p-2 bg-surface-card hover:bg-surface-hover border border-border rounded-lg flex items-center justify-center transition-colors" title="Mute">
                            <VolumeX size={18} className="text-text-secondary" />
                        </button>
                        <button onClick={() => handleKeyEvent(26)} className="p-2 bg-surface-card hover:bg-surface-hover border border-border rounded-lg flex items-center justify-center transition-colors" title="Power">
                            <Power size={18} className="text-error" />
                        </button>

                        {/* Row 3: System & Media */}
                        <button onClick={() => handleKeyEvent(220)} className="p-2 bg-surface-card hover:bg-surface-hover border border-border rounded-lg flex items-center justify-center transition-colors" title="Brightness Down">
                            <Moon size={18} className="text-text-secondary" />
                        </button>
                        <button onClick={() => handleKeyEvent(221)} className="p-2 bg-surface-card hover:bg-surface-hover border border-border rounded-lg flex items-center justify-center transition-colors" title="Brightness Up">
                            <Sun size={18} className="text-text-secondary" />
                        </button>
                        <button onClick={() => handleKeyEvent(83)} className="p-2 bg-surface-card hover:bg-surface-hover border border-border rounded-lg flex items-center justify-center transition-colors" title="Notifications">
                            <Bell size={18} className="text-text-secondary" />
                        </button>
                        <button onClick={() => handleKeyEvent(85)} className="p-2 bg-surface-card hover:bg-surface-hover border border-border rounded-lg flex items-center justify-center transition-colors" title="Play/Pause">
                            <Play size={18} className="text-success" />
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Phone Preview - Fixed Width */}
            <div className="w-96 h-full shrink-0 flex items-center justify-center relative bg-surface-elevated/50 rounded-xl border border-border p-4">
                {/* Status Badge & Controls */}
                {streamMode === 'high-perf' && (
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-2">

                        <div className="flex items-center gap-1.5 px-2 py-1 bg-success/20 backdrop-blur text-success rounded-lg text-xs font-medium border border-success/20">
                            <Zap size={12} />
                            <span>Live</span>
                        </div>
                    </div>
                )}
                {streamMode === 'standard' && (
                    <button
                        onClick={handleRefreshPreview}
                        disabled={isLoadingPreview}
                        className="absolute top-2 right-2 z-10 p-1.5 bg-surface-card rounded-lg border border-border hover:text-accent disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={isLoadingPreview ? 'animate-spin' : ''} />
                    </button>
                )}

                {/* Phone Frame */}
                <div
                    className={`bg-black border-4 border-surface-elevated rounded-[1.5rem] overflow-hidden shadow-2xl relative ${allowTouch ? 'cursor-pointer' : ''
                        }`}
                    style={{ height: '100%', maxHeight: 'calc(100% - 2rem)', maxWidth: '100%', aspectRatio: aspectRatio }}
                    onClick={streamMode === 'standard' ? handleTouch : undefined}
                >
                    {streamMode === 'high-perf' && scrcpyStatus?.port ? (
                        <StreamPlayer
                            deviceId={device.id}
                            width={screenWidth}
                            height={screenHeight}
                            allowTouch={allowTouch}
                            onVideoDimensions={(w, h) => {
                                setAspectRatio(w / h);
                            }}
                            onTouch={handleScrcpyTouch}
                            onScroll={handleScrcpyScroll}
                            showFps={showFps}
                        />
                    ) : previewImage ? (
                        <img src={previewImage} alt="Preview" className="w-full h-full" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-text-muted">
                            <Image size={40} className="opacity-30 mb-1" />
                            <span className="text-xs opacity-50">No Signal</span>
                        </div>
                    )}

                    {/* Recording Overlay */}
                    {isRecording && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="text-center text-white">
                                <div className="w-3 h-3 rounded-full bg-error animate-pulse mx-auto mb-1" />
                                <span className="text-xs">Recording</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
