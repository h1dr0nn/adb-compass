import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Info,
  Loader2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  nextToastId,
  useToastStore,
  type ToastAction,
  type ToastItem,
  type ToastVariant,
} from "../../stores/toastStore";

interface VariantStyle {
  icon: LucideIcon;
  color: string;
  spin?: boolean;
}

// CSS vars drive the accent colors so the toast tracks the active theme.
const VARIANTS: Record<ToastVariant, VariantStyle> = {
  success: { icon: Check, color: "text-[var(--color-success)]" },
  error: { icon: AlertTriangle, color: "text-[var(--color-error)]" },
  info: { icon: Info, color: "text-[var(--color-accent)]" },
  default: { icon: Info, color: "text-text-muted" },
  loading: { icon: Loader2, color: "text-text-muted", spin: true },
};

const DEFAULT_DURATION = 4000;
const COPIED_RESET_MS = 1000;

interface AppToastOptions {
  /** The notification source/area, e.g. "Device Screen", "Install failed". */
  title: string;
  /** Optional detail line under the title. */
  description?: string;
  variant?: ToastVariant;
  /** Render the description as a click-to-copy code block (errors, paths).
   * Defaults to true only for the error variant. Ignored when `action` is set. */
  copyable?: boolean;
  /** Add a direct-action text link to a plain description row. */
  action?: ToastAction;
  duration?: number;
  /** Stable id, so a loading toast can be updated or dismissed by reference. */
  id?: string | number;
}

/** Show an app notification. Single entry point so every toast stays consistent. */
export function appToast({
  title,
  description,
  variant = "default",
  copyable,
  action,
  duration,
  id,
}: AppToastOptions): string {
  const toastId = id != null ? String(id) : nextToastId();
  useToastStore.getState().add({
    id: toastId,
    title,
    description,
    variant,
    // Errors default to a copyable code block; an action forces a plain row.
    copyable: action ? false : copyable ?? variant === "error",
    action,
    duration: duration ?? (variant === "loading" ? Infinity : DEFAULT_DURATION),
  });
  return toastId;
}

appToast.dismiss = (id?: string | number) =>
  useToastStore.getState().remove(id == null ? undefined : String(id));

function CopyableDescription({ description }: { description: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard
      ?.writeText(description)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), COPIED_RESET_MS);
      })
      .catch(() => {
        // Clipboard can be unavailable; copy is best-effort.
      });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      title="Click to copy"
      onClick={handleCopy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleCopy();
      }}
      className="group flex cursor-pointer items-start gap-1.5 rounded-md border border-transparent
        bg-black/5 px-2 py-1.5 transition-colors hover:border-border hover:bg-black/10
        dark:bg-white/[0.07] dark:hover:bg-white/[0.12]"
    >
      <span className="min-w-0 flex-1 break-all font-mono text-[11.5px] leading-[1.5] text-text-secondary line-clamp-2 group-hover:line-clamp-none">
        {description}
      </span>
      {copied ? (
        <Check size={13} className="mt-px shrink-0 text-[var(--color-success)]" />
      ) : (
        <Copy
          size={13}
          className="mt-px shrink-0 text-text-muted transition-colors group-hover:text-accent"
        />
      )}
    </div>
  );
}

function PlainDescription({
  description,
  action,
  onDismiss,
}: {
  description: string;
  action?: ToastAction;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 break-words text-[12px] leading-[1.45] text-text-secondary">
        {description}
      </span>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
          className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[12px] font-medium text-accent transition-opacity hover:opacity-70"
        >
          {action.label}
          <ChevronRight size={14} className="opacity-80" />
        </button>
      )}
    </div>
  );
}

// Stack layout tuning.
const EXPANDED_GAP = 14; // px between toasts when the stack is expanded
const COLLAPSED_PEEK = 16; // px each stacked toast peeks above the front one
const COLLAPSED_SCALE_STEP = 0.055; // shrink per depth when collapsed
const MAX_STACK = 2; // toasts shown behind the front one when collapsed

interface ToastCardProps {
  toast: ToastItem;
  /** True while the stack is hovered/expanded; pauses auto-dismiss. */
  paused: boolean;
  y: number;
  scale: number;
  /** Hidden behind the visible stack depth (collapsed only). */
  hidden: boolean;
  /** Show the card body; collapsed non-front cards show only their edge. */
  contentVisible: boolean;
  zIndex: number;
  reportHeight: (id: string, height: number) => void;
}

function ToastCard({
  toast,
  paused,
  y,
  scale,
  hidden,
  contentVisible,
  zIndex,
  reportHeight,
}: ToastCardProps) {
  const remove = useToastStore((s) => s.remove);
  const { icon: Icon, color, spin } = VARIANTS[toast.variant];
  const cardRef = useRef<HTMLDivElement>(null);

  // Measure height so the parent can position the expanded stack accurately.
  useEffect(() => {
    if (cardRef.current) reportHeight(toast.id, cardRef.current.offsetHeight);
  });

  // Auto-dismiss, paused while the stack is expanded; tracks remaining time so
  // pausing doesn't reset the full duration.
  const startRef = useRef(0);
  const remainingRef = useRef(toast.duration);
  useEffect(() => {
    remainingRef.current = toast.duration;
  }, [toast.duration]);
  useEffect(() => {
    if (toast.duration === Infinity || paused) return;
    startRef.current = performance.now();
    const timer = window.setTimeout(
      () => remove(toast.id),
      Math.max(0, remainingRef.current),
    );
    return () => {
      window.clearTimeout(timer);
      remainingRef.current -= performance.now() - startRef.current;
    };
  }, [paused, toast.id, toast.duration, remove]);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, x: 40, y, scale }}
      animate={{ opacity: hidden ? 0 : 1, x: 0, y, scale }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{ zIndex, transformOrigin: "bottom right" }}
      className="pointer-events-auto absolute bottom-0 right-0 w-[356px] rounded-xl border border-border bg-surface-card px-3 py-3
        shadow-[0_0_14px_rgba(20,20,19,0.06),0_8px_22px_-6px_rgba(20,20,19,0.14),0_2px_5px_rgba(20,20,19,0.08)]
        dark:shadow-[0_0_16px_rgba(0,0,0,0.28),0_10px_26px_-6px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.26)]"
    >
      <motion.div
        animate={{ opacity: contentVisible ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-2.5">
          <Icon size={18} className={`shrink-0 ${color} ${spin ? "animate-spin" : ""}`} />
          <div className="flex-1 min-w-0 text-[14px] font-semibold leading-tight text-text-primary">
            {toast.title}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => remove(toast.id)}
            className="toast-dismiss-btn shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {toast.description &&
          (toast.copyable ? (
            <CopyableDescription description={toast.description} />
          ) : (
            <PlainDescription
              description={toast.description}
              action={toast.action}
              onDismiss={() => remove(toast.id)}
            />
          ))}
      </motion.div>
    </motion.div>
  );
}

/** Renders the toast stack at the bottom-right, portaled to <body> so it sits
 * above every stacking context (titlebar, modals) and stays interactive.
 * Collapsed by default; hovering expands the stack into a full list. */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);
  const [expanded, setExpanded] = useState(false);
  const [heights, setHeights] = useState<Record<string, number>>({});

  const reportHeight = useCallback((id: string, height: number) => {
    setHeights((prev) => (prev[id] === height ? prev : { ...prev, [id]: height }));
  }, []);

  useEffect(() => {
    if (toasts.length === 0) setExpanded(false);
  }, [toasts.length]);

  // Front-first: the newest toast (last in the store) is the front of the stack.
  const ordered = [...toasts].reverse();
  const total = ordered.length;
  const stackHeight =
    ordered.reduce((sum, t) => sum + (heights[t.id] ?? 0), 0) +
    EXPANDED_GAP * Math.max(0, total - 1);
  // A continuous hit area spanning the whole stack so moving across the gaps
  // between expanded cards doesn't trigger mouseleave -> collapse jitter.
  const frontHeight = total > 0 ? heights[ordered[0].id] ?? 0 : 0;
  // Extra zone above the stack so the hover area also covers the Clear all
  // button (rendered at y = -(stackHeight + 10), ~26px tall).
  const clearAllZone = total > 1 ? 44 : 0;
  const catcherHeight = expanded
    ? stackHeight + clearAllZone
    : frontHeight + MAX_STACK * COLLAPSED_PEEK;

  return createPortal(
    <div
      className="pointer-events-none fixed bottom-0 right-0 z-[9999] p-4"
      onMouseEnter={() => total > 0 && setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="relative h-0 w-[356px]">
        {total > 0 && (
          <div
            aria-hidden
            className="pointer-events-auto absolute bottom-0 right-0 z-0 w-[356px]"
            style={{ height: catcherHeight }}
          />
        )}
        <AnimatePresence>
          {expanded && total > 1 && (
            <motion.button
              key="__clear_all"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: -(stackHeight + 10) }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => remove()}
              className="toast-clear-btn pointer-events-auto absolute bottom-0 right-0 z-[200] rounded-md border border-border bg-surface-card px-2.5 py-1 text-[11px] font-medium text-text-secondary shadow-md"
            >
              Clear all
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {ordered.map((toast, index) => {
            const belowHeight = ordered
              .slice(0, index)
              .reduce((sum, t) => sum + (heights[t.id] ?? 0), 0);
            const y = expanded
              ? -(belowHeight + EXPANDED_GAP * index)
              : -(Math.min(index, MAX_STACK) * COLLAPSED_PEEK);
            const scale = expanded
              ? 1
              : 1 - Math.min(index, MAX_STACK) * COLLAPSED_SCALE_STEP;
            return (
              <ToastCard
                key={toast.id}
                toast={toast}
                paused={expanded}
                y={y}
                scale={scale}
                hidden={!expanded && index > MAX_STACK}
                contentVisible={expanded || index === 0}
                zIndex={total - index}
                reportHeight={reportHeight}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}
