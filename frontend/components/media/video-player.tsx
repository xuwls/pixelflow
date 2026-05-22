"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface VideoPlayerProps {
  src: string;
  title?: string;
}

export function VideoPlayer({ src, title }: VideoPlayerProps) {
  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-medium">{title}</p>}
      <video
        controls
        className="w-full rounded-lg bg-black"
        src={src}
      />
      <Button variant="outline" size="sm" onClick={() => window.open(src, "_blank")}>
        <Download className="w-4 h-4 mr-2" />
        Download
      </Button>
    </div>
  );
}
