// StreamPlayer - Display JPEG frames from scrcpy stream
import { useEffect, useRef, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';

interface StreamPlayerProps {
    deviceId: string;
    port: number;
    width: number;
    height: number;
    onTouch?: (x: number, y: number, action: 'down' | 'up' | 'move') => void;
    onScroll?: (x: number, y: number, deltaX: number, deltaY: number) => void;
    allowTouch?: boolean;
}

export function StreamPlayer({
    deviceId,
    width,
    height,
    onTouch,
    onScroll,
    allowTouch = false,
}: StreamPlayerProps) {
    const [imageData, setImageData] = useState<string | null>(null);
    const [fps, setFps] = useState(0);
    const [isConnected, setIsConnected] = useState(false);
    const frameCountRef = useRef(0);
    const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // FPS counter
    useEffect(() => {
        const interval = setInterval(() => {
            setFps(frameCountRef.current);
            frameCountRef.current = 0;
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Listen for frame events
    useEffect(() => {
        if (!deviceId) return;

        console.log(`[StreamPlayer] Listening for scrcpy-frame-${deviceId}`);

        const unlisten = listen<string>(`scrcpy-frame-${deviceId}`, (event) => {
            // event.payload is base64 JPEG data
            setImageData(`data:image/jpeg;base64,${event.payload}`);
            frameCountRef.current++;
            if (!isConnected) setIsConnected(true);
        });

        return () => {
            unlisten.then((fn) => fn());
            setIsConnected(false);
        };
    }, [deviceId, isConnected]);

    // Mouse handlers for touch
    const handleMouseDown = useCallback(
        (e: React.MouseEvent<HTMLImageElement>) => {
            if (!allowTouch || !onTouch || !imgRef.current) return;
            const rect = imgRef.current.getBoundingClientRect();
            const x = Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * width));
            const y = Math.max(0, Math.round(((e.clientY - rect.top) / rect.height) * height));
            lastTouchRef.current = { x, y };
            onTouch(x, y, 'down');
        },
        [allowTouch, onTouch, width, height]
    );

    const handleMouseUp = useCallback(
        (e: React.MouseEvent<HTMLImageElement>) => {
            if (!allowTouch || !onTouch || !imgRef.current) return;
            const rect = imgRef.current.getBoundingClientRect();
            const x = Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * width));
            const y = Math.max(0, Math.round(((e.clientY - rect.top) / rect.height) * height));
            lastTouchRef.current = null;
            onTouch(x, y, 'up');
        },
        [allowTouch, onTouch, width, height]
    );

    const handleMouseMove = useCallback(
        (e: React.MouseEvent<HTMLImageElement>) => {
            if (!allowTouch || !onTouch || !lastTouchRef.current || !imgRef.current) return;
            const rect = imgRef.current.getBoundingClientRect();
            const x = Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * width));
            const y = Math.max(0, Math.round(((e.clientY - rect.top) / rect.height) * height));
            onTouch(x, y, 'move');
        },
        [allowTouch, onTouch, width, height]
    );

    const handleWheel = useCallback(
        (e: React.WheelEvent<HTMLImageElement>) => {
            if (!allowTouch || !onScroll || !imgRef.current) return;
            e.preventDefault();
            const rect = imgRef.current.getBoundingClientRect();
            const x = Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * width));
            const y = Math.max(0, Math.round(((e.clientY - rect.top) / rect.height) * height));
            onScroll(x, y, Math.round(e.deltaX), Math.round(e.deltaY));
        },
        [allowTouch, onScroll, width, height]
    );

    return (
        <div className="relative w-full h-full flex items-center justify-center">
            {imageData ? (
                <img
                    ref={imgRef}
                    src={imageData}
                    alt="Screen"
                    className={`max-w-full max-h-full object-contain ${allowTouch ? 'cursor-pointer' : ''}`}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                    draggable={false}
                />
            ) : (
                <div className="flex flex-col items-center justify-center text-text-muted">
                    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2" />
                    <span className="text-sm">Connecting...</span>
                </div>
            )}

            {/* FPS Counter */}
            <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 bg-black/60 backdrop-blur rounded-full">
                <span
                    className={`w-2 h-2 rounded-full ${isConnected && fps > 0 ? 'bg-success animate-pulse' : 'bg-warning'
                        }`}
                />
                <span className="text-[10px] font-mono text-white">
                    {fps} FPS
                </span>
            </div>
        </div>
    );
}
