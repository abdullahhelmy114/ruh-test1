"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { 
  AlertCircle, Plus, X, User, Globe, ShieldCheck, Mail, Phone, Lock, ArrowRight
} from "lucide-react";

import { T } from "@/components/TranslatedText";
import { CustomCaptcha } from "@/components/CustomCaptcha";
import { teacherSignupStep1Schema, type TeacherSignupStep1Data } from "@/lib/validations/teacher-signup-step1";
import { PROFICIENCY_LEVELS, GENDERS } from "@/lib/constants/teacher-signup";

import { CountryCombobox } from "@/components/ui/country-combobox";
import { LanguageSelect } from "@/components/ui/language-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function TeacherSignupStep1Page() {
  const router = useRouter();
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [error, setError] = useState("");

  const form = useForm<TeacherSignupStep1Data>({
    resolver: zodResolver(teacherSignupStep1Schema),
    defaultValues: {
      firstName: "", lastName: "", countryOfResidence: "", nationality: "", gender: "",
      languages: [{ code: "", proficiency: "native" as const }],
      email: "", whatsapp: "", password: "", confirmPassword: "",
    },
    mode: "onChange"
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "languages",
  });

  const onSubmit = async (data: TeacherSignupStep1Data) => {
    setError("");
    setShowCaptcha(true);
  };

  const onVerifyCaptcha = async (token: string) => {
    const data = form.getValues();
    try {
      sessionStorage.setItem("teacher_signup_step1", JSON.stringify(data));
      router.push("/signup/teacher/details");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setShowCaptcha(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-12 relative overflow-hidden flex items-center justify-center">
      {/* Ambient Lighting */}
      <div aria-hidden="true" className="pointer-events-none absolute top-0 right-0 -z-10 h-[400px] w-[400px] sm:h-[600px] sm:w-[600px] rounded-full bg-primary/10 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 -z-10 h-[400px] w-[400px] sm:h-[600px] sm:w-[600px] rounded-full bg-gold/10 blur-[120px]" />

      <div className="w-full max-w-3xl">
        {/* Progress Bar */}
        <nav aria-label="Progress" className="mb-8 flex items-center justify-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-elegant">1</div>
            <span className="text-xs sm:text-sm font-bold text-primary"><T>Identity</T></span>
          </div>
          <div className="h-[2px] w-8 sm:w-16 bg-primary/20" />
          <div className="flex items-center gap-2 opacity-60">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 border-muted-foreground text-muted-foreground text-sm">2</div>
            <span className="text-xs sm:text-sm font-medium text-muted-foreground"><T>Expertise</T></span>
          </div>
        </nav>

        {/* 🛑 تم إزالة حواف البوكس الخارجي، والاعتماد على الظل والخلفية */}
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="rounded-3xl bg-card p-5 sm:p-8 md:p-10 shadow-elegant"
        >
          <header className="mb-8 sm:mb-10 text-center">
            <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl text-primary mb-2 sm:mb-3"><T>Teacher Application</T></h1>
            <p className="text-sm sm:text-base text-muted-foreground"><T>Join elite educators and share your Arabic mastery</T></p>
          </header>

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive" role="alert">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <Form {...form}>
            <motion.form variants={containerVariants} initial="hidden" animate="show" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8">
              
              {/* --- Section 1: Personal Info --- */}
              <motion.section variants={itemVariants} className="space-y-4 rounded-2xl bg-background p-5 sm:p-6 shadow-sm ring-1 ring-primary/5">
                <header className="flex items-center gap-2 mb-4 text-primary">
                  <User className="h-5 w-5" />
                  <h2 className="font-semibold text-primary text-lg"><T>Personal Information</T></h2>
                </header>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <Label className="text-sm text-foreground"><T>First Name</T> *</Label>
                      <FormControl><Input autoComplete="given-name" {...field} className="bg-card text-foreground focus-visible:ring-primary border-none shadow-sm ring-1 ring-primary/10" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <Label className="text-sm text-foreground"><T>Last Name</T> *</Label>
                      <FormControl><Input autoComplete="family-name" {...field} className="bg-card text-foreground focus-visible:ring-primary border-none shadow-sm ring-1 ring-primary/10" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="gender" render={({ field }) => (
                    <FormItem>
                      <Label className="text-sm text-foreground"><T>Gender</T> *</Label>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-card text-foreground focus:ring-primary border-none shadow-sm ring-1 ring-primary/10"><SelectValue placeholder="Select…" /></SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card text-foreground shadow-elegant z-50 border-none ring-1 ring-primary/10">
                          {GENDERS.map((g) => (<SelectItem key={g.value} value={g.value} className="focus:bg-primary/10 cursor-pointer"><T>{g.label}</T></SelectItem>))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </motion.section>

              {/* --- Section 2: Location & Languages --- */}
              <motion.section variants={itemVariants} className="space-y-4 rounded-2xl bg-background p-5 sm:p-6 shadow-sm ring-1 ring-primary/5">
                <header className="flex items-center gap-2 mb-4 text-primary">
                  <Globe className="h-5 w-5" />
                  <h2 className="font-semibold text-primary text-lg"><T>Background & Languages</T></h2>
                </header>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-5">
                  <FormField control={form.control} name="countryOfResidence" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <Label className="text-sm text-foreground mb-1"><T>Country of Residence</T> *</Label>
                      <FormControl><CountryCombobox value={field.value} onChange={field.onChange} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="nationality" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <Label className="text-sm text-foreground mb-1"><T>Nationality</T> *</Label>
                      <FormControl><CountryCombobox value={field.value} onChange={field.onChange} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-foreground"><T>Languages Spoken</T> *</Label>
                  <AnimatePresence>
                    {fields.map((field, index) => (
                      <motion.div 
                        key={field.id}
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3"
                      >
                        <div className="w-full sm:flex-1">
                          <FormField control={form.control} name={`languages.${index}.code`} render={({ field: codeField }) => (
                            <FormItem className="w-full">
                              <FormControl><LanguageSelect value={codeField.value} onChange={codeField.onChange} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <div className="flex w-full sm:w-auto items-center gap-2 flex-[0.7]">
                          <FormField control={form.control} name={`languages.${index}.proficiency`} render={({ field: profField }) => (
                            <FormItem className="w-full">
                              <Select onValueChange={profField.onChange} defaultValue={profField.value}>
                                <FormControl><SelectTrigger className="bg-card text-foreground focus:ring-primary border-none shadow-sm ring-1 ring-primary/10"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent className="bg-card text-foreground shadow-elegant z-50 border-none ring-1 ring-primary/10">
                                  {PROFICIENCY_LEVELS.map((p) => (<SelectItem key={p.value} value={p.value} className="focus:bg-primary/10 cursor-pointer"><T>{p.label}</T></SelectItem>))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          {fields.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Remove language">
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ code: "", proficiency: "intermediate" })} className="mt-2 text-primary border-none ring-1 ring-primary/20 bg-card hover:bg-primary/5">
                    <Plus className="h-4 w-4 mr-1.5" /> <T>Add Language</T>
                  </Button>
                </div>
              </motion.section>

              {/* --- Section 3: Contact & Security --- */}
              <motion.section variants={itemVariants} className="space-y-4 rounded-2xl bg-background p-5 sm:p-6 shadow-sm ring-1 ring-primary/5">
                <header className="flex items-center gap-2 mb-4 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                  <h2 className="font-semibold text-primary text-lg"><T>Account Details</T></h2>
                </header>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <Label className="flex items-center gap-2 text-sm text-foreground"><Mail className="h-3.5 w-3.5 text-primary/70"/> <T>Email</T> *</Label>
                      <FormControl><Input type="email" autoComplete="email" dir="ltr" {...field} className="bg-card text-foreground focus-visible:ring-primary border-none shadow-sm ring-1 ring-primary/10" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="whatsapp" render={({ field }) => (
                    <FormItem>
                      <Label className="flex items-center gap-2 text-sm text-foreground"><Phone className="h-3.5 w-3.5 text-primary/70"/> <T>WhatsApp Number</T> *</Label>
                      <FormControl><Input type="tel" autoComplete="tel" dir="ltr" placeholder="+20 100..." {...field} className="bg-card text-foreground focus-visible:ring-primary border-none shadow-sm ring-1 ring-primary/10" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <Label className="flex items-center gap-2 text-sm text-foreground"><Lock className="h-3.5 w-3.5 text-primary/70"/> <T>Password</T> *</Label>
                      <FormControl><Input type="password" autoComplete="new-password" dir="ltr" {...field} className="bg-card text-foreground focus-visible:ring-primary border-none shadow-sm ring-1 ring-primary/10" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                    <FormItem>
                      <Label className="flex items-center gap-2 text-sm text-foreground"><Lock className="h-3.5 w-3.5 text-primary/70"/> <T>Confirm Password</T> *</Label>
                      <FormControl><Input type="password" autoComplete="new-password" dir="ltr" {...field} className="bg-card text-foreground focus-visible:ring-primary border-none shadow-sm ring-1 ring-primary/10" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </motion.section>

              {/* Submit / Captcha Area */}
              <motion.div variants={itemVariants} className="pt-2 sm:pt-4">
                <AnimatePresence mode="wait">
                  {showCaptcha ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card p-1 rounded-2xl shadow-elegant ring-1 ring-primary/20">
                      <CustomCaptcha onVerify={onVerifyCaptcha} />
                    </motion.div>
                  ) : (
                    <Button type="submit" className="w-full rounded-full bg-gold text-primary-foreground py-6 text-base font-semibold shadow-gold hover:bg-gold/80 hover:scale-[1.01] transition-all">
                      <T>Proceed to Next Step</T> <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  )}
                </AnimatePresence>
              </motion.div>

            </motion.form>
          </Form>
        </motion.div>
      </div>
    </main>
  );
}