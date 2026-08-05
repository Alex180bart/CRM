"use client";

import { TooltipProvider } from "@crm/ui";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={200}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast:
              "!bg-surface !border-border !text-foreground !shadow-overlay !rounded-lg !text-sm !font-sans",
            description: "!text-muted-foreground !text-xs",
            actionButton: "!bg-primary !text-primary-foreground",
          },
        }}
      />
    </TooltipProvider>
  );
}
