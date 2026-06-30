import type { ReactNode } from "react";
import { toast } from "sonner";

type ToastVariant = "default" | "success" | "error" | "info";

interface AppToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Render the body as a copyable monospace block. */
  code?: boolean;
  icon?: ReactNode;
}

/** Thin wrapper over sonner so app notifications use the same native toast
 * (and native shadow) as everything else. */
export function appToast({
  title,
  description,
  variant = "default",
  code = true,
  icon,
}: AppToastOptions) {
  const body: ReactNode | undefined =
    description == null
      ? undefined
      : code
        ? (
            <code className="mt-1 block max-h-[3.2em] select-text overflow-hidden break-all rounded-md bg-black/10 px-2 py-1 font-mono text-[11.5px] leading-[1.5] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
              {description}
            </code>
          )
        : description;

  const opts = { description: body, icon };
  switch (variant) {
    case "success":
      return toast.success(title, opts);
    case "error":
      return toast.error(title, opts);
    case "info":
      return toast.info(title, opts);
    default:
      return toast(title, opts);
  }
}
