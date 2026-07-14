# SSIH Kick Off '26 — Costume Contest (reuse + setup guide)

Next.js (App Router) + Firestore + Cloudinary. Single-choice voting (one final
vote per person), live open/close control, and a tap-to-reveal winners screen.

--------------------------------------------------------------------------------
## 0. Run it
```
npm install
cp .env.local.example .env.local     # then fill in your values (step 1)
npm run dev                          # http://localhost:3000
```
(The app also runs without .env.local using built-in fallbacks, but for your own
event / a public repo, use env vars.)

--------------------------------------------------------------------------------
## 1. Firebase project + env

`.env.local` holds your config (all keys are NEXT_PUBLIC_, so they reach the
browser — they are NOT secrets; security lives in firestore.rules).

  - New event, clean slate (recommended): create a new Firebase project, put its
    web-app config into `.env.local`.
  - Reuse the old project: delete the old `contestants` collection first, or last
    event's entries show up.

--------------------------------------------------------------------------------
## 2. Admin auth (makes the lock real)

  1. Firebase Console -> Authentication -> enable "Email/Password".
  2. Authentication -> Users -> Add user. Create ONE organizer account.
  3. Copy that user's User UID.

--------------------------------------------------------------------------------
## 3. Deploy security rules (do NOT skip)

Open `firestore.rules`, replace `REPLACE_WITH_ADMIN_UID` with the UID from step 2,
paste into Firebase Console -> Firestore -> Rules -> Publish.

Enforced:
  - anyone can read the gallery, leaderboard, and voting state
  - a voter can only bump `votes` by EXACTLY +1, and only while voting is OPEN
  - only the signed-in admin can add / edit / delete entries or open/close voting

--------------------------------------------------------------------------------
## 4. Cloudinary

Set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
in `.env.local`. The preset must be UNSIGNED. Uploaded photos are auto-resized and
compressed on delivery (via `lib/img.js`), so raw phone photos won't choke wifi.

--------------------------------------------------------------------------------
## 5. Run of show

  1. Before the event: sign in at `/admin`, add each costume (name + photo).
     Voting defaults to OPEN.
  2. Project the landing page (`/`) — tap the QR for fullscreen. People scan ->
     `/` -> "LET'S VOTE" -> `/vote`. Each person gets ONE final vote.
  3. To stop voting: `/admin` -> click "Voting open" to flip it to "Voting closed".
     Vote buttons across all phones disable instantly and show a closed banner.
  4. Open `/results` on the projector. It starts on a "Tap to reveal" curtain;
     tap to reveal 3rd -> 2nd -> 1st (confetti on the winner). Honorable mentions
     appear after the winner. (No link to /results in the UI on purpose — you drive it.)

--------------------------------------------------------------------------------
## Voting model

SINGLE-CHOICE: one vote per person, final (no changing it — prevents a -1 exploit
under the +1-only rule). The lock is a `localStorage` record; per your call, that's
"good enough" for a casual prize.

To switch to APPROVAL voting (vote for multiple costumes), see the commented note
on `handleVote` in `app/vote/page.js` — make `votedFor` a Set and change the guard.

--------------------------------------------------------------------------------
## What changed vs the PJ app
  - Full reskin to the Summer Kick Off costume contest (green/gold).
  - Real Firebase admin login replaces the fake client-side passkey.
  - firestore.rules: votes only +1, only while open; entries + config locked to admin.
  - Single-choice final voting (was: could vote for every entry).
  - Admin voting open/close toggle (config/event doc); live "closed" state for voters.
  - Gallery order shuffled per session (removes top-of-list bias).
  - Results: tap-to-reveal podium (3rd -> 2nd -> 1st), tie note, robust for 1/2/3+ entries.
  - Cloudinary images served resized + compressed.
  - Config moved to NEXT_PUBLIC_ env vars (.env.local).
  - Shared helpers (lib/rank.js, lib/img.js, lib/config.js) — no more copy-paste.
  - Inline toast replaces blocking alert() in the vote flow.
  - Removed the redundant /upload route; localStorage key namespaced to this event.

--------------------------------------------------------------------------------
## Known residual risk (accepted: casual, zero-friction)
  - No voter sign-in, so a full site-data wipe lets someone vote again, and a
    scripted +1 loop is possible. Fine for a fun dorm prize. If the prize ever
    becomes contested, gate `/vote` behind Google sign-in restricted to your
    school domain — ask and I'll wire it.
