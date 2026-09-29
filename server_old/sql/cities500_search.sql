-- City autocomplete for cities500 (~230k rows).
-- Prefix on name/asciiname; mid-match on alternatenames for local scripts (e.g. תל אביב).
-- Always filter by country first so alternatenames ILIKE stays cheap.
-- name + asciiname also power bilingual display labels (e.g. Jerusalem - ירושלים).
-- Prefer high-population matches, cap results (Hick's Law).
--
-- mode=quick → LIMIT 2 (confidence probe)
-- mode=full  → LIMIT 10–15 (autocomplete list)
--
-- Parameters: $1 = country_code (e.g. 'IL'), $2 = search prefix (e.g. 'Tel%'),
--             $3 = alternatenames pattern (e.g. '%תל אביב%'), $4 = limit

-- Recommended composite indexes (apply on chat/admin Supabase when possible):
CREATE INDEX IF NOT EXISTS idx_cities500_country_name
  ON public.cities500 (country_code, name);
CREATE INDEX IF NOT EXISTS idx_cities500_country_asciiname
  ON public.cities500 (country_code, asciiname);

SELECT
  geonameid,
  name,
  asciiname,
  alternatenames,
  country_code,
  latitude,
  longitude,
  timezone,
  population
FROM public.cities500
WHERE country_code = $1
  AND (
    name ILIKE $2
    OR asciiname ILIKE $2
    OR alternatenames ILIKE $3
  )
ORDER BY population DESC NULLS LAST
LIMIT $4;
