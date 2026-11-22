"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      dir="ltr"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-sm border-2 border-transparent bg-input transition-colors data-[state=checked]:bg-ink disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 rounded-[1px] bg-white shadow transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-brand" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
