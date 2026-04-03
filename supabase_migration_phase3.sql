-- ═══════════════════════════════════════════════════════════
-- Phase 3 마이그레이션: 연습 기록 + 시험 결과 테이블
-- Supabase Dashboard > SQL Editor 에서 실행하세요.
-- ═══════════════════════════════════════════════════════════

-- ── 1. practice_records 테이블 ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.practice_records (
  id             TEXT        PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type   TEXT        NOT NULL CHECK (content_type IN ('melody','rhythm','interval','chord','key','twoVoice')),
  difficulty     TEXT        NOT NULL,
  self_rating    INT         NOT NULL CHECK (self_rating BETWEEN 0 AND 5),
  practiced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_records_user_id
  ON public.practice_records(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_records_practiced_at
  ON public.practice_records(practiced_at DESC);

-- RLS
ALTER TABLE public.practice_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practice_records_select_own"
  ON public.practice_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "practice_records_insert_own"
  ON public.practice_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "practice_records_delete_own"
  ON public.practice_records FOR DELETE
  USING (auth.uid() = user_id);

-- ── 2. exam_sessions 테이블 ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id               TEXT        PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preset_id        TEXT        NOT NULL,
  title            TEXT        NOT NULL,
  total_score      INT         NOT NULL DEFAULT 0,
  max_score        INT         NOT NULL DEFAULT 0,
  total_questions  INT         NOT NULL DEFAULT 0,
  elapsed_seconds  INT         NOT NULL DEFAULT 0,
  category_scores  JSONB       NOT NULL DEFAULT '{}',
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_id
  ON public.exam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_completed_at
  ON public.exam_sessions(completed_at DESC);

-- RLS
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_sessions_select_own"
  ON public.exam_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "exam_sessions_insert_own"
  ON public.exam_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
