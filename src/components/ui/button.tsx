import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        brand: "bg-brand text-ink hover:bg-brand-deep",
        ink: "bg-ink text-white hover:bg-neutral-800",
        outline: "border border-input bg-transparent hover:bg-muted",
        "outline-brand": "border border-brand/60 bg-transparent text-brand hover:bg-brand hover:text-ink",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted",
        destructive: "bg-destructive text-white hover:opacity-90",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-7 text-base sm:text-lg",
        icon: "size-10",
        "icon-sm": "size-8",
      },
      shape: {
        square: "",
        chamfer: "chamfer-sm",
      },
    },
    defaultVariants: { variant: "default", size: "default", shape: "square" },
  }
);

function Button({
  className,
  variant,
  size,
  shape,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, shape, className }))} {...props} />;
}

export { Button, buttonVariants };
