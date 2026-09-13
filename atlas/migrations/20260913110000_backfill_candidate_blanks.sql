-- Candidate rows are written once, and anon may UPDATE only last_seen_at on
-- scrape.portal_candidates (verified 2026-09-13: a zero-row PATCH returns
-- 42501 for email, data, cv_object_key and photo_object_key). Every candidate
-- stored before the 2026-09-13 extractor fixes therefore keeps its blank
-- phone and missing CV forever, even though re-scrapes now capture both — for
-- KitaLulus (phones and CVs) and Glints (contacts and resumes) alike.
--
-- Granting anon UPDATE on those PII columns would let any holder of the anon
-- key overwrite a stored contact or CV reference. This function instead
-- fills only what is blank and never replaces a stored value:
--   * email            — only when blank, and only if no other row of the
--                        same portal already holds it (the (portal, email)
--                        UNIQUE constraint would otherwise fail the refresh);
--   * phone            — data.contact.contact_number, only when blank; written
--                        through `data`, so the talent_scraping projection
--                        trigger (AFTER UPDATE OF "data") re-projects the row;
--   * cv_object_key    — only when blank;
--   * photo_object_key — only when blank;
-- and always refreshes last_seen_at. Blank or NULL arguments change nothing.
CREATE OR REPLACE FUNCTION "scrape"."backfill_candidate_blanks"(
  p_id bigint,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_cv_object_key text DEFAULT NULL,
  p_photo_object_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text := NULLIF(BTRIM(p_email), '');
  v_phone text := NULLIF(BTRIM(p_phone), '');
  v_cv text := NULLIF(BTRIM(p_cv_object_key), '');
  v_photo text := NULLIF(BTRIM(p_photo_object_key), '');
BEGIN
  UPDATE "scrape"."portal_candidates" AS c
  SET
    "email" = CASE
      WHEN NULLIF(BTRIM(c."email"), '') IS NULL
        AND v_email IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "scrape"."portal_candidates" AS other
          WHERE other."portal" = c."portal"
            AND other."email" = v_email
            AND other."id" <> c."id"
        )
      THEN v_email
      ELSE c."email"
    END,
    "data" = CASE
      WHEN v_phone IS NOT NULL
        AND NULLIF(BTRIM(COALESCE(c."data" #>> '{contact,contact_number}', '')), '') IS NULL
      THEN jsonb_set(
        COALESCE(c."data", '{}'::jsonb),
        '{contact}',
        COALESCE(c."data" -> 'contact', '{}'::jsonb)
          || jsonb_build_object(
            'contact_number', v_phone,
            'type', COALESCE(NULLIF(c."data" #>> '{contact,type}', ''), 'phone')
          ),
        true
      )
      ELSE c."data"
    END,
    "cv_object_key" = COALESCE(NULLIF(BTRIM(c."cv_object_key"), ''), v_cv),
    "photo_object_key" = COALESCE(NULLIF(BTRIM(c."photo_object_key"), ''), v_photo),
    "last_seen_at" = now()
  WHERE c."id" = p_id;
END;
$$;

REVOKE ALL ON FUNCTION "scrape"."backfill_candidate_blanks"(bigint, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "scrape"."backfill_candidate_blanks"(bigint, text, text, text, text) TO anon;

COMMENT ON FUNCTION "scrape"."backfill_candidate_blanks"(bigint, text, text, text, text) IS
  'Fill-blanks-only refresh for an existing scraped candidate: sets email (when unclaimed in the portal), data.contact.contact_number, cv_object_key and photo_object_key only where blank, and refreshes last_seen_at. Never overwrites a stored value.';
