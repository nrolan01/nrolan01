# Heart Rate Log

A small installable web app for logging elevated-heart-rate episodes — date/time, duration,
intensity, symptoms (lightheadedness, skipped beats, etc.), activity/context, heart rate,
and notes. Data is stored in your own Airtable base.

This is **Phase 1** of the plan: manual logging with a browsable/editable history grid.
EKG PDF attachments (Phase 2), intensity/duration/frequency charts (Phase 3), and pulling
real heart-rate readings from Fitbit (Phase 4) come next.

## 1. Create the Airtable base

1. Go to [airtable.com](https://airtable.com) and create a new base named **Heart Rate Log**.
2. Rename the default table to **Episodes** and set up these fields exactly (name and type matter — the app writes to these field names):

   | Field name          | Type                                  |
   |----------------------|----------------------------------------|
   | `Occurred At`        | Date — turn on **"Include a time field"** |
   | `Duration (min)`     | Number                                 |
   | `Intensity`          | Single select (leave options empty — the app auto-creates `1`–`5` the first time you use them) |
   | `Symptoms`           | Multiple select — Light Headed, Heart Racing, Skipped Beat, Tingling/Weak Arms, Short of Breath, Chest Pain/Pressure, Fainting/Near-Fainting, Sweating, Fatigue, Other (or leave empty — auto-created the first time you use them) |
   | `Activity`           | Single line text                       |
   | `Heart Rate (bpm)`   | Number                                 |
   | `Notes`              | Long text                              |
   | `EKG PDF`            | Attachment (not used until Phase 2, but fine to create now) |

3. Copy the **Base ID** from the base's API docs (Help → API documentation, or the URL when the base is open — it starts with `app...`).

## 2. Create a Personal Access Token

1. Go to [airtable.com/create/tokens](https://airtable.com/create/tokens).
2. Create a token scoped to **just this base**, with scopes `data.records:read` and `data.records:write`.
3. Copy the token (starts with `pat...`) — Airtable only shows it once.

## 3. Run it locally to try it out

From this folder:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` in a browser, go to **Settings**, and paste in the token, Base ID,
and table name (`Episodes`). Save & Test Connection should succeed and drop you into the Log tab.

## 4. Deploy so it has a real HTTPS URL (needed for "Add to Home Screen" on iPhone)

Any static host works. Easiest options, pointed at this `heart-rate-log/` folder:

- **Cloudflare Pages** — connect the repo, set the build output directory to `heart-rate-log`, no build command needed.
- **Vercel** or **Netlify** — same idea, "framework preset: none / static site".

Once deployed, open the URL in Safari on your iPhone, tap the Share icon, then **Add to Home Screen**.
It'll launch full-screen like a native app.

## Notes on the data model

- `Occurred At` stores date **and** time in a single Airtable field (Airtable doesn't have a
  separate "time-only" field type) — the app's date/time picker maps to this one field.
- Duration is just minutes — no unit picker.
- `typecast` is enabled on writes, so the app can create new `Intensity`/`Symptoms` select
  options on the fly; you don't need to pre-populate them in Airtable.

## Privacy

This is health data. Keep the Airtable base private, don't share the Personal Access Token,
and don't deploy the site anywhere that would index or publicly list it — treat the deploy URL
like a private link.
