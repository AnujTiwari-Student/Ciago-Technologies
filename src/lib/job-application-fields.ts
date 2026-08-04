import { z } from "zod";

export const EDUCATION_LEVEL_OPTIONS = ["Under Graduate", "Graduate", "Post Graduate"] as const;

export const educationalQualificationSchema = z.object({
  school: z.string().trim().max(200).optional().or(z.literal("")),
  qualification: z.string().trim().max(200).optional().or(z.literal("")),
  level: z.enum(EDUCATION_LEVEL_OPTIONS).optional().or(z.literal("")),
  yearOfPassing: z.string().trim().max(4).optional().or(z.literal("")),
  classPercentage: z.string().trim().max(100).optional().or(z.literal("")),
  majorOptionalSubjects: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const previousWorkExperienceSchema = z.object({
  company: z.string().trim().max(200).optional().or(z.literal("")),
  designation: z.string().trim().max(200).optional().or(z.literal("")),
  salary: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
});

export const educationalQualificationsSchema = z
  .array(educationalQualificationSchema)
  .max(10)
  .default([]);

export const previousWorkExperiencesSchema = z
  .array(previousWorkExperienceSchema)
  .max(10)
  .default([]);

export type EducationalQualificationInput = z.infer<typeof educationalQualificationSchema>;
export type PreviousWorkExperienceInput = z.infer<typeof previousWorkExperienceSchema>;

export function createEmptyEducationalQualification(): EducationalQualificationInput {
  return {
    school: "",
    qualification: "",
    level: "",
    yearOfPassing: "",
    classPercentage: "",
    majorOptionalSubjects: "",
  };
}

export function createEmptyPreviousWorkExperience(): PreviousWorkExperienceInput {
  return {
    company: "",
    designation: "",
    salary: "",
    address: "",
  };
}

export function normalizeEducationalQualifications(
  rows: EducationalQualificationInput[],
): EducationalQualificationInput[] {
  return rows
    .map((row) => ({
      school: row.school?.trim() ?? "",
      qualification: row.qualification?.trim() ?? "",
      level: row.level ?? "",
      yearOfPassing: row.yearOfPassing?.trim() ?? "",
      classPercentage: row.classPercentage?.trim() ?? "",
      majorOptionalSubjects: row.majorOptionalSubjects?.trim() ?? "",
    }))
    .filter(
      (row) =>
        row.school ||
        row.qualification ||
        row.level ||
        row.yearOfPassing ||
        row.classPercentage ||
        row.majorOptionalSubjects,
    );
}

export function normalizePreviousWorkExperiences(
  rows: PreviousWorkExperienceInput[],
): PreviousWorkExperienceInput[] {
  return rows
    .map((row) => ({
      company: row.company?.trim() ?? "",
      designation: row.designation?.trim() ?? "",
      salary: row.salary?.trim() ?? "",
      address: row.address?.trim() ?? "",
    }))
    .filter((row) => row.company || row.designation || row.salary || row.address);
}
