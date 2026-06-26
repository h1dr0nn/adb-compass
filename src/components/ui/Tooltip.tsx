import type { ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

interface AppTooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  disabled?: boolean;
}

export function AppTooltip({
  content,
  children,
  side = "top",
  align = "center",
  disabled = false,
}: AppTooltipProps) {
  if (disabled || !content) return <>{children}</>;

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={10}
          className="z-[7000] max-w-[260px] select-none rounded-[8px] border border-border bg-surface-card px-2.5 py-1.5 text-xs font-medium leading-snug text-text-primary shadow-xl data-[state=delayed-open]:animate-[fadeSlide_120ms_var(--ease-out)]"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-surface-card" width={10} height={5} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
