"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";

// مكوّن العرض (الفقاعة الصوتية)
const VoiceMessageView = ({ node, updateAttributes }: any) => {
  const { src, title, theme = "green", width = "80%" } = node.attrs;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.addEventListener("timeupdate", () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      });
      audioRef.current.addEventListener("loadedmetadata", () => {
        setDuration(audioRef.current?.duration || 0);
      });
    }
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (t: number) => {
    if (!isFinite(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // تغيير الحجم بالسحب
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = bubbleRef.current?.offsetWidth || 200;
    const parentWidth = bubbleRef.current?.parentElement?.offsetWidth || 600;

    const onMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newWidth = startWidth + dx;
      const newWidthPercent = Math.min(100, Math.max(20, (newWidth / parentWidth) * 100));
      updateAttributes({ width: `${newWidthPercent}%` });
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <NodeViewWrapper className="voice-message-wrapper" contentEditable={false}>
      <div
        ref={bubbleRef}
        className={`voice-message-bubble voice-theme-${theme}`}
        style={{ width }}
        contentEditable={false}
      >
        <audio ref={audioRef} src={src} onEnded={() => setIsPlaying(false)} />
        <button onClick={togglePlay} className="voice-play-btn">
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <div className="voice-message-body">
          <div className="voice-title">{title || "فويز بلا عنوان"}</div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="voice-progress"
          />
          <div className="voice-time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
        {/* مقبض السحب لتغيير الحجم */}
        <div
          className="voice-resize-handle"
          onMouseDown={startResize}
          title="اسحب لتغيير الحجم"
        />
      </div>
    </NodeViewWrapper>
  );
};

// تعريف الـ Node
export const VoiceMessageNode = Node.create({
  name: "voiceMessage",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: "" },
      title: { default: "فويز بلا عنوان" },
      theme: { default: "green" },
      width: { default: "80%" },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="voice-message"]',
        getAttrs: (element) => ({
          src: (element as HTMLElement).getAttribute("data-src") || "",
          title: (element as HTMLElement).getAttribute("data-title") || "فويز بلا عنوان",
          theme: (element as HTMLElement).getAttribute("data-theme") || "green",
          width: (element as HTMLElement).getAttribute("data-width") || "80%",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "voice-message",
        "data-src": HTMLAttributes.src,
        "data-title": HTMLAttributes.title,
        "data-theme": HTMLAttributes.theme,
        "data-width": HTMLAttributes.width,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VoiceMessageView);
  },
});