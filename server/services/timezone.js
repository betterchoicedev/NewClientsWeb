/**
 * The client's time zone, as reported by their phone (POST /api/profile/timezone).
 *
 * chat_users.timezone drives the server's idea of the client's day: streak/points "today",
 * WhatsApp meal logs, and Beti's nudges. Onboarding stamps it from the chosen city, but rows
 * created before that step (or by the old WhatsApp bot) have none, and travel changes it.
 * The app sends the phone's IANA zone on launch and on return to the foreground when it
 * changed (and at least daily), and this saves it.
 *
 * Travel: when a real zone changes, the old one is kept as `timezone_previous` with
 * `timezone_changed_at` (the signal for a future "on vacation?" question). Those two columns
 * do not exist yet: the write is skipped quietly until they are added (SQL in the PR).
 * clients.timezone (Clients DB) is kept in step, as savePersonal does.
 */

const UTC_ZONES = new Set(['UTC', 'Etc/UTC', 'Etc/GMT', 'GMT', 'Etc/Universal', 'Etc/Zulu', 'Universal', 'Zulu']);
const IANA = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+){1,2}$/;
// Postgres "undefined column" and PostgREST "column not in schema cache".
const MISSING_COLUMN_CODES = new Set(['42703', 'PGRST204']);

function httpError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

/**
 * The zone name as the phone sent it (trimmed) when the server's ICU knows it, else null.
 * Offsets ("+02:00") are refused. The name is not canonicalised: ICU would turn
 * Asia/Kolkata into the legacy Asia/Calcutta.
 */
function canonicalZone(value) {
  if (typeof value !== 'string') return null;
  const zone = value.trim();
  if (!zone || zone.length > 64) return null;
  if (!UTC_ZONES.has(zone) && !IANA.test(zone)) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }); // throws RangeError for unknown zones
    return zone;
  } catch {
    return null;
  }
}

function isUtc(zone) {
  return UTC_ZONES.has(zone);
}

/**
 * What to save, given the saved zone and the phone's.
 * - Same zone: nothing.
 * - The phone says UTC but a real zone is saved: keep the saved one (emulators, misconfigured
 *   phones and some Android builds report UTC; nobody travels to "UTC").
 * - Otherwise save the phone's zone, and the saved real zone becomes `previous`.
 */
function decideTimezone(savedRaw, reported) {
  const saved = canonicalZone(savedRaw);
  if (saved && saved === reported) return { changed: false, timezone: saved, previous: null };
  if (saved && !isUtc(saved) && isUtc(reported)) {
    return { changed: false, timezone: saved, previous: null, ignored: 'utc' };
  }
  return { changed: true, timezone: reported, previous: saved && !isUtc(saved) ? saved : null };
}

/**
 * Save the phone's zone for the signed-in client. Returns
 * { timezone, previous, changed } where `previous` is the zone it replaced (null when none).
 */
async function saveDeviceTimezone(userCode, userId, reportedRaw, { adminDB, clientDB, now = new Date() } = {}) {
  if (!userCode) throw httpError(403, 'No client profile for this account', 'no_user_code');
  const reported = canonicalZone(reportedRaw);
  if (!reported) throw httpError(400, 'timezone must be an IANA time zone such as Asia/Jerusalem', 'bad_timezone');

  const { data: user, error: readError } = await adminDB
    .from('chat_users')
    .select('id, timezone')
    .eq('user_code', userCode)
    .maybeSingle();
  if (readError) throw httpError(500, 'Could not read the client profile', 'db_error');
  if (!user) throw httpError(404, 'Client profile not found', 'no_chat_user');

  const decision = decideTimezone(user.timezone, reported);
  if (!decision.changed) return { timezone: decision.timezone, previous: null, changed: false };

  const { error: writeError } = await adminDB
    .from('chat_users')
    .update({ timezone: decision.timezone })
    .eq('user_code', userCode);
  if (writeError) throw httpError(500, 'Could not save the time zone', 'db_error');

  if (clientDB && userId) {
    const { error } = await clientDB.from('clients').update({ timezone: decision.timezone }).eq('user_id', userId);
    if (error) console.warn('[timezone] clients.timezone not updated:', error.message);
  }

  if (decision.previous) {
    const { error } = await adminDB
      .from('chat_users')
      .update({ timezone_previous: decision.previous, timezone_changed_at: now.toISOString() })
      .eq('user_code', userCode);
    if (error && !MISSING_COLUMN_CODES.has(String(error.code))) {
      console.warn('[timezone] travel history not saved:', error.message);
    }
  }

  return { timezone: decision.timezone, previous: decision.previous, changed: true };
}

module.exports = { canonicalZone, decideTimezone, saveDeviceTimezone, httpError };
