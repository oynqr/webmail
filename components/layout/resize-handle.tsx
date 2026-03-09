"use client";

import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  onDoubleClick?: () => void;
  className?: string;
}

const KEYBOARD_STEP = 10;

export function ResizeHandle({ onResize, onResizeEnd, onDoubleClick, className }: ResizeHandleProps) {
  const isDragging = useRef(false);
  const lastX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === "ArrowLeft") delta = -KEYBOARD_STEP;
    else if (e.key === "ArrowRight") delta = KEYBOARD_STEP;
    else return;
    e.preventDefault();
    onResize(delta);
    onResizeEnd?.();
  }, [onResize, onResizeEnd]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(delta);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      onResizeEnd?.();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onResize, onResizeEnd]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize"
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={onDoubleClick}
      className={cn(
        "w-1 flex-shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors relative group",
        "focus-visible:outline-none focus-visible:bg-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50",
        className
      )}
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}
