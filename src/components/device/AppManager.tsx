import { useState, useEffect, useMemo, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Search,
  Trash2,
  Loader2,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  RefreshCw,
  Grid,
  List as ListIcon,
  ArrowLeft,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { DeviceInfo } from "../../types";
import { useDeviceCache } from "../../contexts/DeviceCacheContext";
import { useLanguage } from "../../contexts/LanguageContext";

interface AppManagerProps {
  device: DeviceInfo;
}

interface AppPackage {
  id: string;
  label?: string;
  icon?: string;
}

// Helper to formatting package name to display name
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
  "com.google.android.apps.translate": "Translate",
  "com.google.android.music": "Play Music",
  "com.google.android.videos": "Play Movies",
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

// Helper to formatting package name to display name
const formatAppLabel = (pkg: string) => {
  // Check map first
  if (APP_NAME_MAP[pkg]) return APP_NAME_MAP[pkg];

  // Fallback: Smart parsing
  const parts = pkg.split(".");
  if (parts.length > 0) {
    // Handle common prefixes like com.google.android.apps.X
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
    // If last part is 'android' (common in weird pkgs), take previous
    if (last === "android" && parts.length > 1) {
      const prev = parts[parts.length - 2];
      return prev.charAt(0).toUpperCase() + prev.slice(1);
    }

    return last.charAt(0).toUpperCase() + last.slice(1);
  }
  return pkg;
};

// Memoized Item Component for peak performance
const AppCard = memo(
  ({
    pkg,
    index,
    viewMode,
    onUninstall,
    t,
    isUninstalling,
    confirmUninstall,
    setConfirmUninstall,
  }: any) => {
    const displayLabel = (pkg as any).displayName || pkg.label || pkg.id;

    return (
      <motion.div
        layout="position"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{
          duration: 0.2,
          // Smart Stagger: Only stagger first 40 items for performance
          delay: index < 40 ? index * 0.03 : 0,
        }}
        className={`group relative bg-surface-card border border-border rounded-xl hover:border-accent/30 transition-colors ${
          viewMode === "list"
            ? "flex items-center gap-3 p-3"
            : "p-4 flex flex-col items-center text-center gap-2"
        }`}
      >
        <div
          className={`rounded-xl flex items-center justify-center shrink-0 bg-accent/10 overflow-hidden ${
            viewMode === "list" ? "w-10 h-10" : "w-12 h-12"
          }`}
        >
          {pkg.icon ? (
            <img
              src={`data:image/png;base64,${pkg.icon}`}
              alt={displayLabel}
              className="w-full h-full object-contain"
            />
          ) : (
            <Package
              className="text-accent"
              size={viewMode === "list" ? 20 : 24}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold text-text-primary truncate"
            title={displayLabel}
          >
            {displayLabel}
          </p>
          <p
            className="text-xs text-text-muted truncate font-mono opacity-80"
            title={pkg.id}
          >
            {pkg.id}
          </p>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {confirmUninstall === pkg.id ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUninstall(pkg.id)}
                className="p-1.5 rounded-lg bg-error/20 text-error hover:bg-error/30 transition-colors"
                title={t.confirm}
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={() => setConfirmUninstall(null)}
                className="p-1.5 rounded-lg bg-surface-elevated text-text-muted hover:text-text-primary transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmUninstall(pkg.id)}
              disabled={isUninstalling !== null}
              className="p-2 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-all duration-200"
              title={t.uninstall}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>

        {isUninstalling === pkg.id && (
          <div className="absolute inset-0 bg-surface-card/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-10">
            <Loader2 size={20} className="animate-spin text-accent" />
          </div>
        )}
      </motion.div>
    );
  }
);

export function AppManager({ device }: AppManagerProps) {
  const [packages, setPackages] = useState<AppPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSystem, setShowSystem] = useState(false);
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { getCached, setData } = useDeviceCache();
  const { t } = useLanguage();

  const fetchPackages = async () => {
    const cacheKey = `packages_${device.id}_${showSystem}`;

    // 1. Try cache
    const { data, isStale } = getCached<AppPackage[]>(cacheKey);
    if (data) {
      setPackages(data);
      if (!isStale) {
        setLoading(false);
        return;
      }
    }

    if (!data) setLoading(true);
    setError(null);

    // Start spinning minimum 0.5s
    const spinStart = Date.now();

    try {
      const result = await invoke<AppPackage[]>("get_apps_full", {
        deviceId: device.id,
        includeSystem: showSystem,
      });

      // Pre-process packages (map labels once)
      const processed = result.map((pkg) => ({
        ...pkg,
        displayName: pkg.label || formatAppLabel(pkg.id),
      }));

      // Sort once by pre-calculated displayName
      const sorted = processed.sort((a, b) =>
        (a as any).displayName.localeCompare((b as any).displayName)
      );

      setPackages(sorted);
      setData(cacheKey, sorted);
      // Reset scroll position when new data is set
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    } catch (e) {
      setError(String(e));
    } finally {
      // Ensure minimum 500ms spin
      const elapsed = Date.now() - spinStart;
      const remaining = Math.max(0, 500 - elapsed);
      setTimeout(() => setLoading(false), remaining);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, [device.id, showSystem]);

  const filteredPackages = useMemo(() => {
    if (!searchQuery.trim()) return packages;
    const query = searchQuery.toLowerCase();
    return packages.filter((pkg) => {
      const label = (pkg as any).displayName || pkg.label || pkg.id;
      return (
        label.toLowerCase().includes(query) ||
        pkg.id.toLowerCase().includes(query)
      );
    });
  }, [packages, searchQuery]);

  const handleUninstall = async (packageName: string) => {
    setUninstalling(packageName);
    setConfirmUninstall(null);
    try {
      await invoke("uninstall_app", {
        deviceId: device.id,
        packageName,
      });
      toast.success(t.appUninstalled, { description: packageName });
      setPackages((prev) => prev.filter((p) => p.id !== packageName));
    } catch (e) {
      toast.error(t.uninstallFailed, { description: String(e) });
    } finally {
      setUninstalling(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder={t.searchPackages}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
          />
        </div>

        <div className="flex bg-surface-elevated rounded-xl border border-border p-1">
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === "list"
                ? "bg-surface-card text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <ListIcon size={16} />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === "grid"
                ? "bg-surface-card text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Grid size={16} />
          </button>
        </div>

        <button
          onClick={() => setShowSystem(!showSystem)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
            showSystem
              ? "bg-accent/10 border-accent/30 text-accent"
              : "bg-surface-elevated border-border text-text-muted hover:text-text-secondary"
          }`}
          title={showSystem ? t.showingAllApps : t.showingUserAppsOnly}
        >
          {showSystem ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          {t.system}
        </button>

        <button
          onClick={fetchPackages}
          disabled={loading}
          className="p-2.5 rounded-xl bg-surface-elevated border border-border text-text-muted hover:text-text-primary hover:border-accent transition-all disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Package Count */}
      <div className="text-xs text-text-muted mb-3 flex justify-between">
        <span>
          {loading
            ? t.loadingDots
            : `${filteredPackages.length} ${t.packagesFound}`}
        </span>
        <span>{showSystem ? t.allApps : t.userAppsOnly}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {/* Subtle loading overlay when refreshing */}
        {loading && packages.length > 0 && (
          <div className="absolute top-0 left-0 right-0 z-10 flex justify-center pointer-events-none">
            <div className="bg-accent/10 backdrop-blur-sm px-3 py-1 rounded-b-lg border-x border-b border-accent/20 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-accent" />
              <span className="text-[10px] font-medium text-accent uppercase tracking-wider">
                {t.loadingDots}
              </span>
            </div>
          </div>
        )}

        <div
          ref={scrollContainerRef}
          className={`h-full overflow-y-auto custom-scrollbar pr-2 transition-opacity duration-300 ${
            loading && packages.length === 0 ? "opacity-0" : "opacity-100"
          }`}
        >
          {loading && packages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <Loader2 size={32} className="animate-spin text-accent" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-error">
              <AlertTriangle size={32} className="mb-2 opacity-60" />
              <p className="text-sm">{error}</p>
            </div>
          ) : filteredPackages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-text-muted">
              <Package size={32} className="mb-2 opacity-40" />
              <p className="text-sm">{t.noPackagesFound}</p>
            </div>
          ) : (
            <div
              className={
                viewMode === "list"
                  ? "space-y-2"
                  : "grid grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-fr"
              }
            >
              <AnimatePresence mode="popLayout" initial={true}>
                {filteredPackages.map((pkg, index) => (
                  <AppCard
                    key={pkg.id}
                    pkg={pkg}
                    index={index}
                    viewMode={viewMode}
                    t={t}
                    onUninstall={handleUninstall}
                    isUninstalling={uninstalling}
                    confirmUninstall={confirmUninstall}
                    setConfirmUninstall={setConfirmUninstall}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
