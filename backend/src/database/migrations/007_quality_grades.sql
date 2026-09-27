-- ============================================================
-- QUALITY GRADE MASTER (replaces the free-text A/B/C quality grading)
-- inwards/lots reference a grade by quality_grade_id; their `quality`
-- text column keeps a copy of the grade name for display/PDFs and is
-- kept in step when a grade is renamed (see qualityGrade.service.js).
-- ============================================================
CREATE TABLE IF NOT EXISTS quality_grades (
  id          bigserial PRIMARY KEY,
  grade_name  text NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_quality_grades_name ON quality_grades (lower(grade_name));
CREATE TRIGGER trg_quality_grades_touch BEFORE UPDATE ON quality_grades
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

INSERT INTO quality_grades (grade_name) VALUES ('Premium'), ('Good'), ('Fair')
ON CONFLICT DO NOTHING;

ALTER TABLE inwards ADD COLUMN IF NOT EXISTS quality_grade_id bigint REFERENCES quality_grades(id);
ALTER TABLE lots    ADD COLUMN IF NOT EXISTS quality_grade_id bigint REFERENCES quality_grades(id);
CREATE INDEX IF NOT EXISTS idx_lots_quality_grade ON lots (quality_grade_id);
CREATE INDEX IF NOT EXISTS idx_inwards_quality_grade ON inwards (quality_grade_id);

-- Legacy letter grades: A -> Premium, B -> Good, C and lower -> Fair.
WITH legacy AS (
  SELECT id,
         CASE upper(left(trim(regexp_replace(quality, '(?i)grade', '', 'g')), 1))
           WHEN 'A' THEN 'Premium'
           WHEN 'B' THEN 'Good'
           ELSE 'Fair'
         END AS grade_name
    FROM inwards
   WHERE quality IS NOT NULL AND trim(quality) <> '' AND quality_grade_id IS NULL
)
UPDATE inwards i
   SET quality_grade_id = g.id, quality = g.grade_name
  FROM legacy x JOIN quality_grades g ON lower(g.grade_name) = lower(x.grade_name)
 WHERE i.id = x.id;

UPDATE lots l
   SET quality_grade_id = i.quality_grade_id, quality = i.quality
  FROM inwards i
 WHERE i.id = l.inward_id AND l.quality_grade_id IS NULL AND i.quality_grade_id IS NOT NULL;
