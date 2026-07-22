-- City autocomplete for cities500 (~230k rows).
-- Prefix-only on name/asciiname (no alternatenames mid-match — that forces seq scans).
-- name + asciiname also power bilingual display labels (e.g. Jerusalem - ירושלים).
-- Filter by country first, prefer high-population matches, cap results (Hick's Law).
--
-- mode=quick → LIMIT 2 (confidence probe)
-- mode=full  → LIMIT 10–15 (autocomplete list)
--
-- Parameters: $1 = country_code (e.g. 'IL'), $2 = search prefix (e.g. 'Tel%'), $3 = limit

-- Recommended composite indexes (apply on chat/admin Supabase when possible):
CREATE INDEX IF NOT EXISTS idx_cities500_country_name
  ON public.cities500 (country_code, name);
CREATE INDEX IF NOT EXISTS idx_cities500_country_asciiname
  ON public.cities500 (country_code, asciiname);

SELECT
  geonameid,
  name,
  asciiname,
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
  )
ORDER BY population DESC NULLS LAST
LIMIT $3;
