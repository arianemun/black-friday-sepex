"use client";

import { useEffect } from "react";

/** Puts the admin theme on <html> so portaled dialogs and toasts use it too (from Spinex). */
export function AdminThemeSync() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("admin-soft");
    return () => root.classList.remove("admin-soft");
  }, []);
  return null;
}
