// components/CertificateViewer.tsx
"use client";

import React, { useRef } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";

export interface CertificateViewerProps {
  studentName: string;
  courseName: string;
  date: string;
  teacherName: string;
  certificateId: string;
  teacherSignature?: string; // optional image URL
  headMasterSignature?: string; // optional image URL
  teacherSignatureText?: string; // توقيع المعلم النصي (أول اسمين)
}

export default function CertificateViewer({
  studentName,
  courseName,
  date,
  teacherName,
  certificateId,
  teacherSignature,
  headMasterSignature,
  teacherSignatureText,
}: CertificateViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!containerRef.current) return;

    await document.fonts.ready;
    const images = containerRef.current.getElementsByTagName("img");
    await Promise.all(
      Array.from(images).map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) resolve();
            else {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }
          })
      )
    );

    try {
      const dataUrl = await toPng(containerRef.current, {
        quality: 1,
        pixelRatio: 1,
        width: 1754,
        height: 1240,
      });
      const link = document.createElement("a");
      link.download = `Certificate_${certificateId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Certificate download failed:", error);
    }
  };

  const idStyle: React.CSSProperties = {
    position: "absolute",
    left: "846px",
    top: "1175px",
    fontFamily: "'Inter', sans-serif",
    fontSize: "17pt",
    color: "#000000",
  };
  const nameStyle: React.CSSProperties = {
    position: "absolute",
    left: "350px",
    top: "500px",
    fontFamily: "'Pinyon Script', cursive",
    fontSize: "82.8pt",
    color: "#064e3b",
  };
  const courseStyle: React.CSSProperties = {
    position: "absolute",
    left: "315px",
    top: "348px",
    fontFamily: "'Amiri', serif",
    fontSize: "33pt",
    color: "#000000",
  };
  const dateStyle: React.CSSProperties = {
    position: "absolute",
    left: "841px",
    top: "1092px",
    fontFamily: "'Inter', sans-serif",
    fontSize: "17pt",
    color: "#000000",
  };
  const teacherSignTextStyle: React.CSSProperties = {
    position: "absolute",
    left: "983px",
    top: "865px",
    fontFamily: "'Dancing Script', cursive",
    fontSize: "22pt",
    color: "#000000",
  };
  const teacherNameStyle: React.CSSProperties = {
    position: "absolute",
    left: "1039px",
    top: "960px",
    fontFamily: "'Quattrocento', serif",
    fontSize: "16pt",
    color: "#000000",
  };
  const headSignTextStyle: React.CSSProperties = {
    position: "absolute",
    left: "300px",
    top: "865px",
    fontFamily: "'Dancing Script', cursive",
    fontSize: "22pt",
    color: "#000000",
  };
  const headNameStyle: React.CSSProperties = {
    position: "absolute",
    left: "350px",
    top: "960px",
    fontFamily: "'Quattrocento', serif",
    fontSize: "16pt",
    color: "#000000",
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="overflow-auto border shadow-lg" style={{ transform: "scale(0.5)", transformOrigin: "top left" }}>
        <div
          ref={containerRef}
          style={{
            position: "relative",
            width: "1754px",
            height: "1240px",
            backgroundColor: "#fff",
          }}
        >
          <img
            src="/images/certificate.png"
            alt="Certificate Background"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              zIndex: 0,
            }}
            crossOrigin="anonymous"
          />

          <div style={{ ...idStyle, zIndex: 10 }}>{certificateId}</div>
          <div style={{ ...nameStyle, zIndex: 10 }}>{studentName}</div>
          <div style={{ ...courseStyle, zIndex: 10 }}>{courseName}</div>
          <div style={{ ...dateStyle, zIndex: 10 }}>{date}</div>

          {/* توقيع المعلم: صورة أو نص تلقائي */}
          {teacherSignature ? (
            <img
              src={teacherSignature}
              alt="Teacher Signature"
              style={{
                position: "absolute",
                left: "983px",
                top: "845px",
                maxHeight: "80px",
                zIndex: 10,
              }}
              crossOrigin="anonymous"
            />
          ) : (
            <div style={{ ...teacherSignTextStyle, zIndex: 10 }}>
              {teacherSignatureText || teacherName}
            </div>
          )}

          <div style={{ ...teacherNameStyle, zIndex: 10 }}>{teacherName}</div>

          {headMasterSignature ? (
            <img
              src={headMasterSignature}
              alt="Head Master Signature"
              style={{
                position: "absolute",
                left: "300px",
                top: "845px",
                maxHeight: "80px",
                zIndex: 10,
              }}
              crossOrigin="anonymous"
            />
          ) : (
            <div style={{ ...headSignTextStyle, zIndex: 10 }}>Dr. Jehan Ziad</div>
          )}

          <div style={{ ...headNameStyle, zIndex: 10 }}>Dr. Jehan Ziad</div>
        </div>
      </div>

      <Button onClick={handleDownload} size="lg">
        Download Certificate (PNG)
      </Button>
    </div>
  );
}