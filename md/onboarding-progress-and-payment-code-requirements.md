# Onboarding Progress + Payment Code Requirements

## Goal
Improve onboarding reliability and recovery, and add a code-based free access option in payment.

## 1) Save progress after every onboarding step

- Persist onboarding progress to DB **after each step is completed**, not only at the end of full onboarding.
- This is required so we can track where/when a user dropped off.
- For each completed step, store at least:
  - `user_id`
  - `step_key` or `step_number`
  - `completed_at` timestamp
  - optional: `onboarding_version`

### Expected behavior
- If a user completes step N, that completion is saved immediately.
- If the session/browser closes unexpectedly, already completed steps remain saved.

## 2) Resume onboarding on return

- If user leaves and later returns to the site:
  - Show onboarding again.
  - Start from the **first incomplete step**.
  - Skip all steps already completed in DB.
- User should never be forced to redo completed steps unless explicitly reset by admin logic.

## 3) Payment screen: code option + commitment option

Add a code input in payment flow with backend validation API.

### API requirement
- Add a new API endpoint in `server/index.js` for code validation.
- Name TBD later (example idea: `POST /api/subscription/validate-code`).
- Endpoint should validate submitted code against a DB table (to be connected later).

### If code is valid
- User can skip payment and continue freely.
- User still receives AI bot messages/features.
- In `chat_users` update:
  - `subscription_type = 'free_tier'`
  - `subscription_status = 'active'`

### Additional option in UI
- Show a small explicit commitment option (checkbox or equivalent):
  - "I trust myself and I commit to using the bot and not skipping more than 4 days."
- This option is part of the free/code-based path.

## Acceptance Criteria

- Onboarding step completion is saved immediately after each step.
- Returning users resume from first unfinished onboarding step.
- Payment flow includes a code input + backend validation endpoint.
- Valid code activates user as free tier (`free_tier`, `active`) without payment.
- Commitment option is visible and can be selected in this path.
