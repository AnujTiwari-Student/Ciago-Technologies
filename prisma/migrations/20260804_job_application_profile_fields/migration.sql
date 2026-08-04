ALTER TABLE "public"."job_applications"
ADD COLUMN "offered_at" TIMESTAMPTZ(6),
ADD COLUMN "hired_at" TIMESTAMPTZ(6),
ADD COLUMN "educational_qualifications" JSONB,
ADD COLUMN "previous_work_experiences" JSONB;
