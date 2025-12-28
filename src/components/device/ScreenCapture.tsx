// Screen Capture Tab - Screenshot and Screen Recording
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Camera, Video, VideoOff, RefreshCw,
    FolderOpen, Image
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { DeviceInfo } from '../../types';
import { listItem } from '../../lib/animations';

interface ScreenCaptureProps {
    device: DeviceInfo;
}

interface CaptureResult {
    success: boolean;
    path?: string;
    error?: string;
}

export function ScreenCapture({ device }: ScreenCaptureProps) {
    const [isCapturing, setIsCapturing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);

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
                setLastScreenshot(result.path);
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

    return (
        <div className="h-full flex gap-6">
            {/* Left Panel - Screen Preview */}
            <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-text-primary">Screen Preview</h3>
                    <button
                        onClick={handleRefreshPreview}
                        disabled={isLoadingPreview}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-sm transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={isLoadingPreview ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                <div className="flex-1 bg-surface-card border border-border rounded-xl overflow-hidden flex items-center justify-center min-h-[300px]">
                    {previewImage ? (
                        <img
                            src={previewImage}
                            alt="Device Screen"
                            className="max-h-full max-w-full object-contain"
                        />
                    ) : (
                        <div className="text-center text-text-muted">
                            <Image size={48} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Click "Refresh" to capture screen preview</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel - Controls */}
            <div className="w-72 flex flex-col gap-4">
                {/* Screenshot Section */}
                <motion.div
                    variants={listItem}
                    className="bg-surface-card border border-border rounded-xl p-4"
                >
                    <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                        <Camera size={16} className="text-accent" />
                        Screenshot
                    </h4>

                    <button
                        onClick={handleScreenshot}
                        disabled={isCapturing}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-accent to-accent-secondary text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {isCapturing ? (
                            <>
                                <RefreshCw size={18} className="animate-spin" />
                                Capturing...
                            </>
                        ) : (
                            <>
                                <Camera size={18} />
                                Take Screenshot
                            </>
                        )}
                    </button>

                    {lastScreenshot && (
                        <p className="mt-3 text-xs text-text-muted truncate">
                            Last: {lastScreenshot}
                        </p>
                    )}
                </motion.div>

                {/* Screen Recording Section */}
                <motion.div
                    variants={listItem}
                    className="bg-surface-card border border-border rounded-xl p-4"
                >
                    <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                        <Video size={16} className="text-accent" />
                        Screen Recording
                    </h4>

                    <button
                        onClick={handleRecordingToggle}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 font-medium rounded-xl transition-all ${isRecording
                                ? 'bg-error/20 text-error border border-error/30 hover:bg-error/30'
                                : 'bg-surface-elevated hover:bg-surface-hover border border-border text-text-primary'
                            }`}
                    >
                        {isRecording ? (
                            <>
                                <VideoOff size={18} />
                                Stop Recording
                            </>
                        ) : (
                            <>
                                <Video size={18} />
                                Start Recording
                            </>
                        )}
                    </button>

                    {isRecording && (
                        <div className="mt-3 flex items-center justify-center gap-2 text-error">
                            <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                            <span className="font-mono text-sm">{formatTime(recordingTime)}</span>
                        </div>
                    )}
                </motion.div>

                {/* Info Card */}
                <motion.div
                    variants={listItem}
                    className="bg-surface-elevated border border-border rounded-xl p-4"
                >
                    <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
                        <FolderOpen size={16} className="text-accent" />
                        Save Location
                    </h4>
                    <p className="text-xs text-text-muted">
                        Screenshots and recordings are saved to ~/Pictures/ADB Compass/
                    </p>
                    <p className="text-xs text-text-secondary mt-2">
                        • Screenshots: /screenshots folder<br />
                        • Recordings: /recordings folder
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
