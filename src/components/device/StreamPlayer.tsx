// StreamPlayer - Display H.264 stream using WebCodecs
import { useEffect, useRef, useState, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useLanguage } from '../../contexts/LanguageContext';

interface StreamPlayerProps {
    deviceId: string;
    width: number;
    height: number;
    onTouch?: (x: number, y: number, action: 'down' | 'up' | 'move') => void;
    onScroll?: (x: number, y: number, deltaX: number, deltaY: number) => void;
    allowTouch?: boolean;
    onVideoDimensions?: (width: number, height: number) => void;
    showFps?: boolean;
}

export function StreamPlayer({
    deviceId,
    width,
    height,
    onTouch,
    onScroll,
    allowTouch = false,
    onVideoDimensions,
    showFps = true,
}: StreamPlayerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [fps, setFps] = useState(0);
    const [isConnected, setIsConnected] = useState(false);
    const frameCountRef = useRef(0);
    const decoderRef = useRef<VideoDecoder | null>(null);
    const isConfiguredRef = useRef(false);
    const spsBufferRef = useRef<Uint8Array | null>(null);
    const ppsBufferRef = useRef<Uint8Array | null>(null);
    const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
    const { t } = useLanguage();

    // FPS counter
    useEffect(() => {
        if (!showFps) return;
        const interval = setInterval(() => {
            setFps(frameCountRef.current);
            frameCountRef.current = 0;
        }, 1000);
        return () => clearInterval(interval);
    }, [showFps]);

    // Initialize WebCodecs Decoder
    useEffect(() => {
        if (!('VideoDecoder' in window)) {
            console.error("WebCodecs API not supported");
            return;
        }

        const handleFrame = (frame: VideoFrame) => {
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    if (canvasRef.current.width !== frame.displayWidth || canvasRef.current.height !== frame.displayHeight) {
                        canvasRef.current.width = frame.displayWidth;
                        canvasRef.current.height = frame.displayHeight;
                        if (onVideoDimensions) {
                            onVideoDimensions(frame.displayWidth, frame.displayHeight);
                        }
                    }
                    ctx.drawImage(frame, 0, 0);
                    frameCountRef.current++;
                    setIsConnected(true); // State update is fine, won't trigger re-run as it's not in dep array
                }
            }
            frame.close();
        };

        const handleError = (e: Error) => {
            console.error("VideoDecoder error:", e);
            setIsConnected(false);
        };

        try {
            decoderRef.current = new VideoDecoder({
                output: handleFrame,
                error: handleError,
            });
        } catch (e) {
            console.error("Failed to create decoder:", e);
        }

        return () => {
            if (decoderRef.current?.state !== 'closed') {
                decoderRef.current?.close();
            }
        };
    }, []); // Empty dependency array = Run once on mount

    // Listen for H.264 Text Frames (Base64 NALs)
    useEffect(() => {
        if (!deviceId || !decoderRef.current) return;

        // Sanitize deviceId to match backend (alphanumeric, -, /, :, _)
        const sanitizedId = deviceId.replace(/\./g, "_").replace(/:/g, "_");
        console.log(`Listening for scrcpy-frame-${sanitizedId}`);

        const unlisten = listen<string>(`scrcpy-frame-${sanitizedId}`, (event) => {
            const base64Data = event.payload;
            const binaryString = atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            let nalHeaderIndex = -1;
            if (bytes[0] === 0 && bytes[1] === 0) {
                if (bytes[2] === 1) nalHeaderIndex = 3;
                else if (bytes[2] === 0 && bytes[3] === 1) nalHeaderIndex = 4;
            }

            if (nalHeaderIndex === -1) {
                return;
            }

            const nalHeader = bytes[nalHeaderIndex];
            const nalType = nalHeader & 0x1F;

            // SPS (7)
            if (nalType === 7) {
                spsBufferRef.current = bytes;
                const profile = bytes[nalHeaderIndex + 1];
                const constraint = bytes[nalHeaderIndex + 2];
                const level = bytes[nalHeaderIndex + 3];
                const codecString = `avc1.${[profile, constraint, level].map(b => b.toString(16).padStart(2, '0')).join('')}`;

                if (!isConfiguredRef.current) {
                    console.log(`Configuring for ${codecString}`);
                    try {
                        decoderRef.current?.configure({
                            codec: codecString,
                            optimizeForLatency: true,
                        });
                        isConfiguredRef.current = true;
                    } catch (e: any) {
                        console.error(`Config Error: ${e.message}`);
                    }
                }
                return;
            }

            // PPS (8)
            if (nalType === 8) {
                ppsBufferRef.current = bytes;
                return;
            }

            // IDR (5)
            if (nalType === 5) {
                let chunkData = bytes;
                if (spsBufferRef.current && ppsBufferRef.current) {
                    const spsLen = spsBufferRef.current.length;
                    const ppsLen = ppsBufferRef.current.length;
                    const totalLen = spsLen + ppsLen + bytes.length;
                    const merged = new Uint8Array(totalLen);
                    merged.set(spsBufferRef.current, 0);
                    merged.set(ppsBufferRef.current, spsLen);
                    merged.set(bytes, spsLen + ppsLen);
                    chunkData = merged;
                }

                try {
                    const chunk = new EncodedVideoChunk({
                        type: 'key',
                        timestamp: performance.now() * 1000,
                        data: chunkData,
                    });

                    if (decoderRef.current?.state === 'configured') {
                        decoderRef.current.decode(chunk);
                    }
                } catch (e: any) {
                    console.error(`Decode IDR Error: ${e.message}`);
                }
                return;
            }

            // Delta (1)
            try {
                const chunk = new EncodedVideoChunk({
                    type: 'delta',
                    timestamp: performance.now() * 1000,
                    data: bytes,
                });

                if (decoderRef.current?.state === 'configured') {
                    decoderRef.current.decode(chunk);
                }
            } catch (e: any) {
                // console.error(`Decode Delta Error: ${e.message}`);
            }
        });

        return () => {
            unlisten.then((fn) => fn());
            // Don't reset isConnected/isConfigured here to avoid flicker if deviceId doesn't change
            // Actually, if deviceId changes, we DO want to reset.
            setIsConnected(false);
            isConfiguredRef.current = false;
        };
    }, [deviceId]); // Removed isConnected from dependencies!

    // Events Wrappers
    const handleEvents = useMemo(() => {
        const getXY = (e: React.MouseEvent | React.TouchEvent, rect: DOMRect) => {
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
            const x = Math.max(0, Math.round(((clientX - rect.left) / rect.width) * width));
            const y = Math.max(0, Math.round(((clientY - rect.top) / rect.height) * height));
            return { x, y };
        }

        return {
            onMouseDown: (e: React.MouseEvent) => {
                if (!allowTouch || !onTouch || !canvasRef.current) return;
                const { x, y } = getXY(e, canvasRef.current.getBoundingClientRect());
                lastTouchRef.current = { x, y };
                onTouch(x, y, 'down');
            },
            onMouseUp: (e: React.MouseEvent) => {
                if (!allowTouch || !onTouch || !canvasRef.current) return;
                const { x, y } = getXY(e, canvasRef.current.getBoundingClientRect());
                lastTouchRef.current = null;
                onTouch(x, y, 'up');
            },
            onMouseMove: (e: React.MouseEvent) => {
                if (!allowTouch || !onTouch || !canvasRef.current || !lastTouchRef.current) return;
                const { x, y } = getXY(e, canvasRef.current.getBoundingClientRect());
                onTouch(x, y, 'move');
            },
            onWheel: (e: React.WheelEvent) => {
                if (!allowTouch || !onScroll || !canvasRef.current) return;
                e.preventDefault();
                const { x, y } = getXY(e, canvasRef.current.getBoundingClientRect());
                onScroll(x, y, Math.round(e.deltaX), Math.round(e.deltaY));
            }
        };
    }, [allowTouch, onTouch, onScroll, width, height]);

    return (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
            <canvas
                ref={canvasRef}
                className={`max-w-full max-h-full object-contain ${allowTouch ? 'cursor-pointer' : ''}`}
                onMouseDown={handleEvents.onMouseDown}
                onMouseUp={handleEvents.onMouseUp}
                onMouseMove={handleEvents.onMouseMove}
                onMouseLeave={handleEvents.onMouseUp}
                onWheel={handleEvents.onWheel}
            />

            {/* Loading / Status */}
            {!isConnected && (
                <div className="absolute flex flex-col items-center justify-center text-text-muted pointer-events-none">
                    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2" />
                    <span className="text-sm">{t.connectingStream}</span>
                </div>
            )}

            {/* FPS Counter */}
            {showFps && (
                <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 bg-black/60 backdrop-blur rounded-full pointer-events-none">
                    <span
                        className={`w-2 h-2 rounded-full ${isConnected && fps > 0 ? 'bg-success animate-pulse' : 'bg-warning'}`}
                    />
                    <span className="text-[10px] font-mono text-white">
                        {fps} {t.fps}
                    </span>
                </div>
            )}
        </div>
    );
}
