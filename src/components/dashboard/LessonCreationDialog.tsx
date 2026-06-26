"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const lessonSchema = z.object({
  type: z.enum(["zoom", "recorded"]),
  scheduledDate: z.date(), // ✅ لا يحتاج required_error
  scheduledTime: z.string().min(1, "الوقت مطلوب"),
  scenario: z.string().optional(),
  teacherNotes: z.string().optional(),
});

type LessonFormData = z.infer<typeof lessonSchema>;

interface LessonCreationDialogProps {
  liveCourseId: string;
  onSuccess: () => void;
}

export default function LessonCreationDialog({
  liveCourseId,
  onSuccess,
}: LessonCreationDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LessonFormData>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      type: "zoom",
      scenario: "",
      teacherNotes: "",
    },
  });

  const onSubmit = async (data: LessonFormData) => {
    setSubmitting(true);
    try {
      const scheduledDateTime = new Date(data.scheduledDate);
      const [hours, minutes] = data.scheduledTime.split(":");
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          live_course_id: liveCourseId,
          type: data.type,
          scheduled_at: scheduledDateTime.toISOString(),
          scenario: data.scenario,
          teacher_notes: data.teacherNotes,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "فشل إنشاء الحصة");
      }

      toast.success("تمت إضافة الحصة بنجاح");
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-lg bg-card text-foreground border-border">
      <DialogHeader>
        <DialogTitle className="text-2xl font-bold">إضافة حصة جديدة</DialogTitle>
        <DialogDescription className="text-muted-foreground">
          حدد نوع الحصة والتاريخ والوقت. سيتم التحقق من الشروط تلقائياً.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
          {/* نوع الحصة */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>نوع الحصة</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر النوع" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="zoom">زوم (Zoom)</SelectItem>
                    <SelectItem value="recorded">مسجلة (Recorded)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* التاريخ */}
          <FormField
            control={form.control}
            name="scheduledDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>التاريخ</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {field.value ? (
                          format(field.value, "PPP", { locale: ar })
                        ) : (
                          <span>اختر تاريخاً</span>
                        )}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date()}
                      // ❌ إزالة initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* الوقت */}
          <FormField
            control={form.control}
            name="scheduledTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>الوقت</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* السيناريو */}
          <FormField
            control={form.control}
            name="scenario"
            render={({ field }) => (
              <FormItem>
                <FormLabel>السيناريو (ملاحظات الدرس)</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    {...field}
                    placeholder="سيناريو الدرس أو ملاحظات..."
                    className="resize-y"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ملاحظات المعلم */}
          <FormField
            control={form.control}
            name="teacherNotes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ملاحظات خاصة (غير مرئية للطلاب)</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} placeholder="ملاحظات داخلية..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => form.reset()}>
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submitting ? "جارٍ الحفظ..." : "إضافة الحصة"}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
}