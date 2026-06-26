"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { AlertCircle, Plus, X } from "lucide-react";
import Link from "next/link";
import { T } from "@/components/TranslatedText";
import { CustomCaptcha } from "@/components/CustomCaptcha";
import {
  teacherSignupStep1Schema,
  type TeacherSignupStep1Data,
} from "@/lib/validations/teacher-signup-step1";
import { PROFICIENCY_LEVELS, GENDERS } from "@/lib/constants/teacher-signup";
import { CountryCombobox } from "@/components/ui/country-combobox";
import { LanguageSelect } from "@/components/ui/language-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TeacherSignupStep1Page() {
  const router = useRouter();
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<TeacherSignupStep1Data>({
    resolver: zodResolver(teacherSignupStep1Schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      age: "",                      // ✅ حقل العمر
      countryOfResidence: "",
      nationality: "",
      gender: "",
      languages: [
        { code: "", proficiency: "native" as const },
      ] as { code: string; proficiency: "native" | "beginner" | "intermediate" | "advanced" }[],
      email: "",
      whatsapp: "",
      password: "",
      confirmPassword: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "languages",
  });

  const onVerifyCaptcha = async (token: string) => {
    const data = watch();
    try {
      sessionStorage.setItem("teacher_signup_step1", JSON.stringify(data));
      router.push("/signup/teacher/details");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setShowCaptcha(false);
    }
  };

  const onSubmit = async (data: TeacherSignupStep1Data) => {
    setError("");
    setShowCaptcha(true);
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
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">
              <T>Ruhulqudus Academy</T>
            </div>
            <h1 className="mt-3 font-serif text-3xl md:text-4xl">
              <T>Become a Teacher</T>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              <T>Complete your profile to start teaching</T>
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* الاسم الأول والأخير */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="mb-2 block text-sm font-medium">
                  <T>First Name</T> *
                </Label>
                <Input id="firstName" {...register("firstName")} placeholder="First Name" className="mt-1" />
                {errors.firstName?.message && (
                  <p className="text-xs text-red-500 mt-1"><T>{errors.firstName.message}</T></p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName" className="mb-2 block text-sm font-medium">
                  <T>Last Name</T> *
                </Label>
                <Input id="lastName" {...register("lastName")} placeholder="Last Name" className="mt-1" />
                {errors.lastName?.message && (
                  <p className="text-xs text-red-500 mt-1"><T>{errors.lastName.message}</T></p>
                )}
              </div>
            </div>

            {/* ✅ حقل العمر الإجباري */}
            <div>
              <Label htmlFor="age" className="mb-2 block text-sm font-medium">
                <T>Age</T> *
              </Label>
              <Input
                id="age"
                type="number"
                {...register("age")}
                placeholder="e.g. 30"
                className="mt-1"
                min={18}
                max={100}
              />
              {errors.age?.message && (
                <p className="text-xs text-red-500 mt-1"><T>{errors.age.message}</T></p>
              )}
            </div>

            {/* بلد الإقامة والجنسية */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block text-sm font-medium">
                  <T>Country of Residence</T> *
                </Label>
                <Controller
                  control={control}
                  name="countryOfResidence"
                  render={({ field }) => (
                    <CountryCombobox
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select country"
                    />
                  )}
                />
                {errors.countryOfResidence?.message && (
                  <p className="text-xs text-red-500 mt-1"><T>{errors.countryOfResidence.message}</T></p>
                )}
              </div>
              <div>
                <Label className="mb-2 block text-sm font-medium">
                  <T>Nationality</T> *
                </Label>
                <Controller
                  control={control}
                  name="nationality"
                  render={({ field }) => (
                    <CountryCombobox
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="e.g. Egyptian"
                    />
                  )}
                />
                {errors.nationality?.message && (
                  <p className="text-xs text-red-500 mt-1"><T>{errors.nationality.message}</T></p>
                )}
              </div>
            </div>

            {/* الجنس واللغات */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block text-sm font-medium">
                  <T>Gender</T> *
                </Label>
                <Controller
                  control={control}
                  name="gender"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDERS.map((g) => (
                          <SelectItem key={g.value} value={g.value}>
                            <T>{g.label}</T>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.gender?.message && (
                  <p className="text-xs text-red-500 mt-1"><T>{errors.gender.message}</T></p>
                )}
              </div>
              <div>
                <Label className="mb-2 block text-sm font-medium">
                  <T>Languages</T> *
                </Label>
                <div className="space-y-2 mt-1">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2">
                      <Controller
                        control={control}
                        name={`languages.${index}.code`}
                        render={({ field: codeField }) => (
                          <LanguageSelect
                            value={codeField.value}
                            onChange={codeField.onChange}
                            placeholder="Language"
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name={`languages.${index}.proficiency`}
                        render={({ field: profField }) => (
                          <Select onValueChange={profField.onChange} defaultValue={profField.value}>
                            <SelectTrigger className="w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PROFICIENCY_LEVELS.map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                  <T>{p.label}</T>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ code: "", proficiency: "intermediate" })}
                  >
                    <Plus className="h-3 w-3 mr-1" /> <T>Add Language</T>
                  </Button>
                </div>
                {errors.languages?.message && (
                  <p className="text-xs text-red-500 mt-1"><T>{errors.languages.message}</T></p>
                )}
                {errors.languages?.root?.message && (
                  <p className="text-xs text-red-500 mt-1"><T>{errors.languages.root.message}</T></p>
                )}
              </div>
            </div>

            {/* البريد ورقم الواتساب */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email" className="mb-2 block text-sm font-medium">
                  <T>Email</T> *
                </Label>
                <Input id="email" {...register("email")} type="email" placeholder="you@example.com" className="mt-1" />
                {errors.email?.message && (
                  <p className="text-xs text-red-500 mt-1"><T>{errors.email.message}</T></p>
                )}
              </div>
              <div>
                <Label htmlFor="whatsapp" className="mb-2 block text-sm font-medium">
                  <T>WhatsApp Number</T> *
                </Label>
                <Input id="whatsapp" {...register("whatsapp")} placeholder="+20 100 000 0000" className="mt-1" />
                {errors.whatsapp?.message && (
                  <p className="text-xs text-red-500 mt-1"><T>{errors.whatsapp.message}</T></p>
                )}
              </div>
            </div>

            {/* كلمة المرور وتأكيدها */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="password" className="mb-2 block text-sm font-medium">
                  <T>Password</T> *
                </Label>
                <Input id="password" {...register("password")} type="password" placeholder="••••••••" className="mt-1" />
                {errors.password?.message && (
                  <p className="text-xs text-red-500 mt-1"><T>{errors.password.message}</T></p>
                )}
              </div>
              <div>
                <Label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium">
                  <T>Confirm Password</T> *
                </Label>
                <Input id="confirmPassword" {...register("confirmPassword")} type="password" placeholder="••••••••" className="mt-1" />
                {errors.confirmPassword?.message && (
                  <p className="text-xs text-red-500 mt-1"><T>{errors.confirmPassword.message}</T></p>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}

            {showCaptcha ? (
              <CustomCaptcha onVerify={onVerifyCaptcha} />
            ) : (
              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-linear-to-r from-amber-500 to-amber-600 py-3.5 text-sm font-semibold tracking-wide text-white shadow-elegant hover:scale-[1.01] transition-transform"
              >
                <T>Create Teacher Account</T>
              </Button>
            )}

            <p className="text-center text-xs text-muted-foreground">
              <T>Already have an account?</T>{" "}
              <Link href="/login" className="text-amber-600 underline-offset-4 hover:underline">
                <T>Sign in</T>
              </Link>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}