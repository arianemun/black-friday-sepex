"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      dir="rtl"
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "!rounded-sm !font-sans !border-border",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
