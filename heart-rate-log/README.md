# Heart Rate Log

A small installable web app for logging elevated-heart-rate episodes — date/time, duration,
intensity, symptoms (lightheadedness, skipped beats, etc.), activity/context, heart rate,
and notes. Data is stored in your own Airtable base.

This is **Phase 1** of the plan: manual logging with a browsable/editable history grid.
EKG PDF attachments (Phase 2), intensity/duration/frequency charts (Phase 3), and pulling
real heart-rate readings from Fitbit (Phase 4) come next.

## How this all fits together (ELI5)

There are three separate pieces here, and it helps to know what each one actually does:

- **The app (this code)** — just a folder of files: an HTML "form," some styling, and some
  JavaScript logic. On its own, a folder of files isn't reachable from your phone — it needs
  somewhere to live on the internet.

- **Vercel** — a free hosting service. All it does is take this folder of files and give it a
  real web address (`https://something.vercel.app`) so your phone's browser can fetch it, the
  same way any website is fetched. **Vercel never sees or stores any of your health data.** It
  only ever hands out the same unchanging form/logic files. Every time you open the app, your
  phone downloads those files fresh (or from its own cache) and runs them locally.

- **Airtable** — the actual filing cabinet. Every entry you log is a row that lives here, not
  on Vercel and not on your phone. When you tap "Log Entry," the app running in your phone's
  browser reaches out **directly** to Airtable's servers and writes the row itself — Vercel is
  not involved in that step at all, it only served the code once when the page loaded.

- **The Personal Access Token (PAT)** — think of this like a key or an employee badge. It's
  what lets *this specific app* unlock and write into *your specific* Airtable filing cabinet.
  Anyone with that token string can read/write your entries — that's why it's typed into
  Settings once and kept only on your own device, never in the code itself.

Rough analogy: Vercel is like the ordering screen at a restaurant kiosk. Airtable is the
kitchen where the food (your data) actually lives. The token is the badge that lets this one
kiosk swing open the kitchen door.

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

## Who has access to what

Three different "logins" are involved, and each controls something different:

| Account | Controls | Who needs one |
|---|---|---|
| **Vercel** | Can edit/redeploy the app's code, see deployment logs | Just you (whoever owns the GitHub repo) |
| **The deployed URL** | Anyone who opens it can *see the app shell* | Technically anyone with the exact link — but it's useless without a valid token, so treat it as a private link rather than something requiring a password |
| **The Personal Access Token + Base ID + Table name** | Whoever enters these into the app's Settings screen can read/write every entry | Whoever you give the token to |

**No one needs a Vercel account or an Airtable account just to use the app day-to-day** —
opening the URL, installing it to a home screen, and logging entries all work with zero login,
because the token itself (not a username/password) is what authorizes the app to talk to
Airtable.

### Giving your wife access to the same log

The simplest way — have her use the same app, pointed at the same data:

1. Send her the deployed URL (text, AirDrop, whatever)
2. She opens it in **Safari** on her phone → Share icon → **Add to Home Screen**, same as you did
3. In Settings, she enters the **exact same** Personal Access Token, Base ID, and table name you're using

That's it — her phone is now just a second window into the same Airtable base. Nothing to
invite, nothing to approve, no Airtable account needed on her end at all. The one limitation:
since both of you are using the same token, Airtable has no way of recording *which of you*
logged a given entry — if that ever matters, we could add a simple "Logged by" field to the
form later.

If instead she wants to browse or edit the raw data directly in Airtable's own app/website
(rather than through this app), that's a separate, second kind of access: you'd click
**Share** on the Airtable base itself and invite her as a collaborator by email — that does
require her to have (or create) a free Airtable account, and is unrelated to the token.

## Privacy

This is health data. Keep the Airtable base private, don't share the Personal Access Token,
and don't deploy the site anywhere that would index or publicly list it — treat the deploy URL
like a private link.
