import * as React from "react";

import { cn } from "@/shared/lib/utils";

/** true when the className already sets a font size (a text-size class or an arbitrary px size) */
function temTamanho(className?: string): boolean {
  return !!className && /(^|\s)text-(xs|sm|base|lg|[2-9]?xl|\[\d)/.test(className);
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          // 28/10: the default shrinks to 14px on wide screens; a caller that sets its own size
          // (e.g. the 52px profit goal) used to be overridden by it and showed tiny on PC/tablet.
          !temTamanho(className) && "md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
