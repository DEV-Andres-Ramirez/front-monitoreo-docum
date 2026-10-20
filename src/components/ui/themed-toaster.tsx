"use client";

import { Toaster } from "sonner";
import { useTheme } from "./theme";

export function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="top-center"
      richColors
      closeButton
      toastOptions={{ className: "font-sans !rounded-2xl" }}
    />
  );
}
