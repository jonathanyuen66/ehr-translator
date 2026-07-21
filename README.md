# EHR Translator

A private, invite-only web app that helps patients and their families understand medical scan reports and doctor's notes.

## Problem

Reports from PET scans and other diagnostic imaging are often dense with clinical jargon and raw measurements that are difficult to interpret without a medical background. This is especially hard for people who aren't native English speakers, adding language barriers on top of already-technical content. General-purpose AI tools can help decode these documents, but their outputs aren't grounded in verifiable sources, which is risky for something this consequential.

## Solution

Upload a scan report or doctor's note (PDF), and view it side by side with:

- A plain-language summary and term-by-term annotations, written at a level anyone can understand.
- Citations to relevant PubMed research papers backing each annotation, so explanations are traceable rather than taken on faith.
- The ability to switch annotation language — support for English, Spanish, and Traditional Chinese.
- Hover a highlighted phrase in the original document and its explanation lights up alongside it (and vice versa), so it's always clear what an annotation is actually referring to.

Access is invite-only, and each user's uploaded documents are private to them.

**This tool does not provide medical advice.** It is strictly an aid for understanding the objective content of a document — always consult a qualified healthcare provider for interpretation and decisions about care.

## How it works

- **Backend**: Django + Django REST Framework, PostgreSQL.
- **Frontend**: React (Vite).
- **Annotation pipeline**, run once per document (and cached per language after that):
  1. Text is extracted from the uploaded PDF server-side (`pdfplumber`).
  2. Identifying details (patient name, DOB, MRN, address) are redacted from that text before anything leaves the system.
  3. Gemini reads the de-identified text and picks out the key findings a layperson would need explained, plus search terms for each.
  4. Real papers are retrieved from PubMed (NCBI E-utilities) for each finding — this is the *only* source material the model is ever allowed to cite. Any citation it returns is re-validated against that real list afterward; nothing it invents makes it to the screen.
  5. A second Gemini call writes the plain-language summary and per-finding explanations in the requested language.
- **Document viewer**: the PDF is rendered client-side onto canvas with `pdf.js`, with an invisible text layer on top used to locate each finding's term in the actual document — that's what drives the hover-highlighting between the document and the annotations.
- **Auth**: invite-only, passwordless magic-link email sign-in. See [Login & invites](#login--invites) below.

## Status

Phases 1–6 are built and working locally: auth, upload/storage, the PDF viewer, the annotation pipeline, styling, and multi-language support. Remaining: security hardening and a real (non-dev) deployment.

## Running it locally

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL, running locally
- A free Gemini API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### 1. Database

```bash
createdb ehr_translator
```

### 2. Backend

```bash
python3 -m venv .venv               # from the repo root, if not already created
source .venv/bin/activate
cd server
pip install -r requirements.txt
cp .env.example .env
```

Edit `server/.env`:
- `DB_USER` — your local Postgres role (often your OS username)
- `GEMINI_API_KEY` — required for the annotation pipeline to work
- `PUBMED_API_KEY` — optional, raises the PubMed rate limit

Then:

```bash
python manage.py migrate
python manage.py runserver 8001
```

> If the dev server's autoreloader crashes with an `InterruptedError` (seen in some sandboxed environments), run with `--noreload` instead — you'll just need to restart it manually after backend code changes.

### 3. Frontend

In a separate terminal:

```bash
cd web
npm install
npm run dev
```

Opens on `http://localhost:5173` by default. If either default port (8001 / 5173) is already taken on your machine, Vite/Django will pick another one — update `BACKEND_URL` and `FRONTEND_URL` in `server/.env`, and `VITE_API_BASE_URL` for the frontend (see `web/src/api.js`), to match whatever ports actually end up in use.

## Login & invites

There are no passwords. Signing in works like this:

1. Enter your email on the sign-in screen.
2. If that email is on the invite list, the app sends a one-time sign-in link (valid 15 minutes).
3. Click it and you're signed in.

### Adding someone to the invite list

Only invited emails can sign in — there's no public sign-up. Add one via the Django shell:

```bash
cd server && source ../.venv/bin/activate
python manage.py shell -c "
from accounts.models import Invite
Invite.objects.get_or_create(email='someone@example.com')
"
```

There's no admin UI for this yet. To browse/manage invites and documents via `/admin/` instead, create a superuser:

```bash
python manage.py createsuperuser
```

### Getting the sign-in link in local dev

Locally, `EMAIL_BACKEND` is set to Django's console backend, so no real email is sent — the full email, including the sign-in link, prints straight to the terminal running `manage.py runserver`. After requesting a link on the sign-in page, look for a line like:

```
Click to sign in (expires in 15 minutes): http://localhost:8001/auth/callback/?token=...
```

Open that URL to complete sign-in. To send real email instead (e.g. once deployed), change `EMAIL_BACKEND` in `.env` to a real backend (SMTP, SendGrid, etc.) with the matching credentials.

## Project layout

- `server/` — Django + DRF backend
  - `accounts/` — auth, invites, magic-link sign-in
  - `documents/` — upload, text extraction, the PubMed/Gemini annotation pipeline
- `web/` — React (Vite) frontend

## A privacy note on the Gemini free tier

The annotation pipeline uses Gemini's free tier, whose terms permit Google to use free-tier inputs/outputs to improve their products. De-identifying the text before it's sent (see above) reduces exposure but is a mitigation, not a guarantee — it's a heuristic pass over labeled fields (name, DOB, MRN, address) and won't catch every way an identifier could appear in a real document. Worth knowing before uploading a real family member's report.
