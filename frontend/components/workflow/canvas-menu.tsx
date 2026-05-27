"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect?: () => void;
  children?: MenuItem[];
}

export interface CanvasMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function CanvasMenu({ x, y, items, onClose }: CanvasMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", handleDown, true);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleDown, true);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ top: y, left: x }}
      className="fixed z-50 min-w-[200px] rounded-xl border border-border/60 bg-popover/95 backdrop-blur-md text-popover-foreground shadow-lg py-1"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <MenuRow key={item.key} item={item} onClose={onClose} />
      ))}
    </div>
  );
}

function MenuRow({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const hasChildren = !!item.children?.length;
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const openSubmenu = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsSubmenuOpen(true);
  };

  const closeSubmenu = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsSubmenuOpen(false);
    }, 200);
  };

  if (hasChildren) {
    return (
      <div className="relative">
        <div
          className={cn(
            "flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] cursor-default select-none rounded-sm mx-1",
            "hover:bg-accent hover:text-accent-foreground",
            item.disabled && "opacity-50 pointer-events-none",
          )}
          onMouseEnter={openSubmenu}
        >
          {item.icon && <span className="w-3.5 h-3.5 shrink-0 text-muted-foreground">{item.icon}</span>}
          <span className="flex-1">{item.label}</span>
          <span className="text-muted-foreground text-[10px]">▸</span>
        </div>
        {isSubmenuOpen && (
          <div 
            className="absolute top-0 left-full min-w-[180px] rounded-md border border-border bg-popover shadow-lg ring-1 ring-foreground/5 py-1 z-50"
            style={{ marginLeft: "-2px" }}
            onMouseEnter={openSubmenu}
            onMouseLeave={closeSubmenu}
          >
            {item.children!.map((c) => (
              <MenuRow key={c.key} item={c} onClose={onClose} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] cursor-pointer select-none rounded-sm mx-1",
        "hover:bg-accent hover:text-accent-foreground",
        item.disabled && "opacity-50 pointer-events-none",
        item.destructive && "text-destructive hover:bg-destructive/15 hover:text-destructive",
      )}
      onClick={() => {
        if (item.disabled) return;
        item.onSelect?.();
        onClose();
      }}
    >
      {item.icon && (
        <span className="w-3.5 h-3.5 shrink-0 text-muted-foreground">{item.icon}</span>
      )}
      <span className="flex-1">{item.label}</span>
      {item.description && (
        <span className="text-[10px] text-muted-foreground font-mono">{item.description}</span>
      )}
    </div>
  );
}
