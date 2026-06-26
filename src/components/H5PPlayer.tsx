"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    H5PStandalone: any;
  }
}

interface H5PPlayerProps {
  src: string; // رابط ملف H5P المضغوط (.h5p)
}

export function H5PPlayer({ src }: H5PPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/h5p-standalone@latest/dist/main.bundle.js";
    script.onload = () => {
      if (window.H5PStandalone && containerRef.current) {
        new window.H5PStandalone(containerRef.current, {
          h5pJsonPath: src,
          frameJs: "",
          frameCss: "",
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [src]);

  return (
    <div className="w-full rounded-2xl overflow-hidden border bg-white">
      <div ref={containerRef} className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    </div>
  );
}