
ALTER TABLE public.onboarding_documents
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

ALTER TABLE public.onboarding_documents
  DROP CONSTRAINT IF EXISTS onboarding_documents_onboarding_id_doc_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS onboarding_documents_current_unique
  ON public.onboarding_documents (onboarding_id, doc_key)
  WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS onboarding_documents_history_idx
  ON public.onboarding_documents (onboarding_id, doc_key, version DESC);
