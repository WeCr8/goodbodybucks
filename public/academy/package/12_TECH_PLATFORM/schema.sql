-- ============================================================
-- GOODBODY SUMMER ACADEMY — DATABASE SCHEMA
-- Supabase / PostgreSQL
-- Includes: RLS, RBAC, GBB ledger, video library, progress
-- ============================================================

-- ─── EXTENSIONS ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ───────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('super_admin', 'teacher', 'student', 'guardian');
CREATE TYPE gbb_source_type AS ENUM (
  'lesson_complete', 'writing_page', 'math_challenge',
  'read_20_min', 'teach_it_back', 'sports_goal_achieved',
  'project_milestone', 'help_sibling', 'perfect_week',
  'bonus_challenge', 'video_watched', 'teacher_manual_award',
  'void', 'adjustment'
);
CREATE TYPE lesson_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE milestone_status AS ENUM ('not_started', 'in_progress', 'complete');
CREATE TYPE goal_status AS ENUM ('not_started', 'in_progress', 'achieved');

-- ============================================================
-- USERS & AUTH
-- ============================================================

-- user_profiles: extends Supabase auth.users
CREATE TABLE user_profiles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       VARCHAR(20)  UNIQUE NOT NULL,   -- e.g. usr_miles_001
  username      VARCHAR(50)  UNIQUE NOT NULL,   -- e.g. miles_goodbody
  display_name  VARCHAR(100) NOT NULL,          -- e.g. Miles G.
  email         VARCHAR(255) UNIQUE,
  role          user_role    NOT NULL DEFAULT 'student',
  grade_level   SMALLINT,                       -- 1-12
  auth_uid      UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_ids    VARCHAR(20)[],                  -- guardian user_ids
  metadata      JSONB        DEFAULT '{}',
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE
);

-- helper: current user's user_id from JWT
CREATE OR REPLACE FUNCTION current_user_id() RETURNS VARCHAR(20) AS $$
  SELECT user_id FROM user_profiles WHERE auth_uid = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- helper: current user's role
CREATE OR REPLACE FUNCTION current_user_role() RETURNS user_role AS $$
  SELECT role FROM user_profiles WHERE auth_uid = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── RLS: user_profiles ──────────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Students see only their own profile
CREATE POLICY "student_read_own_profile"
  ON user_profiles FOR SELECT
  USING (
    auth_uid = auth.uid()
    OR current_user_role() IN ('super_admin', 'teacher')
    OR (current_user_role() = 'guardian' AND user_id = ANY(
      SELECT UNNEST(parent_ids) FROM user_profiles WHERE auth_uid = auth.uid()
    ))
  );

-- Only super_admin can create/delete users
CREATE POLICY "admin_manage_profiles"
  ON user_profiles FOR ALL
  USING (current_user_role() = 'super_admin');

-- ============================================================
-- SUBJECTS
-- ============================================================

CREATE TABLE subjects (
  subject_id    VARCHAR(20)  PRIMARY KEY,       -- e.g. sub_MATH2
  code          VARCHAR(10)  UNIQUE NOT NULL,   -- e.g. MATH2
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  grade_levels  SMALLINT[]   NOT NULL,          -- [2] or [5] or [2,5]
  color_hex     VARCHAR(7),
  icon          VARCHAR(10),
  sort_order    SMALLINT     DEFAULT 0,
  is_active     BOOLEAN      DEFAULT TRUE,
  created_by    VARCHAR(20)  REFERENCES user_profiles(user_id)
);

-- Subjects are readable by all authenticated users
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_read_subjects" ON subjects FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "teacher_write_subjects" ON subjects FOR ALL
  USING (current_user_role() IN ('super_admin', 'teacher'));

-- ============================================================
-- VIDEO LIBRARY
-- ============================================================

CREATE TABLE video_library (
  video_id          VARCHAR(30)  PRIMARY KEY,  -- e.g. vid_dQw4w9WgXcQ
  youtube_id        VARCHAR(20)  UNIQUE NOT NULL,
  title             VARCHAR(200) NOT NULL,
  description       TEXT,
  subject_id        VARCHAR(20)  REFERENCES subjects(subject_id),
  grade_levels      SMALLINT[],
  duration_seconds  INTEGER,
  thumbnail_url     TEXT GENERATED ALWAYS AS (
    'https://img.youtube.com/vi/' || youtube_id || '/maxresdefault.jpg'
  ) STORED,
  embed_url         TEXT GENERATED ALWAYS AS (
    'https://www.youtube-nocookie.com/embed/' || youtube_id || '?rel=0&modestbranding=1&enablejsapi=1'
  ) STORED,
  gbb_on_complete   SMALLINT     DEFAULT 2,
  added_by          VARCHAR(20)  REFERENCES user_profiles(user_id),
  approved          BOOLEAN      DEFAULT FALSE,
  approved_by       VARCHAR(20)  REFERENCES user_profiles(user_id),
  tags              TEXT[],
  metadata          JSONB        DEFAULT '{}',
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- RLS: all can read approved videos; only teacher+ can add/approve
ALTER TABLE video_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_approved_videos"
  ON video_library FOR SELECT
  USING (approved = TRUE OR current_user_role() IN ('super_admin', 'teacher'));
CREATE POLICY "teacher_manage_videos"
  ON video_library FOR ALL
  USING (current_user_role() IN ('super_admin', 'teacher'));

-- Track watch progress per user
CREATE TABLE video_watch_log (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         VARCHAR(20) NOT NULL REFERENCES user_profiles(user_id),
  video_id        VARCHAR(30) NOT NULL REFERENCES video_library(video_id),
  watch_pct       SMALLINT    NOT NULL DEFAULT 0,  -- 0-100
  completed       BOOLEAN     GENERATED ALWAYS AS (watch_pct >= 80) STORED,
  gbb_awarded     BOOLEAN     DEFAULT FALSE,
  watched_at      TIMESTAMPTZ DEFAULT NOW(),
  session_date    DATE        DEFAULT CURRENT_DATE,
  UNIQUE(user_id, video_id, session_date)
);

ALTER TABLE video_watch_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_own_watch_log"
  ON video_watch_log FOR ALL
  USING (
    user_id = current_user_id()
    OR current_user_role() IN ('super_admin', 'teacher')
  );

-- ============================================================
-- LESSONS
-- ============================================================

CREATE TABLE lessons (
  lesson_id       VARCHAR(30)  PRIMARY KEY,    -- e.g. les_math_001
  subject_id      VARCHAR(20)  NOT NULL REFERENCES subjects(subject_id),
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  grade_level     SMALLINT     NOT NULL,
  objectives      TEXT[]       NOT NULL,       -- I CAN / I WILL / I KNOW
  content_json    JSONB        DEFAULT '{}',   -- slides content
  videos          VARCHAR(30)[],               -- video_ids in order
  duration_min    SMALLINT     DEFAULT 45,
  gbb_reward      SMALLINT     DEFAULT 5,
  bonus_gbb       SMALLINT     DEFAULT 8,
  status          lesson_status DEFAULT 'draft',
  created_by      VARCHAR(20)  REFERENCES user_profiles(user_id),
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_active_lessons"
  ON lessons FOR SELECT
  USING (status = 'active' OR current_user_role() IN ('super_admin', 'teacher'));
CREATE POLICY "teacher_write_lessons"
  ON lessons FOR ALL
  USING (current_user_role() IN ('super_admin', 'teacher'));

-- Per-student lesson assignments
CREATE TABLE lesson_assignments (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         VARCHAR(20) NOT NULL REFERENCES user_profiles(user_id),
  lesson_id       VARCHAR(30) NOT NULL REFERENCES lessons(lesson_id),
  assigned_by     VARCHAR(20) REFERENCES user_profiles(user_id),
  assigned_date   DATE        DEFAULT CURRENT_DATE,
  due_date        DATE,
  completed       BOOLEAN     DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  score           SMALLINT,   -- optional 0-100
  notes           TEXT,
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE lesson_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_own_assignments"
  ON lesson_assignments FOR SELECT
  USING (
    user_id = current_user_id()
    OR current_user_role() IN ('super_admin', 'teacher')
  );
CREATE POLICY "student_complete_own"
  ON lesson_assignments FOR UPDATE
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());
CREATE POLICY "teacher_manage_assignments"
  ON lesson_assignments FOR ALL
  USING (current_user_role() IN ('super_admin', 'teacher'));

-- ============================================================
-- GBB LEDGER
-- ============================================================

CREATE TABLE gbb_ledger (
  id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  gbb_id          VARCHAR(30)     UNIQUE NOT NULL
                    DEFAULT 'gbb_' || REPLACE(gen_random_uuid()::text, '-', ''),
  user_id         VARCHAR(20)     NOT NULL REFERENCES user_profiles(user_id),
  amount          SMALLINT        NOT NULL,           -- positive = earn, negative = spend
  source_type     gbb_source_type NOT NULL,
  source_id       VARCHAR(50),                        -- lesson_id, goal_id, etc.
  awarded_by      VARCHAR(20)     REFERENCES user_profiles(user_id),
  awarded_by_agent VARCHAR(50),                       -- agent_id if automated
  note            TEXT,
  voided          BOOLEAN         DEFAULT FALSE,
  voided_by       VARCHAR(20)     REFERENCES user_profiles(user_id),
  voided_at       TIMESTAMPTZ,
  metadata        JSONB           DEFAULT '{}',
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  session_date    DATE            NOT NULL DEFAULT CURRENT_DATE
);

-- Materialized balance view
CREATE VIEW gbb_balances AS
  SELECT
    user_id,
    SUM(amount) FILTER (WHERE NOT voided) AS balance,
    SUM(amount) FILTER (WHERE NOT voided AND session_date >= DATE_TRUNC('week', CURRENT_DATE)) AS this_week,
    SUM(amount) FILTER (WHERE NOT voided AND session_date >= DATE_TRUNC('month', CURRENT_DATE)) AS this_month,
    COUNT(*) FILTER (WHERE NOT voided AND amount > 0) AS total_transactions,
    MAX(session_date) AS last_activity
  FROM gbb_ledger
  GROUP BY user_id;

ALTER TABLE gbb_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_read_own_gbb"
  ON gbb_ledger FOR SELECT
  USING (
    user_id = current_user_id()
    OR current_user_role() IN ('super_admin', 'teacher')
  );
-- Students CANNOT write to ledger — only agents/teachers
CREATE POLICY "teacher_write_gbb"
  ON gbb_ledger FOR INSERT
  USING (current_user_role() IN ('super_admin', 'teacher'));

-- Idempotency check function
CREATE OR REPLACE FUNCTION check_gbb_idempotency(
  p_user_id    VARCHAR(20),
  p_source_id  VARCHAR(50),
  p_date       DATE DEFAULT CURRENT_DATE
) RETURNS UUID AS $$
  SELECT id FROM gbb_ledger
  WHERE user_id = p_user_id
    AND source_id = p_source_id
    AND session_date = p_date
    AND NOT voided
  LIMIT 1
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- SPORTS GOALS
-- ============================================================

CREATE TABLE sports_goals (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id         VARCHAR(30)   UNIQUE NOT NULL,  -- e.g. goal_baseball_001
  user_id         VARCHAR(20)   NOT NULL REFERENCES user_profiles(user_id),
  sport           VARCHAR(50)   NOT NULL,          -- "baseball" | "softball"
  title           TEXT          NOT NULL,
  description     TEXT,
  how_to_achieve  TEXT,
  gbb_reward      SMALLINT      DEFAULT 15,
  status          goal_status   DEFAULT 'not_started',
  achieved_at     TIMESTAMPTZ,
  achieved_notes  TEXT,
  verified_by     VARCHAR(20)   REFERENCES user_profiles(user_id),
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE sports_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_own_goals"
  ON sports_goals FOR SELECT
  USING (
    user_id = current_user_id()
    OR current_user_role() IN ('super_admin', 'teacher')
  );
CREATE POLICY "teacher_manage_goals"
  ON sports_goals FOR ALL
  USING (current_user_role() IN ('super_admin', 'teacher'));

-- ============================================================
-- BETTER YOURSELF PROJECTS
-- ============================================================

CREATE TABLE projects (
  id              UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      VARCHAR(30)       UNIQUE NOT NULL,
  user_id         VARCHAR(20)       NOT NULL REFERENCES user_profiles(user_id),
  project_type    VARCHAR(50)       NOT NULL,  -- "photography", "building", etc.
  title           TEXT              NOT NULL,
  goal_statement  TEXT,
  milestone_1_desc  TEXT,
  milestone_1_due   DATE,
  milestone_1_status milestone_status DEFAULT 'not_started',
  milestone_1_gbb   SMALLINT DEFAULT 20,
  milestone_2_desc  TEXT,
  milestone_2_due   DATE,
  milestone_2_status milestone_status DEFAULT 'not_started',
  milestone_2_gbb   SMALLINT DEFAULT 20,
  final_reveal_date DATE,
  final_reveal_status milestone_status DEFAULT 'not_started',
  final_reveal_gbb  SMALLINT DEFAULT 30,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_own_project"
  ON projects FOR SELECT
  USING (
    user_id = current_user_id()
    OR current_user_role() IN ('super_admin', 'teacher')
  );
CREATE POLICY "teacher_write_projects"
  ON projects FOR ALL
  USING (current_user_role() IN ('super_admin', 'teacher'));

-- ============================================================
-- AGENT AUDIT LOG
-- ============================================================

CREATE TABLE agent_audit_log (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id        VARCHAR(50) NOT NULL,
  action          VARCHAR(100) NOT NULL,
  user_id         VARCHAR(20) REFERENCES user_profiles(user_id),
  resource_type   VARCHAR(50),
  resource_id     VARCHAR(50),
  result          VARCHAR(20) NOT NULL,  -- SUCCESS, FAILURE, SKIPPED, SECURITY_EVENT
  details         JSONB       DEFAULT '{}',
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log: append-only, readable by admins only
ALTER TABLE agent_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_audit"
  ON agent_audit_log FOR SELECT
  USING (current_user_role() = 'super_admin');
CREATE POLICY "agents_write_audit"
  ON agent_audit_log FOR INSERT
  WITH CHECK (TRUE);  -- Service role only — agents use service key for this table

-- ============================================================
-- WEEKLY REPORTS
-- ============================================================

CREATE TABLE weekly_reports (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         VARCHAR(20) NOT NULL REFERENCES user_profiles(user_id),
  week_number     SMALLINT    NOT NULL,
  week_start      DATE        NOT NULL,
  week_end        DATE        NOT NULL,
  report_md       TEXT,       -- Markdown report content
  lessons_completed SMALLINT  DEFAULT 0,
  gbb_earned      SMALLINT    DEFAULT 0,
  gbb_delta       SMALLINT    DEFAULT 0,
  goals_achieved  TEXT[],
  generated_by    VARCHAR(50), -- agent_id
  generated_at    TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(user_id, week_number)
);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_own_reports"
  ON weekly_reports FOR SELECT
  USING (
    user_id = current_user_id()
    OR current_user_role() IN ('super_admin', 'teacher')
  );

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Create a new academy user (called by super_admin)
CREATE OR REPLACE FUNCTION create_academy_user(
  p_username     VARCHAR(50),
  p_display_name VARCHAR(100),
  p_email        VARCHAR(255),
  p_role         user_role DEFAULT 'student',
  p_grade_level  SMALLINT DEFAULT NULL,
  p_metadata     JSONB DEFAULT '{}'
) RETURNS VARCHAR(20) AS $$
DECLARE
  v_seq     INT;
  v_user_id VARCHAR(20);
BEGIN
  SELECT COALESCE(MAX(REGEXP_REPLACE(user_id, '[^0-9]', '', 'g')::INT), 0) + 1
    INTO v_seq FROM user_profiles;
  v_user_id := 'usr_' || LOWER(SPLIT_PART(p_username, '_', 1)) || '_' || LPAD(v_seq::TEXT, 3, '0');
  INSERT INTO user_profiles (user_id, username, display_name, email, role, grade_level, metadata)
  VALUES (v_user_id, p_username, p_display_name, p_email, p_role, p_grade_level, p_metadata);
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Award GBB with idempotency check
CREATE OR REPLACE FUNCTION award_gbb(
  p_user_id      VARCHAR(20),
  p_amount       SMALLINT,
  p_source_type  gbb_source_type,
  p_source_id    VARCHAR(50),
  p_awarded_by   VARCHAR(20) DEFAULT NULL,
  p_agent_id     VARCHAR(50) DEFAULT NULL,
  p_note         TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  existing_id UUID;
  new_id      UUID;
BEGIN
  -- Idempotency check
  existing_id := check_gbb_idempotency(p_user_id, p_source_id, CURRENT_DATE);
  IF existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'duplicate', 'existing_id', existing_id);
  END IF;
  INSERT INTO gbb_ledger (user_id, amount, source_type, source_id, awarded_by, awarded_by_agent, note)
  VALUES (p_user_id, p_amount, p_source_type, p_source_id, p_awarded_by, p_agent_id, p_note)
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('status', 'success', 'gbb_id', new_id, 'amount', p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER touch_user_profiles BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_lessons BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_projects BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_gbb_user_date   ON gbb_ledger (user_id, session_date DESC);
CREATE INDEX idx_gbb_source      ON gbb_ledger (source_id, user_id);
CREATE INDEX idx_lessons_subject ON lessons (subject_id, grade_level);
CREATE INDEX idx_assignments_user ON lesson_assignments (user_id, completed);
CREATE INDEX idx_video_subject   ON video_library (subject_id, approved);
CREATE INDEX idx_sports_goals_user ON sports_goals (user_id, sport);
CREATE INDEX idx_audit_agent     ON agent_audit_log (agent_id, created_at DESC);
