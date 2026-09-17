"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { ALL_COUNTRIES } from "@/lib/constants/countries";
import { ALL_LANGUAGES } from "@/lib/constants/languages";
import { SignedUploadError, uploadSigned, type UploadReference } from "@/lib/security/signed-upload-client";
import { checkFileForPurpose } from "@/lib/security/upload-purpose";
import { useWorkspace } from "../context";
import { Button, Field, Notice, SelectInput, TextArea, TextInput } from "../ui";

/** The details the server validates (teachers/applications.ts); kept in step by tests. */
export interface ApplicationDetailsInput {
  firstName: string;
  lastName: string;
  countryOfResidence: string;
  nationality: string;
  gender: "" | "male" | "female";
  languages: { code: string; proficiency: "native" | "advanced" | "intermediate" | "beginner" }[];
  whatsapp: string;
  telegram: string;
  bio: string;
  socialLinks: { platform: string; url: string }[];
}

export interface ApplicationSubmission {
  readonly details: ApplicationDetailsInput;
  readonly cv: UploadReference | null;
  readonly introVideo: UploadReference | null;
}

export const EMPTY_DETAILS: ApplicationDetailsInput = {
  firstName: "",
  lastName: "",
  countryOfResidence: "",
  nationality: "",
  gender: "",
  languages: [{ code: "", proficiency: "native" }],
  whatsapp: "",
  telegram: "",
  bio: "",
  socialLinks: [],
};

const PROFICIENCIES = ["native", "advanced", "intermediate", "beginner"] as const;
const BIO_MIN = 50;

/**
 * Country and language options.
 *
 * The names come from the lists this repository authors, never from the
 * runtime's own locale database: `Intl.DisplayNames` answers from whatever
 * CLDR the engine was built with, so Node and the browser disagreed and the
 * server HTML did not match the first client render (React hydration error
 * #418). Node called PS "Palestinian Territories" where Chrome said
 * "Palestine", and Chrome had no name at all for 47 of the languages, so it
 * rendered bare codes ("aa" instead of "Afar") and sorted them into a
 * different order.
 *
 * Sorting uses a fixed key (diacritics folded, letters only) rather than
 * `localeCompare`, whose collation is also the engine's to choose. Both lists
 * are therefore identical everywhere and stay in alphabetical order even if a
 * future entry is added out of place.
 */
const sortKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toLowerCase();
const byName = <T extends { readonly name: string }>(list: readonly T[]) =>
  [...list].sort((a, b) => (sortKey(a.name) < sortKey(b.name) ? -1 : sortKey(a.name) > sortKey(b.name) ? 1 : 0));
const COUNTRY_OPTIONS = byName(ALL_COUNTRIES);
const LANGUAGE_OPTIONS = byName(ALL_LANGUAGES);

type Part = "personal" | "teaching";

/**
 * The teacher application fields. `parts` lets the signup split them over two
 * steps. Files are pre-checked here and uploaded (signed, private) only when
 * the whole form is submitted; the caller receives server-issued references.
 */
export function ApplicationForm({
  initial,
  parts = ["personal", "teaching"],
  cvRequired,
  submitLabel,
  busy,
  onSubmit,
  before,
  after,
}: {
  readonly initial?: ApplicationDetailsInput;
  readonly parts?: readonly Part[];
  /** A CV must be chosen (signup, first submission); on revision the one already sent is kept unless replaced. */
  readonly cvRequired: boolean;
  readonly submitLabel: string;
  readonly busy: boolean;
  readonly onSubmit: (submission: ApplicationSubmission) => Promise<void> | void;
  readonly before?: ReactNode;
  readonly after?: ReactNode;
}) {
  const { t } = useWorkspace();
  const f = t.application.fields;
  const id = useId();
  const [details, setDetails] = useState<ApplicationDetailsInput>(initial ?? EMPTY_DETAILS);
  const [cv, setCv] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof ApplicationDetailsInput>(key: K, value: ApplicationDetailsInput[K]) => setDetails((d) => ({ ...d, [key]: value }));
  const fid = (name: string) => `${id}-${name}`;

  function fileProblem(file: File | null, purpose: "teacher_cv" | "teacher_intro_video"): string | null {
    if (!file) return null;
    const check = checkFileForPurpose(file, purpose);
    return check.ok ? null : t.application.upload[check.reason];
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    // One submission at a time: the button is disabled while uploading or submitting, and this
    // guard also stops a second run (a double click, a stray Enter) from asking for more upload
    // signatures for the same files.
    if (busy || uploading) return;
    setProblem(null);
    if (parts.includes("personal") && !details.languages.some((l) => l.code && l.proficiency === "native")) {
      setProblem(f.languageHint);
      return;
    }
    if (parts.includes("teaching")) {
      if (details.bio.trim().length < BIO_MIN) {
        setProblem(f.bioHint);
        return;
      }
      if (cvRequired && !cv) {
        setProblem(f.cvHint);
        return;
      }
      const fileIssue = fileProblem(cv, "teacher_cv") ?? fileProblem(video, "teacher_intro_video");
      if (fileIssue) {
        setProblem(fileIssue);
        return;
      }
    }
    let cvReference: UploadReference | null = null;
    let videoReference: UploadReference | null = null;
    if (cv || video) {
      setUploading(true);
      try {
        if (cv) cvReference = await uploadSigned(cv, "teacher_cv");
        if (video) videoReference = await uploadSigned(video, "teacher_intro_video");
      } catch (error) {
        setProblem(t.application.upload[error instanceof SignedUploadError ? error.reason : "upload"]);
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    const cleaned: ApplicationDetailsInput = {
      ...details,
      languages: details.languages.filter((l) => l.code),
      socialLinks: details.socialLinks.filter((l) => l.platform.trim() || l.url.trim()),
    };
    await onSubmit({ details: cleaned, cv: cvReference, introVideo: videoReference });
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate={false}>
      {before}
      <fieldset disabled={busy || uploading} className="space-y-6">
        {parts.includes("personal") && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={f.firstName} htmlFor={fid("first")}>
                <TextInput id={fid("first")} required maxLength={80} autoComplete="given-name" value={details.firstName} onChange={(e) => set("firstName", e.target.value)} />
              </Field>
              <Field label={f.lastName} htmlFor={fid("last")}>
                <TextInput id={fid("last")} required maxLength={80} autoComplete="family-name" value={details.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </Field>
              <Field label={f.countryOfResidence} htmlFor={fid("residence")}>
                <SelectInput id={fid("residence")} required value={details.countryOfResidence} onChange={(e) => set("countryOfResidence", e.target.value)}>
                  <option value="">—</option>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label={f.nationality} htmlFor={fid("nationality")}>
                <SelectInput id={fid("nationality")} required value={details.nationality} onChange={(e) => set("nationality", e.target.value)}>
                  <option value="">—</option>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label={f.gender} htmlFor={fid("gender")}>
                <SelectInput id={fid("gender")} required value={details.gender} onChange={(e) => set("gender", e.target.value as ApplicationDetailsInput["gender"])}>
                  <option value="">—</option>
                  <option value="male">{f.genders.male}</option>
                  <option value="female">{f.genders.female}</option>
                </SelectInput>
              </Field>
              <Field label={f.whatsapp} htmlFor={fid("whatsapp")}>
                <TextInput id={fid("whatsapp")} required type="tel" dir="ltr" autoComplete="tel" maxLength={32} value={details.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
              </Field>
            </div>
            <fieldset className="space-y-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">{f.languages}</legend>
              <p className="text-xs text-muted-foreground">{f.languageHint}</p>
              {details.languages.map((language, index) => (
                <div key={index} className="flex flex-wrap items-end gap-2">
                  <Field label={f.language} htmlFor={fid(`lang-${index}`)}>
                    <SelectInput
                      id={fid(`lang-${index}`)}
                      required
                      value={language.code}
                      onChange={(e) => set("languages", details.languages.map((l, i) => (i === index ? { ...l, code: e.target.value } : l)))}
                    >
                      <option value="">—</option>
                      {LANGUAGE_OPTIONS.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.name}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label={f.proficiency} htmlFor={fid(`prof-${index}`)}>
                    <SelectInput
                      id={fid(`prof-${index}`)}
                      value={language.proficiency}
                      onChange={(e) => set("languages", details.languages.map((l, i) => (i === index ? { ...l, proficiency: e.target.value as (typeof PROFICIENCIES)[number] } : l)))}
                    >
                      {PROFICIENCIES.map((p) => (
                        <option key={p} value={p}>
                          {f.proficiencies[p]}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  {details.languages.length > 1 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => set("languages", details.languages.filter((_, i) => i !== index))}>
                      {f.removeLanguage}
                    </Button>
                  )}
                </div>
              ))}
              {details.languages.length < 10 && (
                <Button type="button" variant="outline" size="sm" onClick={() => set("languages", [...details.languages, { code: "", proficiency: "intermediate" }])}>
                  {f.addLanguage}
                </Button>
              )}
            </fieldset>
          </div>
        )}

        {parts.includes("teaching") && (
          <div className="space-y-4">
            <Field label={f.telegram} htmlFor={fid("telegram")}>
              <TextInput id={fid("telegram")} required dir="ltr" maxLength={33} placeholder="@username" value={details.telegram} onChange={(e) => set("telegram", e.target.value)} />
            </Field>
            <Field label={f.bio} htmlFor={fid("bio")} hint={f.bioHint}>
              <TextArea id={fid("bio")} required minLength={BIO_MIN} maxLength={5000} rows={6} dir="auto" aria-describedby={`${fid("bio")}-hint`} value={details.bio} onChange={(e) => set("bio", e.target.value)} />
            </Field>
            <fieldset className="space-y-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">{f.socialLinks}</legend>
              {details.socialLinks.map((link, index) => (
                <div key={index} className="flex flex-wrap items-end gap-2">
                  <Field label={f.platform} htmlFor={fid(`platform-${index}`)}>
                    <TextInput id={fid(`platform-${index}`)} maxLength={40} value={link.platform} onChange={(e) => set("socialLinks", details.socialLinks.map((l, i) => (i === index ? { ...l, platform: e.target.value } : l)))} />
                  </Field>
                  <Field label={f.url} htmlFor={fid(`url-${index}`)}>
                    <TextInput id={fid(`url-${index}`)} type="url" dir="ltr" maxLength={500} value={link.url} onChange={(e) => set("socialLinks", details.socialLinks.map((l, i) => (i === index ? { ...l, url: e.target.value } : l)))} />
                  </Field>
                  <Button type="button" variant="outline" size="sm" onClick={() => set("socialLinks", details.socialLinks.filter((_, i) => i !== index))}>
                    {f.removeLink}
                  </Button>
                </div>
              ))}
              {details.socialLinks.length < 10 && (
                <Button type="button" variant="outline" size="sm" onClick={() => set("socialLinks", [...details.socialLinks, { platform: "", url: "" }])}>
                  {f.addLink}
                </Button>
              )}
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={cvRequired ? f.cv : f.cvReplace} htmlFor={fid("cv")} hint={f.cvHint} optional={!cvRequired}>
                <input
                  id={fid("cv")}
                  type="file"
                  accept="application/pdf,.pdf"
                  required={cvRequired}
                  aria-describedby={`${fid("cv")}-hint`}
                  className="block w-full text-sm file:me-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5"
                  onChange={(e) => setCv(e.target.files?.[0] ?? null)}
                />
              </Field>
              <Field label={f.video} htmlFor={fid("video")} hint={f.videoHint} optional>
                <input
                  id={fid("video")}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                  aria-describedby={`${fid("video")}-hint`}
                  className="block w-full text-sm file:me-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5"
                  onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
                />
              </Field>
            </div>
          </div>
        )}
      </fieldset>
      {uploading && <Notice>{t.application.upload.uploading}</Notice>}
      {problem && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {problem}
        </p>
      )}
      {after}
      <Button type="submit" busy={busy || uploading}>
        {submitLabel}
      </Button>
    </form>
  );
}
