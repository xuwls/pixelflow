"use client";

import Image from "next/image";

interface ImageItem {
  scene_index: number;
  image_url: string;
  label?: string;
}

interface ImageGalleryProps {
  images: ImageItem[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {images.map((img) => (
        <div key={img.scene_index} className="relative">
          <div className="aspect-[9/16] bg-gray-100 rounded overflow-hidden relative">
            <Image
              src={img.image_url}
              alt={img.label || `Scene ${img.scene_index}`}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Scene {img.scene_index}
          </p>
        </div>
      ))}
    </div>
  );
}
