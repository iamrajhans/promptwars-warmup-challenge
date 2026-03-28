"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface ConsumerImagePanelProps {
  onImageChange: (file: File | null) => void;
  text: string;
  onTextChange: (value: string) => void;
  onError: (message: string) => void;
}

export default function ConsumerImagePanel({
  onImageChange,
  text,
  onTextChange,
  onError,
}: ConsumerImagePanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleImageSelect = (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      onError("Only JPEG, PNG, and WebP images are supported.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      onError("Image must be under 10MB.");
      return;
    }

    setPreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }

      return URL.createObjectURL(file);
    });
    onImageChange(file);
  };

  const clearImage = () => {
    setPreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }

      return null;
    });

    onImageChange(null);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  return (
    <>
      {!previewUrl ? (
        <div
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file) {
              handleImageSelect(file);
            }
          }}
          onDragOver={(event) => event.preventDefault()}
          onClick={() => imageInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              imageInputRef.current?.click();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="Upload an image. Click or drag and drop."
          className="flex h-40 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 transition-colors hover:border-blue-400 hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span className="text-sm font-medium text-slate-600">
            Click or drag an image here
          </span>
          <span className="text-xs text-slate-400">
            JPEG, PNG, WebP (max 10MB)
          </span>
        </div>
      ) : (
        <div className="relative">
          <Image
            src={previewUrl}
            alt="Selected image preview"
            width={400}
            height={160}
            className="h-40 w-full rounded-xl border border-slate-200 object-cover"
            unoptimized
          />
          <button
            type="button"
            onClick={clearImage}
            className="absolute top-2 right-2 rounded-full bg-red-500 px-2 py-1 text-sm font-medium text-white transition-colors hover:bg-red-600"
            aria-label="Remove selected image"
          >
            Remove
          </button>
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            handleImageSelect(file);
          }
        }}
        aria-hidden="true"
        tabIndex={-1}
      />

      <label
        htmlFor="image-context"
        className="mb-1 mt-3 block text-xs text-slate-500"
      >
        Optional: Add text context for the image
      </label>
      <input
        id="image-context"
        type="text"
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="E.g. This photo is from the crash site..."
        className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </>
  );
}
