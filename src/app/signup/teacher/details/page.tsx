"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { 
  AlertCircle, Plus, X, UploadCloud, FileText, Video, Link2, Send, CheckCircle2, Loader2
} from "lucide-react";

import { T } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { teacherSignupStep2Schema, type TeacherSignupStep2Data } from "@/lib/validations/teacher-signup-step2";
import { cn } from "@/lib/utils";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function TeacherSignupStep2Page() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState<{ cv: boolean; video: boolean }>({ cv: false, video: false });

  const form = useForm<TeacherSignupStep2Data>({
    resolver: zodResolver(teacherSignupStep2Schema),
    defaultValues: {
      telegram: "", socialLinks: [], bio: "", cvFile: undefined, introVideo: undefined,
    },
    mode: "onChange"
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "socialLinks",
  });

  const watchBio = form.watch("bio");
  const watchCv = form.watch("cvFile");
  const watchVideo = form.watch("introVideo");

  useEffect(() => {
    const step1Data = sessionStorage.getItem("teacher_signup_step1");
    if (!step1Data) router.replace("/signup/teacher");
  }, [router]);

  const handleDrag = (e: React.DragEvent, field: "cv" | "video", state: boolean) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(prev => ({ ...prev, [field]: state }));
  };

  const handleDrop = (e: React.DragEvent, field: "cv" | "video") => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(prev => ({ ...prev, [field]: false }));
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      form.setValue(field === "cv" ? "cvFile" : "introVideo", e.dataTransfer.files[0], { shouldValidate: true });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: "cv" | "video") => {
    if (e.target.files && e.target.files[0]) {
      form.setValue(field === "cv" ? "cvFile" : "introVideo", e.target.files[0], { shouldValidate: true });
    }
  };

  const onSubmit = async (data: TeacherSignupStep2Data) => {
    setError("");
    setLoading(true);

    try {
      const step1DataStr = sessionStorage.getItem("teacher_signup_step1");
      if (!step1DataStr) throw new Error("Missing step 1 data");
      
      const step1Data = JSON.parse(step1DataStr);
      const formData = new FormData();
      formData.append("step1", JSON.stringify(step1Data));
      formData.append("step2", JSON.stringify({ telegram: data.telegram, socialLinks: data.socialLinks, bio: data.bio }));
      formData.append("cv", data.cvFile);
      if (data.introVideo) formData.append("introVideo", data.introVideo);

      const res = await fetch("/api/signup/teacher", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Registration failed");

      sessionStorage.removeItem("teacher_signup_step1");
      router.push(`/verify-teacher?email=${encodeURIComponent(step1Data.email)}`);
    } catch (err: any) {
      setError(err.message || "An error occurred");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-12 relative overflow-hidden flex items-center justify-center">
      <div aria-hidden="true" className="pointer-events-none absolute top-0 left-0 -z-10 h-[400px] w-[400px] sm:h-[600px] sm:w-[600px] rounded-full bg-primary/10 blur-[120px]" />

      <div className="w-full max-w-3xl">
        {/* Progress Bar */}
        <nav aria-label="Progress" className="mb-8 flex items-center justify-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 opacity-50">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="h-[2px] w-8 sm:w-16 bg-primary" />
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-gold text-primary-foreground font-bold shadow-gold text-sm">2</div>
            <span className="text-xs sm:text-sm font-bold text-gold"><T>Expertise</T></span>
          </div>
        </nav>

        {/* 🛑 بدون حواف خارجية (عائم) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
          className="rounded-3xl bg-card p-5 sm:p-8 md:p-10 shadow-elegant"
        >
          <header className="mb-8 sm:mb-10 text-center">
            <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl text-primary mb-2 sm:mb-3"><T>Showcase Your Expertise</T></h1>
            <p className="text-sm sm:text-base text-muted-foreground"><T>Help students understand your teaching philosophy.</T></p>
          </header>

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive" role="alert">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <Form {...form}>
            <motion.form variants={containerVariants} initial="hidden" animate="show" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8">

              {/* 🛑 داخلي بدون حواف مزعجة، فقط Ring ناعم */}
              <motion.section variants={itemVariants} className="space-y-5 rounded-2xl bg-background p-5 sm:p-6 shadow-sm ring-1 ring-primary/5">
                <header className="flex items-center gap-2 mb-2 text-primary">
                  <Link2 className="h-5 w-5"/>
                  <h2 className="font-semibold text-primary text-lg"><T>Social Presence</T></h2>
                </header>
                
                <FormField control={form.control} name="telegram" render={({ field }) => (
                  <FormItem>
                    <Label className="text-sm text-foreground"><T>Telegram Username</T> *</Label>
                    <FormControl><Input dir="ltr" placeholder="@username" {...field} className="bg-card text-foreground focus-visible:ring-primary border-none shadow-sm ring-1 ring-primary/10" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="space-y-3 pt-2">
                  <Label className="text-sm text-foreground"><T>Other Profiles (Optional)</T></Label>
                  <AnimatePresence>
                    {fields.map((field, index) => (
                      <motion.div key={field.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start">
                        <FormField control={form.control} name={`socialLinks.${index}.platform`} render={({ field }) => (
                          <FormItem className="w-full sm:flex-1"><FormControl><Input placeholder="LinkedIn" {...field} className="bg-card text-foreground focus-visible:ring-primary border-none shadow-sm ring-1 ring-primary/10 w-full" /></FormControl><FormMessage/></FormItem>
                        )} />
                        <div className="flex w-full sm:flex-[1.5] gap-2 items-center">
                          <FormField control={form.control} name={`socialLinks.${index}.url`} render={({ field }) => (
                            <FormItem className="w-full"><FormControl><Input type="url" dir="ltr" placeholder="https://..." {...field} className="bg-card text-foreground focus-visible:ring-primary border-none shadow-sm ring-1 ring-primary/10 w-full" /></FormControl><FormMessage/></FormItem>
                          )} />
                          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remove link"><X className="h-4 w-4" /></Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ platform: "", url: "" })} className="text-primary border-none ring-1 ring-primary/20 bg-card hover:bg-primary/5">
                    <Plus className="h-4 w-4 mr-1.5" /> <T>Add link</T>
                  </Button>
                </div>
              </motion.section>

              <motion.section variants={itemVariants} className="space-y-2">
                <FormField control={form.control} name="bio" render={({ field }) => (
                  <FormItem>
                    <Label className="flex justify-between items-end text-sm text-foreground">
                      <span><T>Professional Bio</T> *</span>
                      <span className={cn("text-xs transition-colors", (watchBio?.length || 0) < 50 ? "text-destructive" : "text-primary")}>
                        {watchBio?.length || 0} / 50 min chars
                      </span>
                    </Label>
                    <FormControl>
                      <Textarea placeholder="Tell students about your teaching philosophy..." className="min-h-[120px] bg-card resize-y text-foreground focus-visible:ring-primary border-none shadow-sm ring-1 ring-primary/10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </motion.section>

              <motion.section variants={itemVariants} className="grid sm:grid-cols-2 gap-4 sm:gap-6 pt-2 sm:pt-4">
                <FormField control={form.control} name="cvFile" render={({ field }) => (
                  <FormItem>
                    <Label className="text-sm text-foreground"><T>CV Upload</T> (PDF) *</Label>
                    <div 
                      onDragEnter={(e) => handleDrag(e, "cv", true)} onDragLeave={(e) => handleDrag(e, "cv", false)} onDragOver={(e) => handleDrag(e, "cv", true)} onDrop={(e) => handleDrop(e, "cv")}
                      className={cn(
                        "relative mt-2 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 sm:p-6 text-center transition-all cursor-pointer bg-card",
                        dragActive.cv ? "border-gold bg-gold/10" : watchCv ? "border-primary/50 bg-primary/10" : "border-primary/30 hover:border-gold hover:bg-muted/50"
                      )}
                    >
                      <input type="file" accept=".pdf" className="absolute inset-0 z-50 w-full h-full opacity-0 cursor-pointer" aria-label="Upload CV" onChange={(e) => handleFileChange(e, "cv")} />
                      {watchCv ? (
                        <div className="flex flex-col items-center text-primary">
                          <FileText className="h-6 w-6 sm:h-8 sm:w-8 mb-2" />
                          <span className="text-xs sm:text-sm font-medium line-clamp-1 px-2">{watchCv.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-muted-foreground">
                          <div className="mb-2 sm:mb-3 rounded-full bg-background p-2 sm:p-3 shadow-sm ring-1 ring-primary/10"><UploadCloud className="h-5 w-5 sm:h-6 sm:w-6 text-gold" /></div>
                          <p className="text-xs sm:text-sm font-medium"><T>Click or drag CV here</T></p>
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="introVideo" render={({ field }) => (
                  <FormItem>
                    <Label className="text-sm text-foreground"><T>Intro Video</T> (Optional)</Label>
                    <div 
                      onDragEnter={(e) => handleDrag(e, "video", true)} onDragLeave={(e) => handleDrag(e, "video", false)} onDragOver={(e) => handleDrag(e, "video", true)} onDrop={(e) => handleDrop(e, "video")}
                      className={cn(
                        "relative mt-2 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 sm:p-6 text-center transition-all cursor-pointer bg-card",
                        dragActive.video ? "border-gold bg-gold/10" : watchVideo ? "border-primary/50 bg-primary/10" : "border-primary/30 hover:border-gold hover:bg-muted/50"
                      )}
                    >
                      <input type="file" accept="video/mp4,video/quicktime,video/webm" className="absolute inset-0 z-50 w-full h-full opacity-0 cursor-pointer" aria-label="Upload Video" onChange={(e) => handleFileChange(e, "video")} />
                      {watchVideo ? (
                        <div className="flex flex-col items-center text-primary">
                          <Video className="h-6 w-6 sm:h-8 sm:w-8 mb-2" />
                          <span className="text-xs sm:text-sm font-medium line-clamp-1 px-2">{watchVideo.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-muted-foreground">
                          <div className="mb-2 sm:mb-3 rounded-full bg-background p-2 sm:p-3 shadow-sm ring-1 ring-primary/10"><Video className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /></div>
                          <p className="text-xs sm:text-sm font-medium"><T>Click or drag Video</T></p>
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </motion.section>

              <motion.div variants={itemVariants} className="pt-2 sm:pt-6">
                <Button type="submit" disabled={loading} className="w-full rounded-full bg-gold text-primary-foreground py-5 sm:py-6 text-sm sm:text-base font-semibold shadow-gold hover:bg-gold/80 hover:scale-[1.01] transition-all">
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" /><T>Submitting Application...</T></>
                  ) : (
                    <><T>Complete Registration</T> <Send className="ml-2 h-4 w-4 sm:h-5 sm:w-5" /></>
                  )}
                </Button>
              </motion.div>

            </motion.form>
          </Form>
        </motion.div>
      </div>
    </main>
  );
}