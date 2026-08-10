import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  Plus,
  Save,
  Trash2,
  Upload,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { Turnstile } from "@/components/site/Turnstile";
import { useAuth, displayName } from "@/lib/auth";
import { uploadFile } from "@/lib/upload.functions";
import { submitApplication } from "@/lib/applications.functions";
import { getJobPostingById, getMyCoreInfo, upsertMyCoreInfo } from "@/lib/core-info.functions";
import { getMyAuthUserId } from "@/lib/roles.functions";
import {
  createEmptyEducationalQualification,
  createEmptyPreviousWorkExperience,
  EDUCATION_LEVEL_OPTIONS,
  type EducationalQualificationInput,
  type PreviousWorkExperienceInput,
} from "@/lib/job-application-fields";
import { COUNTRIES, getDialCodeForCountry } from "@/lib/countries";

export const Route = createFileRoute("/careers_/$jobId_/apply")({
  component: ApplyPage,
});

function ApplyPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const fetchPosting = useServerFn(getJobPostingById);
  const { data: posting, isLoading: postingLoading } = useQuery({
    queryKey: ["job-posting", jobId],
    queryFn: () => fetchPosting({ data: { jobId } }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const fetchCoreInfo = useServerFn(getMyCoreInfo);
  const { data: coreInfo, isLoading: coreInfoLoading } = useQuery({
    queryKey: ["my-core-info"],
    queryFn: () => fetchCoreInfo(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const saveCoreInfo = useServerFn(upsertMyCoreInfo);
  const submit = useServerFn(submitApplication);
  const upload = useServerFn(uploadFile);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+91");
  const [country, setCountry] = useState("India");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [totalYearsExperience, setTotalYearsExperience] = useState("");
  const [highestEducationLevel, setHighestEducationLevel] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [expectedSalaryCurrency, setExpectedSalaryCurrency] = useState("INR");
  const [expectedSalaryMin, setExpectedSalaryMin] = useState("");
  const [expectedSalaryMax, setExpectedSalaryMax] = useState("");
  const [gender, setGender] = useState("");
  const [veteranStatus, setVeteranStatus] = useState("");
  const [disabilityStatus, setDisabilityStatus] = useState("");
  const [workAuthorization, setWorkAuthorization] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState("");
  const [educationalQualifications, setEducationalQualifications] = useState<
    EducationalQualificationInput[]
  >([createEmptyEducationalQualification()]);
  const [previousWorkExperiences, setPreviousWorkExperiences] = useState<
    PreviousWorkExperienceInput[]
  >([createEmptyPreviousWorkExperience()]);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [hp, setHp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [coreInfoLoaded, setCoreInfoLoaded] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Pre-fill from auth user
  useEffect(() => {
    if (user) {
      setFullName((prev) => prev || displayName(user));
      setEmail((prev) => prev || user.email || "");
    }
  }, [user]);

  // Auto-update phone country code when country changes
  useEffect(() => {
    if (country) {
      const dialCode = getDialCodeForCountry(country);
      if (dialCode) {
        setPhoneCountryCode(dialCode);
      }
    }
  }, [country]);

  // Pre-fill from saved core info
  useEffect(() => {
    if (coreInfo && !coreInfoLoaded) {
      setCoreInfoLoaded(true);
      if (coreInfo.fullName) setFullName(coreInfo.fullName);
      if (coreInfo.email) setEmail(coreInfo.email);
      if (coreInfo.phoneNumber) setPhoneNumber(coreInfo.phoneNumber);
      if (coreInfo.country) setCountry(coreInfo.country);
      if (coreInfo.city) setCity(coreInfo.city);
      if (coreInfo.address) setAddress(coreInfo.address);
      if (coreInfo.linkedin) setLinkedin(coreInfo.linkedin);
      if (coreInfo.portfolioUrl) setPortfolioUrl(coreInfo.portfolioUrl);
      if (coreInfo.totalYearsExperience != null)
        setTotalYearsExperience(String(coreInfo.totalYearsExperience));
      if (coreInfo.highestEducationLevel) setHighestEducationLevel(coreInfo.highestEducationLevel);
      if (coreInfo.expectedSalaryCurrency)
        setExpectedSalaryCurrency(coreInfo.expectedSalaryCurrency);
      if (coreInfo.expectedSalaryMin != null)
        setExpectedSalaryMin(String(coreInfo.expectedSalaryMin));
      if (coreInfo.expectedSalaryMax != null)
        setExpectedSalaryMax(String(coreInfo.expectedSalaryMax));
      if (coreInfo.gender) setGender(coreInfo.gender);
      if (coreInfo.veteranStatus) setVeteranStatus(coreInfo.veteranStatus);
      if (coreInfo.disabilityStatus) setDisabilityStatus(coreInfo.disabilityStatus);
      if (coreInfo.workAuthorization) setWorkAuthorization(coreInfo.workAuthorization);
      if (coreInfo.educationalQualifications?.length) {
        setEducationalQualifications(coreInfo.educationalQualifications);
      }
      if (coreInfo.previousWorkExperiences?.length) {
        setPreviousWorkExperiences(coreInfo.previousWorkExperiences);
      }
    }
  }, [coreInfo, coreInfoLoaded]);

  async function handleSaveCoreInfo() {
    try {
      await saveCoreInfo({
        data: {
          fullName: fullName.trim() || undefined,
          email: email.trim() || undefined,
          phoneNumber: phoneNumber.trim() || undefined,
          country: country.trim() || undefined,
          city: city.trim() || undefined,
          address: address.trim() || undefined,
          linkedin: linkedin.trim() || undefined,
          portfolioUrl: portfolioUrl.trim() || undefined,
          totalYearsExperience: totalYearsExperience ? parseInt(totalYearsExperience, 10) : undefined,
          highestEducationLevel: highestEducationLevel || undefined,
          educationalQualifications:
            educationalQualifications.filter((q) => q.school || q.qualification).length > 0
              ? educationalQualifications.filter((q) => q.school || q.qualification)
              : undefined,
          previousWorkExperiences:
            previousWorkExperiences.filter((w) => w.company || w.designation).length > 0
              ? previousWorkExperiences.filter((w) => w.company || w.designation)
              : undefined,
          expectedSalaryCurrency: expectedSalaryCurrency || undefined,
          expectedSalaryMin: expectedSalaryMin ? parseInt(expectedSalaryMin, 10) : undefined,
          expectedSalaryMax: expectedSalaryMax ? parseInt(expectedSalaryMax, 10) : undefined,
          gender: gender || undefined,
          veteranStatus: veteranStatus || undefined,
          disabilityStatus: disabilityStatus || undefined,
          workAuthorization: workAuthorization || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["my-core-info"] });
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
      toast.success("Core info saved! It will auto-fill on future applications.");
    } catch (err) {
      console.error("Save core info error:", err);
      const msg = err instanceof Error ? err.message : "Failed to save core info.";
      toast.error(msg);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in first.");
      return;
    }
    if (!resumeFile && !resumeUrl.trim()) {
      toast.error("Please upload a resume or provide a resume link.");
      return;
    }
    setSubmitting(true);

    try {
      let storagePath = "";
      if (resumeFile) {
        const authUserId = await getMyAuthUserId();
        const safeName = resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        storagePath = `${authUserId}/${Date.now()}-${safeName}`;
        const buf = await resumeFile.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        await upload({
          data: {
            bucket: "resumes",
            path: storagePath,
            base64,
            contentType: resumeFile.type || undefined,
          },
        });
      }

      await submit({
        data: {
          roleId: jobId,
          roleTitle: posting?.title ?? "",
          fullName: fullName.trim(),
          email: email.trim(),
          phoneNumber: phoneNumber.trim() || "",
          country: country.trim() || "",
          coverLetter: coverLetter.trim() || "",
          portfolioUrl: portfolioUrl.trim() || "",
          resumeStoragePath: storagePath || "",
          resumeLink: resumeUrl.trim() || "",
          expectedSalaryCurrency: expectedSalaryCurrency || "INR",
          expectedSalaryMin: expectedSalaryMin.trim() || "",
          expectedSalaryMax: expectedSalaryMax.trim() || "",
          educationalQualifications,
          previousWorkExperiences,
          turnstileToken,
          hp,
        },
      });

      toast.success(`Application submitted for ${posting?.title}!`);
      navigate({ to: "/careers/$jobId", params: { jobId }, replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    navigate({ to: "/auth", search: { redirect: `/careers/${jobId}/apply` } });
    return null;
  }

  if (postingLoading || coreInfoLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <div className="space-y-4">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="h-6 w-72 animate-pulse rounded bg-muted" />
            <div className="h-96 animate-pulse rounded bg-muted" />
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!posting) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center">
          <h1 className="text-2xl font-bold">Job not found</h1>
          <p className="mt-2 text-muted-foreground">
            This position may have been closed or removed.
          </p>
          <Link to="/careers" className="mt-6">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to all positions
            </Button>
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <Link
          to="/careers/$jobId"
          params={{ jobId }}
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to job details
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Apply: {posting.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {posting.department} · {posting.location}
            {posting.isRemote && " · Remote"}
          </p>
        </div>

        {/* Core Info banner */}
        {coreInfo && (
          <div className="mb-6 rounded-lg border border-brand/30 bg-brand/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand" />
                <span className="text-sm font-medium">
                  Core info auto-filled from your saved profile
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Last updated:{" "}
                {new Date(coreInfo.updatedAt).toLocaleDateString("en-IN")}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-8">
          {/* Hidden honeypot */}
          <input
            type="text"
            name="website_url"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />

          {/* Section 1: Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name *</Label>
                  <Input
                    id="fullName"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.name}>
                          {c.name} ({c.dialCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone number</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={phoneCountryCode}
                      className="w-20 bg-muted text-center"
                    />
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="98765 43210"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bangalore"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street address"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="linkedin">LinkedIn</Label>
                  <Input
                    id="linkedin"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="portfolioUrl">Portfolio / GitHub</Label>
                  <Input
                    id="portfolioUrl"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    placeholder="https://github.com/..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Professional Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5" />
                Professional Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="totalYearsExperience">Total years of experience</Label>
                  <Input
                    id="totalYearsExperience"
                    type="number"
                    min="0"
                    max="60"
                    value={totalYearsExperience}
                    onChange={(e) => setTotalYearsExperience(e.target.value)}
                    placeholder="e.g., 3"
                  />
                  <p className="text-xs text-muted-foreground">
                    Total professional work experience (0 if this is your first role)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workAuthorization">Work authorization</Label>
                  <Select value={workAuthorization} onValueChange={setWorkAuthorization}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select work authorization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Citizen">Citizen</SelectItem>
                      <SelectItem value="Permanent Resident">Permanent Resident</SelectItem>
                      <SelectItem value="Work Visa">Work Visa (H1B, L1, etc.)</SelectItem>
                      <SelectItem value="Student Visa">Student Visa (OPT, CPT)</SelectItem>
                      <SelectItem value="Need Sponsorship">Need Sponsorship</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Education */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="h-5 w-5" />
                Education
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="highestEducationLevel">Highest education level</Label>
                <Select value={highestEducationLevel} onValueChange={setHighestEducationLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High School">High School</SelectItem>
                    <SelectItem value="Diploma">Diploma</SelectItem>
                    <SelectItem value="Under Graduate">Under Graduate</SelectItem>
                    <SelectItem value="Graduate">Graduate</SelectItem>
                    <SelectItem value="Post Graduate">Post Graduate</SelectItem>
                    <SelectItem value="Doctorate">Doctorate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {educationalQualifications.map((qual, index) => (
                <div key={index} className="relative rounded-lg border p-4">
                  {educationalQualifications.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-7 w-7"
                      onClick={() =>
                        setEducationalQualifications((rows) =>
                          rows.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">School / University</Label>
                      <Input
                        value={qual.school || ""}
                        onChange={(e) =>
                          setEducationalQualifications((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, school: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Qualification / Degree</Label>
                      <Input
                        value={qual.qualification || ""}
                        onChange={(e) =>
                          setEducationalQualifications((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, qualification: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Level</Label>
                      <Select
                        value={qual.level || ""}
                        onValueChange={(v) =>
                          setEducationalQualifications((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? { ...r, level: v as EducationalQualificationInput["level"] }
                                : r,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {EDUCATION_LEVEL_OPTIONS.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Year of passing</Label>
                      <Input
                        value={qual.yearOfPassing || ""}
                        onChange={(e) =>
                          setEducationalQualifications((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, yearOfPassing: e.target.value } : r,
                            ),
                          )
                        }
                        placeholder="2020"
                        maxLength={4}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Grade / Percentage</Label>
                      <Input
                        value={qual.classPercentage || ""}
                        onChange={(e) =>
                          setEducationalQualifications((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, classPercentage: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Major subjects</Label>
                      <Input
                        value={qual.majorOptionalSubjects || ""}
                        onChange={(e) =>
                          setEducationalQualifications((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? { ...r, majorOptionalSubjects: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              {educationalQualifications.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEducationalQualifications((rows) => [
                      ...rows,
                      createEmptyEducationalQualification(),
                    ])
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add education
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Section 4: Work Experience */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5" />
                Work Experience
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Add all your work experience including current role. Leave blank if this is your first
                job.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {previousWorkExperiences.map((exp, index) => (
                <div key={index} className="relative rounded-lg border p-4">
                  {previousWorkExperiences.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-7 w-7"
                      onClick={() =>
                        setPreviousWorkExperiences((rows) =>
                          rows.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Company</Label>
                      <Input
                        value={exp.company || ""}
                        onChange={(e) =>
                          setPreviousWorkExperiences((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, company: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Designation</Label>
                      <Input
                        value={exp.designation || ""}
                        onChange={(e) =>
                          setPreviousWorkExperiences((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, designation: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Salary</Label>
                      <Input
                        value={exp.salary || ""}
                        onChange={(e) =>
                          setPreviousWorkExperiences((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, salary: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Address</Label>
                      <Input
                        value={exp.address || ""}
                        onChange={(e) =>
                          setPreviousWorkExperiences((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, address: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              {previousWorkExperiences.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPreviousWorkExperiences((rows) => [
                      ...rows,
                      createEmptyPreviousWorkExperience(),
                    ])
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add experience
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Section 5: Resume & Cover Letter */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Upload className="h-5 w-5" />
                Resume & Cover Letter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resume">Resume (PDF, DOC) *</Label>
                <Input
                  id="resume"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                  className="cursor-pointer"
                />
                {coreInfo?.resumeFileName && !resumeFile && (
                  <p className="text-xs text-muted-foreground">
                    Saved resume: {coreInfo.resumeFileName}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="resumeUrl">Or provide a resume link</Label>
                <Input
                  id="resumeUrl"
                  type="url"
                  value={resumeUrl}
                  onChange={(e) => setResumeUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coverLetter">Cover letter (optional)</Label>
                <Textarea
                  id="coverLetter"
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={5}
                  placeholder="Tell us why you're interested in this role..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 6: Salary Expectations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Salary Expectations (optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={expectedSalaryCurrency} onValueChange={setExpectedSalaryCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salaryMin">Min annual</Label>
                  <Input
                    id="salaryMin"
                    type="number"
                    value={expectedSalaryMin}
                    onChange={(e) => setExpectedSalaryMin(e.target.value)}
                    placeholder="e.g. 1200000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salaryMax">Max annual</Label>
                  <Input
                    id="salaryMax"
                    type="number"
                    value={expectedSalaryMax}
                    onChange={(e) => setExpectedSalaryMax(e.target.value)}
                    placeholder="e.g. 1800000"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 7: Equal Opportunity (optional) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Equal Opportunity Information{" "}
                <span className="text-sm font-normal text-muted-foreground">(optional)</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                This information is voluntary and will not affect your application.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Non-binary">Non-binary</SelectItem>
                      <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Veteran status</Label>
                  <Select value={veteranStatus} onValueChange={setVeteranStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Not a veteran">Not a veteran</SelectItem>
                      <SelectItem value="Veteran">Veteran</SelectItem>
                      <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Disability status</Label>
                  <Select value={disabilityStatus} onValueChange={setDisabilityStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="No disability">No disability</SelectItem>
                      <SelectItem value="Has disability">Has disability</SelectItem>
                      <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Turnstile */}
          <Turnstile onToken={setTurnstileToken} />

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveCoreInfo}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {showSaveSuccess ? "Saved!" : "Save as core info"}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              size="lg"
              className="bg-brand text-brand-foreground hover:bg-brand-glow"
            >
              {submitting ? "Submitting..." : "Submit application"}
            </Button>
          </div>
        </form>
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}
