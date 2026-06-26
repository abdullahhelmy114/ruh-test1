"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ArrowRight, ArrowLeft } from "lucide-react";
import { T } from "@/components/TranslatedText";

interface TourStep {
  target: string;                // محدد CSS مثل ".profile-name"
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
  optional?: boolean;            // هل يمكن تخطي هذه الخطوة؟
}

interface OnboardingTourProps {
  steps: TourStep[];
  tourKey?: string;
  onFinish?: () => void;
}

export function OnboardingTour({ steps, tourKey = "onboarding_tour_seen", onFinish }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({});
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const tourRef = useRef<HTMLDivElement>(null);

  const totalSteps = steps.length;

  // بدء الجولة بعد تحميل الصفحة
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // حساب موضع الإطار والبطاقة
  const updatePosition = useCallback(() => {
    if (!isVisible || currentStep >= totalSteps) return;

    const step = steps[currentStep];
    const targetEl = document.querySelector(step.target) as HTMLElement;

    if (!targetEl || step.placement === "center") {
      // توسيط البطاقة فقط
      setSpotlightStyle({ display: "none" });
      setTooltipStyle({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
      return;
    }

    // تمرير العنصر إلى مجال الرؤية
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });

    const rect = targetEl.getBoundingClientRect();
    const padding = 8;
    const placement = step.placement || "bottom";

    // إطار التظليل حول العنصر
    setSpotlightStyle({
      top: rect.top - padding + "px",
      left: rect.left - padding + "px",
      width: rect.width + padding * 2 + "px",
      height: rect.height + padding * 2 + "px",
    });

    // موضع البطاقة التوضيحية
    let top = 0, left = 0;
    const gap = 16;
    const tooltipWidth = 320;
    const tooltipHeight = 180;

    switch (placement) {
      case "bottom":
        top = rect.bottom + gap;
        left = Math.max(gap, rect.left + rect.width / 2 - tooltipWidth / 2);
        break;
      case "top":
        top = rect.top - gap - tooltipHeight;
        left = Math.max(gap, rect.left + rect.width / 2 - tooltipWidth / 2);
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - gap - tooltipWidth;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
    }

    // منع الخروج عن الشاشة
    top = Math.max(10, Math.min(top, window.innerHeight - tooltipHeight - 10));
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));

    setTooltipStyle({
      top: top + "px",
      left: left + "px",
    });
  }, [currentStep, isVisible, steps, totalSteps]);

  useEffect(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [updatePosition]);

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // إنهاء الجولة
      setIsVisible(false);
      localStorage.setItem(tourKey, "true");
      if (onFinish) onFinish();
    }
  }, [currentStep, totalSteps, tourKey, onFinish]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    // إذا كانت الخطوة اختيارية، ننتقل إلى التالية
    if (steps[currentStep]?.optional) {
      handleNext();
    }
  }, [currentStep, steps, handleNext]);

  if (!isVisible || currentStep >= totalSteps) return null;

  const step = steps[currentStep];

  return (
    <div ref={tourRef} className="fixed inset-0 z-[1000]">
      {/* طبقة التعتيم مع فتحة للإطار */}
      <div className="absolute inset-0 bg-black/70" style={{ clipPath: `polygon(0% 0%, 0% 100%, 100% 100%, 100% 0%, ${spotlightStyle.top || 0} ${spotlightStyle.left || 0}, ${spotlightStyle.top || 0} ${(parseFloat(spotlightStyle.left as string) || 0) + (parseFloat(spotlightStyle.width as string) || 0)}px, ${(parseFloat(spotlightStyle.top as string) || 0) + (parseFloat(spotlightStyle.height as string) || 0)}px ${(parseFloat(spotlightStyle.left as string) || 0) + (parseFloat(spotlightStyle.width as string) || 0)}px, ${(parseFloat(spotlightStyle.top as string) || 0) + (parseFloat(spotlightStyle.height as string) || 0)}px ${spotlightStyle.left || 0})` }} />

      {/* إطار مضيء حول العنصر */}
      <div
        className="absolute z-[1001] rounded-lg ring-4 ring-amber-400 shadow-[0_0_20px_rgba(212,175,55,0.5)] pointer-events-none transition-all duration-300"
        style={spotlightStyle}
      />

      {/* بطاقة الخطوة */}
      <div
        className="absolute z-[1001] w-80 rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-5 transition-all duration-300"
        style={tooltipStyle}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white"><T>{step.title}</T></h3>
          <button onClick={() => handleSkip} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-5"><T>{step.content}</T></p>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 w-6 rounded-full ${idx === currentStep ? "bg-amber-500" : "bg-gray-300 dark:bg-gray-600"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step.optional && (
              <button
                onClick={handleSkip}
                className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                <T>Skip</T>
              </button>
            )}
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                <ArrowLeft size={14} /> <T>Back</T>
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-amber-400"
            >
              <T>{currentStep === totalSteps - 1 ? "Finish" : "Next"}</T> <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}