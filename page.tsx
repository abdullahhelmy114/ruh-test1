"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { AlertCircle, Plus, X, Upload, Paperclip } from "lucide-react";
import Link from "next/link";
import { T } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  teacherSignupStep2Schema,
  type TeacherSignupStep2Data,
} from "@/lib/validations/teacher-signup-step2";

export default function TeacherSignupStep2Page() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<TeacherSignupStep2Data>({
    resolver: zodResolver(teacherSignupStep2Schema),
    defaultValues: {
      telegram: "",
      socialLinks: [],
      bio: "",
      cvFile: undefined,
      introVideo: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "socialLinks",
  });

  // استرجاع بيانات الخطوة الأولى للتأكد من اكتمال التدفق
  useEffect(() => {
    const step1Data = sessionStorage.getItem("teacher_signup_step1");
    if (!step1Data) {
      router.replace("/signup/teacher");
    }
  }, [router]);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "cvFile" | "introVideo"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setValue(field, file, { shouldValidate: true });
    if (field === "cvFile") setCvFileName(file.name);
    else setVideoFileName(file.name);
  };

  const onSubmit = async (data: TeacherSignupStep2Data) => {
    setError("");
    setLoading(true);

    try {
      // استرجاع بيانات الخطوة الأولى
      const step1DataStr = sessionStorage.getItem("teacher_signup_step1");
      if (!step1DataStr) {
        router.replace("/signup/teacher");
        return;
      }
      const step1Data = JSON.parse(step1DataStr);

      // بناء FormData لإرسال الملفات مع البيانات النصية
      const formData = new FormData();
      formData.append("step1", JSON.stringify(step1Data));
      formData.append("step2", JSON.stringify({ 
        telegram: data.telegram, 
        socialLinks: data.socialLinks, 
        bio: data.bio 
      }));
      formData.append("cv", data.cvFile);
      if (data.introVideo) {
        formData.append("introVideo", data.introVideo);
      }

      const res = await fetch("/api/signup/teacher", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || "Something went wrong");
      }

      // تنظيف التخزين المؤقت
      sessionStorage.removeItem("teacher_signup_step1");
      
      // توجيه إلى صفحة التحقق
      router.push(`/verify-teacher?email=${encodeURIComponent(step1Data.email)}`);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="relative w-full max-w-2xl">
        <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-amber-500/20 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="glass overflow-hidden rounded-3xl bg-card p-8 shadow-elegant md:p-10"
        >
          <div className="mb-8 text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-foreground">
              <T>Ruhulqudus Academy</T>
            </div>
            <h1 className="mt-3 font-serif text-3xl md:text-4xl">
              <T>Showcase Your Expertise</T>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              <T>Complete your profile to be reviewed by students</T>
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Telegram Username */}
            <div>
              <Label htmlFor="telegram"><T>Telegram Username</T> *</Label>
              <Input id="telegram" {...register("telegram")} placeholder="@username" />
              {errors.telegram?.message && (
                <p className="text-xs text-red-500 mt-1"><T>{errors.telegram.message}</T></p>
              )}
            </div>

            {/* Social Links */}
            <div>
              <Label><T>Social Presence</T></Label>
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        placeholder="Platform (e.g. Twitter)"
                        {...register(`socialLinks.${index}.platform`)}
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder="https://..."
                        {...register(`socialLinks.${index}.url`)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ platform: "", url: "" })}
                >
                  <Plus className="h-3 w-3 mr-1" /> <T>Add social account</T>
                </Button>
              </div>
            </div>

            {/* Bio */}
            <div>
              <Label htmlFor="bio"><T>Bio</T> *</Label>
              <Textarea
                id="bio"
                {...register("bio")}
                placeholder="Tell students about your teaching philosophy, qualifications, and experience..."
                rows={4}
              />
              {errors.bio?.message && (
                <p className="text-xs text-red-500 mt-1"><T>{errors.bio.message}</T></p>
              )}
            </div>

            {/* CV Upload */}
            <div>
              <Label className="block mb-2"><T>CV Upload</T> * (PDF, max 10 MB)</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2 text-sm hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  <span>{cvFileName ? cvFileName : <T>Choose file</T>}</span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, "cvFile")}
                  />
                </label>
                {cvFileName && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Paperclip className="h-3 w-3" /> PDF
                  </span>
                )}
              </div>
              {errors.cvFile?.message && (
                <p className="text-xs text-red-500 mt-1"><T>{String(errors.cvFile.message)}</T></p>
              )}
            </div>

            {/* Intro Video (optional) */}
            <div>
              <Label className="block mb-2"><T>Intro Video</T> (optional)</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2 text-sm hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  <span>{videoFileName ? videoFileName : <T>Choose video</T>}</span>
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, "introVideo")}
                  />
                </label>
              </div>
              {errors.introVideo?.message && (
                <p className="text-xs text-red-500 mt-1"><T>{String(errors.introVideo.message)}</T></p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-linear-to-r from-amber-500 to-amber-600 py-3.5 text-sm font-semibold tracking-wide text-white shadow-elegant hover:scale-[1.01] transition-transform"
            >
              {loading ? <T>Creating...</T> : <T>Complete Registration</T>}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}