"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="top-center"
      offset="5rem"
      duration={3000}
      gap={8}
      icons={{
        success: <CircleCheckIcon className="size-4 text-signal" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4 text-warn" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "oklch(0.99 0.003 86 / 0.92)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "oklch(0.18 0.01 270 / 0.12)",
          "--border-radius": "var(--radius-xl)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "glass-card !rounded-xl !px-4 !py-3 !text-sm",
          title: "!text-[13px] !font-medium",
          description: "!text-xs !text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
