import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Trash2,
  Pause,
  Download,
  Search,
  X,
  FastForward,
} from "lucide-react";
import { type UnlistenFn } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Select } from "./ui/Select";
import { AppTooltip } from "./ui/Tooltip";
import { useDeviceStore } from "../stores/deviceStore";
import { useLanguage } from "../hooks/useLanguage";
import * as tauri from "../lib/tauri";
import { getVersion } from "@tauri-apps/api/app";

type LogLevel = "V" | "D" | "I" | "W" | "E";

interface LogLine {
  id: number;
  text: string;
  level: LogLevel;
}

const APP_NAME_MAP: Record<string, string> = {
  // Social & Messaging
  "com.facebook.katana": "Facebook",
  "com.facebook.orca": "Messenger",
  "com.instagram.android": "Instagram",
  "com.zhiliaoapp.musically": "TikTok",
  "com.ss.android.ugc.trill": "TikTok",
  "com.whatsapp": "WhatsApp",
  "com.twitter.android": "X (Twitter)",
  "com.snapchat.android": "Snapchat",
  "com.linkedin.android": "LinkedIn",
  "org.telegram.messenger": "Telegram",
  "com.zing.zalo": "Zalo",
  "com.discord": "Discord",
  "com.reddit.frontpage": "Reddit",
  "com.pinterest": "Pinterest",
  "com.tumblr": "Tumblr",
  "jp.naver.line.android": "LINE",
  "com.viber.voip": "Viber",
  "com.skype.raider": "Skype",
  "us.zoom.videomeetings": "Zoom",

  // Google Suite
  "com.google.android.youtube": "YouTube",
  "com.google.android.gm": "Gmail",
  "com.google.android.apps.maps": "Maps",
  "com.android.chrome": "Chrome",
  "com.android.vending": "Play Store",
  "com.google.android.gms": "Google Play Services",
  "com.google.android.googlequicksearchbox": "Google",
  "com.google.android.apps.photos": "Photos",
  "com.google.android.calendar": "Calendar",
  "com.google.android.deskclock": "Clock",
  "com.google.android.calculator": "Calculator",
  "com.google.android.contacts": "Contacts",
  "com.google.android.apps.messaging": "Messages",
  "com.google.android.keep": "Keep Notes",
  "com.google.android.apps.docs": "Drive",
  "com.google.android.apps.docs.editors.docs": "Docs",
  "com.google.android.apps.docs.editors.sheets": "Sheets",
  "com.google.android.apps.docs.editors.slides": "Slides",
  "com.google.android.focus": "Focus",
  "com.google.android.apps.translate": "Translate",
  "com.google.android.music": "Play Music",
  "com.google.android.videos": "Play Movies",
  "com.google.android.apps.focus": "Focus",
  "com.google.android.apps.tachyon": "Duo",

  // Entertainment & Media
  "com.spotify.music": "Spotify",
  "com.netflix.mediaclient": "Netflix",
  "com.amazon.avod.thirdpartyclient": "Prime Video",
  "com.disney.disneyplus": "Disney+",
  "tv.twitch.android.app": "Twitch",
  "com.soundcloud.android": "SoundCloud",
  "com.shazam.android": "Shazam",

  // Shopping & Tools
  "com.amazon.mShop.android.shopping": "Amazon Shopping",
  "com.ebay.mobile": "eBay",
  "com.alibaba.aliexpresshd": "AliExpress",
  "com.shopee.vn": "Shopee",
  "com.shopee.ph": "Shopee",
  "com.shopee.my": "Shopee",
  "com.shopee.id": "Shopee",
  "com.shopee.th": "Shopee",
  "com.shopee.tw": "Shopee",
  "com.lazada.android": "Lazada",
  "com.grabtaxi.passenger": "Grab",
  "com.ubercab": "Uber",
  "com.gojek.app": "Gojek",
  "com.booking": "Booking.com",
  "com.airbnb.android": "Airbnb",

  // Microsoft
  "com.microsoft.office.outlook": "Outlook",
  "com.microsoft.teams": "Teams",
  "com.microsoft.office.word": "Word",
  "com.microsoft.office.excel": "Excel",
  "com.microsoft.office.powerpoint": "PowerPoint",
  "com.microsoft.emmx": "Edge",
  "com.microsoft.office.officehubrow": "Office",

  // System
  "com.android.settings": "Settings",
  "com.android.camera": "Camera",
  "com.android.systemui": "System UI",
  "com.android.phone": "Phone",
  "com.android.documentsui": "Files",
  "com.sec.android.app.myfiles": "My Files (Samsung)",
  "com.mi.android.globalFileexplorer": "File Manager (Xiaomi)",
};

const formatAppLabel = (pkg: string): string => {
  if (APP_NAME_MAP[pkg]) return APP_NAME_MAP[pkg];
  const parts = pkg.split(".");
  if (parts.length > 0) {
    if (
      parts.length > 4 &&
      parts[0] === "com" &&
      parts[1] === "google" &&
      parts[2] === "android" &&
      parts[3] === "apps"
    ) {
      const name = parts[4];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    const last = parts[parts.length - 1];
    if (last === "android" && parts.length > 1) {
      const prev = parts[parts.length - 2];
      return prev.charAt(0).toUpperCase() + prev.slice(1);
    }
    return last.charAt(0).toUpperCase() + last.slice(1);
  }
  return pkg;
};

const parseLinePid = (text: string): string | null => {
  const match = text.match(/^\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\s+(\d+)/);
  return match ? match[1] : null;
};

interface ParsedLogLine {
  time: string;
  pid: string;
  tid: string;
  level: string;
  tag: string;
  message: string;
}

// Parse the standard `threadtime` logcat format into columns for rich display.
const LOGCAT_RE =
  /^(\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+(.+?):\s?(.*)$/;

const parseLogcatLine = (text: string): ParsedLogLine | null => {
  // Batch history (get_logcat) is split on \n and can retain a trailing \r on
  // Windows, which breaks the `$` anchor — strip it so parsing is consistent
  // with the live stream.
  const m = text.replace(/[\r\n]+$/, "").match(LOGCAT_RE);
  if (!m) return null;
  return {
    time: m[1],
    pid: m[2],
    tid: m[3],
    level: m[4],
    tag: m[5],
    message: m[6],
  };
};

export function LogcatView() {
  const { t } = useLanguage();
  const selectedDevice = useDeviceStore((s) => s.selectedDeviceId) ?? "";
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [logLevel, setLogLevel] = useState<LogLevel>("V");
  const [searchQuery, setSearchQuery] = useState("");
  const [maxLines, setMaxLines] = useState(1000);
  const [isAtBottom, setIsAtBottom] = useState(true);
  // Verbose columns (line#, timestamp, pid/tid). Off by default for a clean
  // level + tag + message view.
  const [showDetails, setShowDetails] = useState(false);

  const [foregroundPackage, setForegroundPackage] = useState<string | null>(null);
  const [appPids, setAppPids] = useState<Record<string, string[]>>({});
  const [appLabels, setAppLabels] = useState<Record<string, string>>({});
  const [selectedApp, setSelectedApp] = useState<string>("all");
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedDevice) {
      setForegroundPackage(null);
      setAppPids({});
      setAppLabels({});
      return;
    }

    let isMounted = true;

    const fetchApps = async () => {
      try {
        // 1. Get installed packages with labels
        const apps = await tauri.getAppsFull<{ id: string; label?: string }[]>(selectedDevice, true);
        if (!isMounted) return;

        const nextLabels: Record<string, string> = {};
        const pkgSet = new Set<string>();
        for (const app of apps) {
          pkgSet.add(app.id);
          nextLabels[app.id] = app.label || formatAppLabel(app.id);
        }

        // 2. Get running processes
        const psOutput = await tauri.executeShell(selectedDevice, "ps -A || ps");
        if (!isMounted) return;

        const lines = psOutput.split("\n");
        const nextAppPids: Record<string, string[]> = {};

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parts = trimmed.split(/\s+/);
          if (parts.length < 9) continue;
          const pid = parts[1];
          const name = parts[parts.length - 1];

          const basePackage = name.split(":")[0];
          if (pkgSet.has(basePackage)) {
            if (!nextAppPids[basePackage]) {
              nextAppPids[basePackage] = [];
            }
            nextAppPids[basePackage].push(pid);
          }
        }

        // 3. Get foreground app
        const focusOutput = await tauri.executeShell(selectedDevice, "dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'");
        if (!isMounted) return;

        const match = focusOutput.match(/([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/);
        const fgPackage = match ? match[1] : null;

        // 4. Update state
        setAppLabels(nextLabels);
        setAppPids(nextAppPids);
        setForegroundPackage(fgPackage);
      } catch (err) {
        console.error("Failed to fetch running apps for logcat:", err);
      }
    };

    fetchApps();
    const interval = setInterval(fetchApps, 4000); // refresh every 4 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedDevice]);

  const appOptions = useMemo(() => {
    const options = [];

    // Option 1: Foreground
    const fgLabel = foregroundPackage ? (appLabels[foregroundPackage] || foregroundPackage) : null;
    options.push({
      value: "foreground",
      label: fgLabel ? `Foreground: ${fgLabel}` : "Foreground App (None)",
    });

    // Option 2: All
    options.push({
      value: "all",
      label: "All Logs",
    });

    return options;
  }, [foregroundPackage, appLabels]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logCounter = useRef(0);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const selectedDeviceRef = useRef<string>("");
  const pausedRef = useRef(false);
  const logBufferRef = useRef<LogLine[]>([]);
  const incomingBufferRef = useRef<LogLine[]>([]);
  const maxLinesRef = useRef(1000);
  const isAtBottomRef = useRef(true);

  // Keep refs in sync
  useEffect(() => {
    maxLinesRef.current = maxLines;
  }, [maxLines]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  };

  // Keep refs in sync
  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);

  useEffect(() => {
    pausedRef.current = paused;
    // If unpaused, flush buffer
    if (!paused && logBufferRef.current.length > 0) {
      const buffered = [...logBufferRef.current];
      logBufferRef.current = [];
      setLogLines((prev) => {
        const updated = [...prev, ...buffered];
        return updated.slice(-maxLines);
      });
    }
  }, [paused, maxLines]);

  // Reset log buffers when the active device changes.
  useEffect(() => {
    setLogLines([]);
    logBufferRef.current = [];
    incomingBufferRef.current = [];
    logCounter.current = 0;
  }, [selectedDevice]);

  // Periodically flush incoming logs to state (every 250ms) to throttle updates and prevent UI freezing.
  useEffect(() => {
    if (!selectedDevice) return;

    const interval = setInterval(() => {
      if (incomingBufferRef.current.length > 0 && !pausedRef.current) {
        const buffered = [...incomingBufferRef.current];
        incomingBufferRef.current = [];
        setLogLines((prev) => {
          const updated = [...prev, ...buffered];
          return updated.slice(-maxLinesRef.current);
        });
      }
    }, 250);

    return () => clearInterval(interval);
  }, [selectedDevice]);

  // Streaming logic linked to selectedDevice
  useEffect(() => {
    if (!selectedDevice) return;

    let isMounted = true;
    let currentUnlisten: UnlistenFn | null = null;

        const startStream = async () => {
          try {
            // 1. Clean up existing stream for THIS device first (just in case)
            await tauri.stopLogcatStream(selectedDevice);

            if (!isMounted) return;

            // 2. Start listening FIRST to avoid missing early logs
            currentUnlisten = await tauri.onLogcatLine(
              selectedDevice,
              (lines) => {
            if (!isMounted) return;

            const newLines = lines.map((text: string) => ({
              id: logCounter.current++,
              text,
              level: parseLogLevel(text),
            }));

            if (pausedRef.current) {
              logBufferRef.current.push(...newLines);
              if (logBufferRef.current.length > 5000) {
                logBufferRef.current = logBufferRef.current.slice(-5000);
              }
            } else {
              incomingBufferRef.current.push(...newLines);
              if (incomingBufferRef.current.length > maxLinesRef.current) {
                incomingBufferRef.current = incomingBufferRef.current.slice(-maxLinesRef.current);
              }
            }
          }
        );

        if (!isMounted) {
          if (currentUnlisten) currentUnlisten();
          return;
        }
        unlistenRef.current = currentUnlisten;

        // 3. Invoke backend to start streaming
        await tauri.startLogcatStream(selectedDevice);
      } catch (err) {
        if (isMounted) {
          console.error("Streaming error:", err);
          toast.error(`Failed to stream Logcat: ${err}`);
        }
      }
    };

    startStream();

    return () => {
      isMounted = false;
      if (currentUnlisten) {
        currentUnlisten();
        unlistenRef.current = null;
      }
      tauri.stopLogcatStream(selectedDevice).catch(
        console.error
      );
    };
  }, [selectedDevice]);

  // Fetch history when level changes or device changes
  useEffect(() => {
    if (!selectedDevice) return;

    const fetchHistory = async () => {
      try {
        const filterStr = logLevel === "V" ? undefined : `*:${logLevel}`;
        const history = await tauri.getLogcat(
          selectedDevice,
          maxLinesRef.current,
          filterStr,
        );

        if (history) {
          const processedLines = history
            .split("\n")
            .filter((l) => l.trim() && !l.includes("--------- beginning of"))
            .map((text) => ({
              id: logCounter.current++,
              text,
              level: parseLogLevel(text),
            }));

          setLogLines(processedLines);
          if (isAtBottomRef.current) {
            logsEndRef.current?.scrollIntoView({ behavior: "auto" });
          }
        }
      } catch (err) {
        console.error("Failed to fetch log history:", err);
      }
    };

    fetchHistory();
  }, [selectedDevice, logLevel]);

  const parseLogLevel = (line: string): LogLevel => {
    // Matches " E ", "/E ", " E/", or "[E]" patterns in logcat output
    const match = line.match(/\s([VDIWE])\s|([VDIWE])\/|\[([VDIWE])\]/);
    if (match) {
      return (match[1] || match[2] || match[3]) as LogLevel;
    }
    return "V";
  };

  const getLogLevelPriority = (level: LogLevel): number => {
    const priorities: Record<LogLevel, number> = {
      V: 0,
      D: 1,
      I: 2,
      W: 3,
      E: 4,
    };
    return priorities[level];
  };

  // Resolve selected app to target package
  const targetPackage = useMemo(() => {
    if (selectedApp === "all") return null;
    if (selectedApp === "foreground") return foregroundPackage;
    return selectedApp;
  }, [selectedApp, foregroundPackage]);

  // Get active PIDs for the target package
  const targetPids = useMemo(() => {
    if (!targetPackage) return null;
    return appPids[targetPackage] || [];
  }, [targetPackage, appPids]);

  const filteredLogs = useMemo(() => {
    const minPriority = getLogLevelPriority(logLevel);
    return logLines.filter((line) => {
      const matchesLevel = getLogLevelPriority(line.level) >= minPriority;
      const matchesSearch =
        searchQuery.trim() === "" ||
        line.text.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesLevel || !matchesSearch) return false;
      if (!targetPackage) return true;

      // Filter by PID
      const linePid = parseLinePid(line.text);
      return linePid && targetPids ? targetPids.includes(linePid) : false;
    });
  }, [logLines, logLevel, searchQuery, targetPackage, targetPids]);

  useEffect(() => {
    if (!paused && isAtBottomRef.current && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [filteredLogs, paused]);

  const handleClear = async () => {
    if (!selectedDevice) return;
    try {
      await tauri.clearLogcat(selectedDevice);
      setLogLines([]);
      logBufferRef.current = [];
      toast.success("Logcat buffer cleared");
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleExport = async () => {
    try {
      const content = filteredLogs.map((l) => l.text).join("\n");
      const path = await save({
        filters: [{ name: "Log", extensions: ["log", "txt"] }],
        defaultPath: `logcat_${selectedDevice}_${new Date().getTime()}.log`,
      });

      if (path) {
        await tauri.saveCaptureFile({
          path,
          content: btoa(unescape(encodeURIComponent(content))),
        });
        toast.success("Logs exported successfully");
      }
    } catch (err) {
      toast.error("Failed to export logs");
    }
  };

  // Per-level styling: a colored badge + a message tint (errors/warnings stand
  // out, the rest stay readable in the default body color).
  const levelStyles: Record<LogLevel, { badge: string; msg: string }> = {
    V: { badge: "bg-text-muted/15 text-text-muted", msg: "text-text-secondary" },
    D: { badge: "bg-sky-500/15 text-sky-400", msg: "text-text-secondary" },
    I: { badge: "bg-success/15 text-success", msg: "text-text-primary" },
    W: { badge: "bg-warning/20 text-warning", msg: "text-warning" },
    E: { badge: "bg-error/20 text-error", msg: "text-error" },
  };

  const logLevels: { value: LogLevel; label: string; color: string }[] = [
    { value: "V", label: "Verbose", color: "text-text-muted" },
    { value: "D", label: "Debug", color: "text-text-secondary" },
    { value: "I", label: "Info", color: "text-accent" },
    { value: "W", label: "Warning", color: "text-warning" },
    { value: "E", label: "Error", color: "text-error" },
  ];

  const limitOptions = [
    { value: "500", label: "500 lines" },
    { value: "1000", label: "1000 lines" },
    { value: "2000", label: "2000 lines" },
    { value: "5000", label: "5000 lines" },
  ];

  return (
    <motion.div
      className="flex flex-col h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Status + actions */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          {/* Combined Status + Pause/Resume Button */}
          <button
            onClick={() => setPaused(!paused)}
            disabled={!selectedDevice}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm font-medium cursor-pointer ${
              paused
                ? "bg-surface-elevated border-border text-text-muted hover:text-text-primary"
                : "bg-success/10 border-success/30 text-success hover:border-success/50"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span
              className={`flex h-2 w-2 rounded-full shrink-0 ${
                !paused && selectedDevice ? "bg-success animate-pulse" : "bg-text-muted"
              }`}
            />
            <span>{!paused && selectedDevice ? t.liveStreaming : t.paused}</span>
          </button>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={logLines.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-secondary hover:text-text-primary transition-all text-sm font-medium disabled:opacity-50 cursor-pointer"
          >
            <Download size={14} />
            <span>Export</span>
          </button>

          {/* Clear Button */}
          <AppTooltip content="Clear device buffer">
            <button
              onClick={handleClear}
              disabled={!selectedDevice}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-secondary hover:text-error transition-all text-sm font-medium disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Clear</span>
            </button>
          </AppTooltip>
        </div>

        <div className="flex-1" />

        {/* App selector dropdown */}
        <div className="flex items-center gap-2">
          <div className="w-64">
            <Select
              options={appOptions}
              value={selectedApp}
              onChange={(val) => setSelectedApp(val)}
              placeholder="Filter by App"
              disabled={!selectedDevice}
            />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-surface-elevated border border-border rounded-xl p-3 mb-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 relative group">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent transition-colors"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchLogs}
              className="w-full bg-surface-card border border-border rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-accent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="w-36">
            <Select
              options={limitOptions}
              value={String(maxLines)}
              onChange={(val) => setMaxLines(Number(val))}
              placeholder="Buffer limit"
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mr-2">
            {t.minimumLevel}:
          </span>
          {logLevels.map((level) => (
            <button
              key={level.value}
              onClick={() => setLogLevel(level.value)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                logLevel === level.value
                  ? "bg-accent text-white shadow-sm"
                  : `bg-surface-card ${level.color} border border-border/50 hover:bg-surface-card-hover`
              }`}
            >
              {level.label}
            </button>
          ))}

          {/* Detailed logcat toggle: shows the line#/time/pid-tid columns. */}
          <button
            type="button"
            role="switch"
            aria-checked={showDetails}
            onClick={() => setShowDetails((v) => !v)}
            className="ml-auto flex items-center gap-2"
            title="Show timestamp & PID columns"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              {t.details}
            </span>
            <span
              className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors ${
                showDetails
                  ? "bg-accent"
                  : "bg-surface-elevated border border-border"
              }`}
            >
              <span
                className={`absolute top-[2px] h-[13px] w-[13px] rounded-full shadow transition-all ${
                  showDetails ? "left-[16px] bg-white" : "left-[2px] bg-text-muted"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Logs Content Container */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Logs Content */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto font-mono text-[11px] bg-surface-card border border-border rounded-xl p-4 custom-scrollbar selection:bg-accent/30"
        >
        {selectedDevice ? (
          filteredLogs.length > 0 ? (
            <div className="space-y-px">
              {filteredLogs.map((line) => {
                const p = parseLogcatLine(line.text);
                const lvl = ((p?.level as LogLevel) ?? line.level) as LogLevel;
                const st = levelStyles[lvl] ?? levelStyles.V;
                return (
                  <div
                    key={line.id}
                    className="group flex items-start gap-2 px-1.5 py-[1px] rounded hover:bg-surface-hover/40 transition-colors leading-[1.55]"
                  >
                    {showDetails && (
                      <span className="opacity-20 select-none w-9 text-right shrink-0 tabular-nums">
                        {line.id}
                      </span>
                    )}
                    {p ? (
                      <>
                        {showDetails && (
                          <span className="shrink-0 w-[126px] whitespace-nowrap text-text-muted/50 tabular-nums">
                            {p.time}
                          </span>
                        )}
                        {showDetails && (
                          <span className="shrink-0 w-[88px] whitespace-nowrap text-right text-text-muted/30 tabular-nums hidden md:inline-block">
                            {p.pid}-{p.tid}
                          </span>
                        )}
                        <span
                          className={`shrink-0 w-[17px] text-center rounded font-bold ${st.badge}`}
                        >
                          {lvl}
                        </span>
                        <span
                          className="shrink-0 max-w-[170px] truncate font-medium text-accent"
                          title={p.tag}
                        >
                          {p.tag}
                        </span>
                        <span
                          className={`min-w-0 flex-1 break-all whitespace-pre-wrap ${st.msg}`}
                        >
                          {p.message}
                        </span>
                      </>
                    ) : (
                      <span
                        className={`min-w-0 flex-1 break-all whitespace-pre-wrap ${st.msg}`}
                      >
                        {line.text}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2">
              {!paused ? (
                <>
                  <Loader size={24} className="animate-spin opacity-20" />
                  <p className="text-sm">{t.waitingForLogs}</p>
                </>
              ) : (
                <p className="text-sm">{t.streamPaused}</p>
              )}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2">
            <FileText size={48} className="opacity-10" />
            <p className="text-sm">{t.selectDeviceToStream}</p>
          </div>
        )}
          <div ref={logsEndRef} />
        </div>

        {/* Floating Scroll to Bottom Button */}
        <AnimatePresence>
          {!isAtBottom && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              onClick={() => {
                isAtBottomRef.current = true;
                setIsAtBottom(true);
                logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              className="absolute bottom-6 right-8 bg-accent text-white px-4 py-2 rounded-full shadow-lg hover:bg-accent-secondary transition-all flex items-center gap-2 text-xs font-bold z-20 border border-white/10"
            >
              <FastForward size={14} className="rotate-90" />
              New Logs
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2 px-2 flex justify-between items-center text-[10px] text-text-muted font-medium">
        <div className="flex items-center gap-4">
          <span>
            Showing {filteredLogs.length} of {logLines.length} lines
          </span>
          {paused && (
            <span className="text-warning flex items-center gap-1">
              <Pause size={8} /> Stream Paused
            </span>
          )}
        </div>
        <span>ADB Compass {appVersion ? `v${appVersion}` : ""}</span>
      </div>
    </motion.div>
  );
}

const Loader = ({ size, className }: { size: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
