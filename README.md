# PlainMed

A private, invite-only web app that helps patients and their families understand medical scan reports and doctor's notes.

## Problem

Reports from PET scans and other diagnostic imaging are often dense with clinical jargon and raw measurements that are difficult to interpret without a medical background. This is especially hard for people who aren't native English speakers, adding language barriers on top of already-technical content. General-purpose AI tools can help decode these documents, but their outputs aren't grounded in verifiable sources, which is risky for something this consequential.

## Solution

Upload a scan report or doctor's note (PDF), and view it side by side with:

- A plain-language summary and term-by-term annotations, written at a level anyone can understand.
- Citations to relevant PubMed research papers backing each annotation, so explanations are traceable rather than taken on faith.
- The ability to switch annotation language — support for English, Spanish, and Traditional Chinese.
- Hover a highlighted phrase in the original document and its explanation lights up alongside it (and vice versa), so it's always clear what an annotation is actually referring to.
- The AI picks up to 10 terms per document automatically — not exhaustive, so you can also select any other phrase in the document, or type one into the box below the findings list, to get it explained the same way, on demand.
- A dashboard that greets you with what's actually ready vs. still processing, drag-and-drop upload with no separate confirm step, and a decluttered "⋯" menu for rename/delete instead of always-visible action links.

Access is invite-only, and each user's uploaded documents are private to them.

**This tool does not provide medical advice.** It is strictly an aid for understanding the objective content of a document — always consult a qualified healthcare provider for interpretation and decisions about care.

## How it works

- **Backend**: Django + Django REST Framework, PostgreSQL.
- **Frontend**: React (Vite).
- **Annotation pipeline**, run once per document (and cached per language after that):
  1. Text is extracted from the uploaded PDF server-side (`pdfplumber`).
  2. Identifying details (patient name, DOB, MRN, address, phone, email, SSN...) are redacted from that text before anything leaves the system, in four layered passes (`documents/dlp.py`, `documents/deidentify.py`): Cloud DLP's pre-built HIPAA-identifier detectors first, then a labeled-field regex, a narrative-name regex, and a spaCy NER pass, each catching things the others miss.
  3. Gemini reads the de-identified text and picks out the key findings a layperson would need explained, plus search terms for each.
  4. Real papers are retrieved from PubMed (NCBI E-utilities) for each finding — this is the *only* source material the model is ever allowed to cite. Any citation it returns is re-validated against that real list afterward; nothing it invents makes it to the screen.
  5. A second Gemini call writes the plain-language summary and per-finding explanations in the requested language.
- **Document viewer**: the PDF is rendered client-side onto canvas with `pdf.js`, with an invisible text layer on top used to locate each finding's term in the actual document — that's what drives the hover-highlighting between the document and the annotations.
- **On-demand explanations**, for anything the automatic pass didn't pick: select any text in the document (or type a phrase into the box below the findings list) and `documents/services.py`'s `explain_ad_hoc_term` runs the same retrieval-then-generation pipeline — PubMed search, a grounded Gemini call, citation re-validation — for just that one term, then caches it (`Document.findings` / `Annotation.items`) so it behaves exactly like any other finding from then on: highlighted, listed, reused across languages. Unlike the automatic pass, which only ever lets Gemini see already-redacted text, a selected phrase can be anything in the original document — so it's run through the same four-layer redaction pipeline *itself* before ever reaching PubMed or Gemini; if that pipeline would redact anything in it, the request is refused rather than sent.
- **Access logging**: every upload/view/download/delete against a document is recorded (`documents/models.py`'s `DocumentAccessLog`) — the piece of "a full audit trail" that GCP's own infra-level Cloud Audit Logs can't provide on their own, since every user's access goes through the same shared service account and those logs alone can't tell users apart. Read-only in Django admin; survives the document itself being deleted.
- **Auth**: invite-only, passwordless magic-link email sign-in. See [Login & invites](#login--invites) below.

## Status

Live in production at [app.plainmed.health](https://app.plainmed.health) (invite-only): auth, upload/storage, the PDF viewer, the automatic + on-demand annotation pipeline, multi-language support, and the dashboard UI are all built and deployed. Security hardening is in place too — Cloud DLP, CMEK-encrypted storage, a private-IP-only database, Vertex AI, and a per-document access audit trail (distinct from GCP's own infra-level audit logging — see [How it works](#how-it-works)) — see [Deploying to GCP](#deploying-to-gcp). Remaining: signing the actual BAA with Google (a manual step outside this codebase) and, if traffic ever outgrows family scale, a WAF (see [Before real patient data touches this](#before-real-patient-data-touches-this)).

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
- `DLP_PROJECT_ID` — optional locally (the Cloud DLP redaction pass is skipped with a warning if unset); required before this ever touches real patient data. See [Cloud DLP setup](#cloud-dlp-setup) below.
- `GS_BUCKET_NAME` / `GS_PROJECT_ID` — optional locally (uploads fall back to `server/media/` if unset); required in any deployed environment. See [GCS storage setup](#gcs-storage-setup) below.

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

Opens on `http://localhost:5173` by default. If either default port (8001 / 5173) is already taken on your machine, Vite/Django will pick another one — update `FRONTEND_URL` in `server/.env`, and `VITE_API_BASE_URL` for the frontend (see `web/src/api.js`), to match whatever ports actually end up in use.

## Login & invites

There are no passwords. Signing in works like this:

1. Enter your email on the sign-in screen.
2. If that email is on the invite list, the app sends a one-time sign-in link (valid 15 minutes).
3. Click it and you're signed in.

Signing out anywhere signs you out everywhere — accounts share a single token across every tab and device (DRF's `Token.user` is a `OneToOneField`, not per-session), not one per browser tab. If a token stops being valid mid-session (most commonly: signed out from another tab), the app notices on the next request and returns you to the sign-in screen with an explanation, rather than showing a raw backend error.

### Adding someone to the invite list

Only invited emails can sign in — there's no public sign-up. If someone not on the list tries to sign in, `RequestLinkView` (`accounts/views.py`) emails `OWNER_EMAIL` an approve/deny link for that specific request — approving adds them to the invite list and is idempotent (clicking it twice, or a link-prescanning bot getting there first, can't double-invite or re-decide). `OWNER_EMAIL` is blank by default (see `server/.env.example` / `owner_email` in `infra/terraform/terraform.tfvars`) — with it unset, those attempts are just recorded silently (Django admin → Access requests) instead of emailing anyone.

You can also add someone directly, without waiting for them to try signing in first, via the Django shell:

```bash
cd server && source ../.venv/bin/activate
python manage.py shell -c "
from accounts.models import Invite
Invite.objects.get_or_create(email='someone@example.com')
"
```

Create a superuser to browse/manage invites, access requests, and documents via `/admin/`:

```bash
python manage.py createsuperuser
```

### Getting the sign-in link in local dev

Locally, `EMAIL_BACKEND` is set to Django's console backend, so no real email is sent — the full email, including the sign-in link, prints straight to the terminal running `manage.py runserver`. After requesting a link on the sign-in page, look for a line like:

```
Click to sign in (expires in 15 minutes): http://localhost:8001/auth/callback/?token=...
```

Open that URL to complete sign-in. To send real email instead (e.g. once deployed), see [Mailgun setup](#mailgun-setup) below.

## Cloud DLP setup

> If you're deploying via `infra/terraform` (see [Deploying to GCP](#deploying-to-gcp)), the API enablement and IAM binding below are already handled by `apis.tf`/`iam.tf` — this section is mainly useful for understanding what's actually being granted, or for setting up your own local dev access.

The first redaction pass (`documents/dlp.py`) calls the [Cloud Data Loss Prevention API](https://cloud.google.com/security/products/sensitive-data-protection) to catch generic HIPAA identifiers (names, SSNs, phone numbers, emails, addresses, dates) before the app's own regex/NER passes run. It's optional locally — unset `DLP_PROJECT_ID` and it's skipped with a logged warning — but required in any environment that handles real patient data, since it's one of the four redaction layers, not a nice-to-have.

**One-time setup, per GCP project:**

```bash
gcloud services enable dlp.googleapis.com --project=YOUR_PROJECT_ID
```

**Local dev**, to exercise the real DLP pass instead of the skip path:

```bash
gcloud auth application-default login
```

Then set `DLP_PROJECT_ID=YOUR_PROJECT_ID` in `server/.env`. Your own user account needs the `roles/dlp.user` role (or broader) on that project.

**Production (Cloud Run)**: grant `roles/dlp.user` to the service account the Cloud Run service runs as — not your personal account:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_RUNTIME_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/dlp.user"
```

Cloud DLP calls run inside your GCP project, under your organization's BAA if one is in place with Google — but the BAA itself is a separate legal step (see the note at the end of this README), not something this codebase can establish on its own.

## GCS storage setup

> If you're deploying via `infra/terraform`, the bucket, KMS key, and IAM binding below are already handled by `kms.tf`/`storage.tf`/`iam.tf` — this section is mainly for local dev access or understanding what's provisioned.

Uploaded documents (`Document.file`) go to a [Cloud Storage](https://cloud.google.com/storage) bucket when `GS_BUCKET_NAME` is set — this is where the actual PHI in this app lives, so the bucket should be private (uniform bucket-level access, no `allUsers`/`allAuthenticatedUsers` binding) and CMEK-encrypted via Cloud KMS. It's optional locally — unset `GS_BUCKET_NAME` and uploads fall back to local disk (`server/media/`), same as today.

**One-time setup, per GCP project:**

```bash
gcloud services enable storage.googleapis.com cloudkms.googleapis.com --project=YOUR_PROJECT_ID

# A KMS key ring + key for CMEK (skip if you already have one you want to reuse)
gcloud kms keyrings create ehr-translator --location=us-central1 --project=YOUR_PROJECT_ID
gcloud kms keys create gcs-uploads --keyring=ehr-translator --location=us-central1 --purpose=encryption --project=YOUR_PROJECT_ID

# The bucket itself, private, uniform access, encrypted with that key
gcloud storage buckets create gs://YOUR_BUCKET_NAME \
  --project=YOUR_PROJECT_ID --location=us-central1 --uniform-bucket-level-access \
  --default-encryption-key=projects/YOUR_PROJECT_ID/locations/us-central1/keyRings/ehr-translator/cryptoKeys/gcs-uploads

# Cloud Storage's own service agent needs to use that key
gcloud kms keys add-iam-policy-binding gcs-uploads --keyring=ehr-translator --location=us-central1 \
  --member="serviceAccount:service-YOUR_PROJECT_NUMBER@gs-project-accounts.iam.gserviceaccount.com" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter" --project=YOUR_PROJECT_ID
```

**Local dev**, to exercise the real bucket instead of local disk: `gcloud auth application-default login`, then set `GS_BUCKET_NAME` and `GS_PROJECT_ID` in `server/.env`. Your own user account needs `roles/storage.objectAdmin` on the bucket (not the whole project).

**Production (Cloud Run)**: grant the Cloud Run service account `roles/storage.objectAdmin` scoped to just this bucket:

```bash
gcloud storage buckets add-iam-policy-binding gs://YOUR_BUCKET_NAME \
  --member="serviceAccount:YOUR_RUNTIME_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

Django's own static assets (admin, DRF browsable API) are served by [WhiteNoise](https://whitenoise.readthedocs.io/) directly from the app container, not from this bucket — they contain no PHI and don't need CMEK or per-object access control. Run `python manage.py collectstatic` before deploying (this populates `server/staticfiles/`, which is gitignored).

## Vertex AI setup

> If you're deploying via `infra/terraform`, the API enablement and IAM binding below are already handled by `apis.tf`/`iam.tf` — this section is mainly for local dev access or understanding what's provisioned.

The annotation pipeline (`documents/gemini.py`) calls [Vertex AI](https://cloud.google.com/vertex-ai) instead of the consumer Gemini API when `VERTEX_PROJECT_ID` is set — same `google-genai` SDK, just authenticated via ADC (a service account) instead of a static API key, and covered by Vertex's enterprise terms (BAA-eligible, no training on customer data) rather than the free tier's. It's optional locally — unset `VERTEX_PROJECT_ID` and it falls back to the existing `GEMINI_API_KEY` client.

**One-time setup, per GCP project:**

```bash
gcloud services enable aiplatform.googleapis.com --project=YOUR_PROJECT_ID
```

**Local dev**, to exercise Vertex instead of the API-key fallback: `gcloud auth application-default login`, then set `VERTEX_PROJECT_ID` and `VERTEX_LOCATION` in `server/.env`. Your own user account needs `roles/aiplatform.user` on that project.

**Production (Cloud Run)**: grant `roles/aiplatform.user` to the Cloud Run service account:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_RUNTIME_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

**Model ID note**: Vertex's publisher model catalog doesn't always carry the same model IDs as the consumer/AI Studio API — confirmed directly, not hypothetically: `GEMINI_MODEL`'s default (`gemini-3.1-flash-lite`) 404s on Vertex for this project/region, even though it works fine through the plain API-key client. Check the exact equivalent in the [Vertex Model Garden](https://console.cloud.google.com/vertex-ai/model-garden) before deploying — or probe candidate IDs directly against the `google-genai` client, which is how this was actually diagnosed — and set `vertex_model` in `terraform.tfvars` (or `VERTEX_MODEL` locally) if it differs. `gemini-2.5-flash-lite` is the confirmed-working equivalent as of this deployment.

## Mailgun setup

> If you're deploying via `infra/terraform`, the Secret Manager secret and IAM binding are already handled by `secrets.tf`/`iam.tf` — you only need the Mailgun-side steps below plus `terraform.tfvars`. If you're also setting up a custom domain, do [Custom domain setup](#custom-domain-setup) first — it creates the MX/SPF DNS records Mailgun's domain verification looks for, so verification succeeds on the first try instead of needing a second pass once DNS exists.

Sign-in emails (the magic link) go through [Mailgun](https://www.mailgun.com)'s SMTP relay in any deployed environment — it's the actual `EMAIL_BACKEND` switch: unset `mailgun_smtp_login`/`mailgun_smtp_password` and the app keeps using the console backend, where sign-in links go nowhere but the logs (see [Getting the sign-in link in local dev](#getting-the-sign-in-link-in-local-dev)).

**Mailgun-side setup** (outside GCP — this is a separate account you create directly with Mailgun, not something Terraform can do for you):
1. Sign up at [mailgun.com](https://www.mailgun.com) and add a sending domain — `mg.yourdomain.com` if you're using [Custom domain setup](#custom-domain-setup) above, or the sandbox domain Mailgun gives new accounts for testing only (sandbox domains can only send to a short list of manually authorized recipient addresses, so it won't work for real invited users until you add and verify a real domain).
2. Verify the domain via the DNS records Mailgun gives you (SPF/MX/DKIM at your DNS registrar) — already in place if you did [Custom domain setup](#custom-domain-setup) step 2 first; otherwise add them manually wherever the domain's DNS is hosted.
3. Dashboard → Sending → Domain settings → SMTP credentials — copy the SMTP username (`postmaster@mg.yourdomain.com`) and password.

**Wire it up:**
```bash
# in infra/terraform/terraform.tfvars
mailgun_smtp_login    = "postmaster@mg.yourdomain.com"
mailgun_smtp_password = "the-smtp-password-from-mailgun"
default_from_email    = "PlainMed <no-reply@mg.yourdomain.com>"
```
```bash
terraform apply
```
No image rebuild needed — this is all environment variables and a Secret Manager value, picked up by a new Cloud Run revision on `apply` alone.

**Verify**: request a sign-in link for real, then check Mailgun's dashboard (Sending → Logs) for a delivery record, and check Cloud Run's own logs if it doesn't arrive — an SMTP auth failure shows up there, not as a user-facing error.

## Deploying to GCP

`infra/terraform/` stands up the whole environment: a CMEK-encrypted Cloud SQL instance with no public IP, the uploads bucket from above, two Cloud Run services (API and frontend) and a one-off migrate job, least-privilege service accounts, and Data Access audit logging. There's no load balancer or Cloud Armor in front of anything — the API and frontend are each their own Cloud Run service with their own GCP-provided URL, which is meaningfully cheaper and simpler for an invite-only, family-scale app than putting a load balancer and WAF in front of low-value, low-traffic infrastructure. A custom domain (see [Custom domain setup](#custom-domain-setup) below) uses Cloud Run's own domain mapping for HTTPS instead of a load balancer's managed cert. Cloud SQL sits on a private IP inside its own VPC (`network.tf`) — Cloud Run reaches it via Direct VPC egress (`run.tf`'s `vpc_access` block, scoped to `PRIVATE_RANGES_ONLY` so Vertex AI/PubMed/Mailgun calls stay on the normal public egress path and no Cloud NAT is needed) rather than the older Serverless VPC Access connector, which would have brought back a standing per-hour cost. Not skipping the load balancer/WAF for the same reason: Cloud Armor can only attach to a backend service behind an External HTTPS Load Balancer, not to Cloud Run directly, so getting it back means undoing the domain-mapping architecture and its cost trade-off entirely — a Cloudflare free-tier proxy in front of the custom domain would get most of the same protection without that.

**This is real, billed GCP infrastructure — nothing here should be applied without reading through what it creates first**, especially `sql.tf` (a running Postgres instance, the main ongoing cost).

### One-time bootstrap

```bash
# The bucket Terraform stores its own state in has to exist before Terraform
# can use it as a backend.
gcloud storage buckets create gs://YOUR_PROJECT_ID-tfstate \
  --uniform-bucket-level-access --project=YOUR_PROJECT_ID

cd infra/terraform
terraform init -backend-config="bucket=YOUR_PROJECT_ID-tfstate"
cp terraform.tfvars.example terraform.tfvars   # fill in project_id at minimum
```

### Apply order

A single `terraform plan` / `terraform apply` handles the resource graph correctly on its own — no need to apply file-by-file — but expect the first apply to take a while (Cloud SQL instance creation alone is often 5-10 minutes), and **review the plan output before confirming**, every time:

```bash
terraform plan
terraform apply
```

The very first apply uses `var.app_image`'s placeholder value (a public "hello" container) since no real image exists yet — that's expected. Push a real image and update the Cloud Run service afterward (this is exactly what the CI workflow automates going forward).

**Required second step after the first apply**: Cloud Run's assigned URL isn't predictable ahead of creation, so `ALLOWED_HOSTS` starts wrong (a best-effort guess). Run `terraform output cloud_run_api_url`, strip the `https://`, set it as `backend_host_override` in `terraform.tfvars`, and re-apply — until then, Django rejects every request with `DisallowedHost`.

### First deploy (before CI is wired up)

```bash
PROJECT_ID=YOUR_PROJECT_ID
REGION=us-central1
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/ehr-translator/api:manual"

gcloud auth configure-docker "$REGION-docker.pkg.dev"
# --platform=linux/amd64 matters on Apple Silicon — a plain `docker build`
# targets the Mac's native arm64, which Cloud Run rejects outright ("must
# support amd64/linux"). CI doesn't need this (GitHub's runners are amd64
# already), only local builds do.
docker build --platform=linux/amd64 -t "$IMAGE" server/
docker push "$IMAGE"

gcloud run jobs update migrate --region="$REGION" --image="$IMAGE"
gcloud run jobs execute migrate --region="$REGION" --wait

gcloud run services update api --region="$REGION" --image="$IMAGE"

FRONTEND_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/ehr-translator/frontend:manual"
docker build --platform=linux/amd64 \
  --build-arg VITE_API_BASE_URL="$(terraform -chdir=../infra/terraform output -raw cloud_run_api_url)" \
  -t "$FRONTEND_IMAGE" web/
docker push "$FRONTEND_IMAGE"
gcloud run services update frontend --region="$REGION" --image="$FRONTEND_IMAGE"
```

Visit `terraform output cloud_run_frontend_url` to smoke-test.

### CI/CD

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) automates the above on every push to `main`, authenticating via Workload Identity Federation (no service account key ever stored in GitHub). It needs:
1. `github_repo` set in `terraform.tfvars` to your `"owner/repo"`, applied, so the WIF trust and `ci-deployer-sa` exist.
2. Four repository variables in GitHub (Settings → Secrets and variables → Actions → Variables) — `GCP_PROJECT_ID`, `GCP_REGION`, `WORKLOAD_IDENTITY_PROVIDER` (from `terraform output workload_identity_provider`), and `FRONTEND_API_BASE_URL` (from `terraform output cloud_run_api_url`).

### Custom domain setup

Wires your own domain (e.g. `plainmed.health`) into both the webapp and Mailgun, via Cloud Run domain mapping and a Cloud DNS managed zone — no load balancer needed (see [Deploying to GCP](#deploying-to-gcp) above for why that's the deliberate trade-off here).

1. **Verify domain ownership in Search Console**, under the same Google account/org used for `terraform apply` — [search.google.com/search-console/welcome](https://search.google.com/search-console/welcome), "Domain" property type. Cloud Run domain mappings fail outright without this; it's a one-time manual step, same category as the Mailgun account and the BAA below.
2. Set `root_domain = "plainmed.health"` in `terraform.tfvars`, then `terraform apply`. This creates:
   - A Cloud DNS managed zone for the domain.
   - `app.plainmed.health` -> the frontend Cloud Run service, `api.plainmed.health` -> the API Cloud Run service (both via `google_cloud_run_domain_mapping`, each getting its own Google-managed cert).
   - Mailgun sending-domain DNS records for `mg.plainmed.health` (MX, SPF; DKIM once you've set `mailgun_dkim_value`, see below).
3. **Point the domain's nameservers at Google's**: run `terraform output dns_name_servers` and set those as `plainmed.health`'s nameservers at whatever registrar you bought it from. Nothing above resolves until this propagates (can take a few hours).
4. **Mailgun side**: add `mg.plainmed.health` as a sending domain in Mailgun's dashboard (see [Mailgun setup](#mailgun-setup) below) — its DNS verification will find the MX/SPF records from step 2 already in place. Copy the DKIM TXT record value it gives you into `mailgun_dkim_value` in `terraform.tfvars`, then `terraform apply` again.
5. **Cert check**: `gcloud run domain-mappings describe --domain app.plainmed.health --region "$REGION"` (and again for `api.plainmed.health`) — wait for `CertificateProvisioned` before relying on either custom domain. Can take up to ~24h after DNS propagates.
6. Once both certs are live, switch the `FRONTEND_API_BASE_URL` GitHub Actions repository variable from `terraform output cloud_run_api_url` to `terraform output api_custom_domain_url`, and push (or re-run the workflow) so the frontend build picks up the custom API domain. Update `default_from_email` in `terraform.tfvars` to an address on `mg.plainmed.health` if it isn't already.

### Before real patient data touches this

- **The BAA**: still a manual step with Google, not something Terraform can do — see the note near the end of this README.
- If traffic ever outgrows family scale, reconsider the load balancer + Cloud Armor setup this deployment deliberately traded away for cost and simplicity (or a Cloudflare free-tier proxy in front of the custom domain as a cheaper middle ground). Cloud SQL is already private-IP-only (`network.tf`), so that part of the original trade-off no longer applies.

## Project layout

- `server/` — Django + DRF backend
  - `accounts/` — auth, invites, magic-link sign-in
  - `documents/` — upload, text extraction, the PubMed/Gemini annotation pipeline, access logging
- `web/` — React (Vite) frontend
- `infra/terraform/` — GCP deployment infra (Cloud Run, Cloud SQL, VPC, DNS, IAM) — see [Deploying to GCP](#deploying-to-gcp)

## A privacy note on the Gemini free tier

The annotation pipeline uses Gemini's free tier, whose terms permit Google to use free-tier inputs/outputs to improve their products. De-identifying the text before it's sent (see above) reduces exposure but is a mitigation, not a guarantee — it's a heuristic pass over labeled fields (name, DOB, MRN, address) and won't catch every way an identifier could appear in a real document. Worth knowing before uploading a real family member's report.

## On HIPAA / BAA status

This app is not currently HIPAA-compliant end to end, and no Business Associate Agreement (BAA) with Google is in place. A BAA is a legal agreement executed by an authorized admin of a GCP organization (through the account's Cloud sales/support relationship, or the Compliance section of the console for eligible accounts) — it's a procurement step, not a code change, and nothing in this repo can establish one on its own. Don't upload real patient records until that's actually signed and every service in use (Gemini/Vertex AI, Cloud DLP, Cloud Storage, Cloud SQL, Cloud Run) is confirmed to fall under Google's [HIPAA-covered services list](https://cloud.google.com/security/compliance/hipaa).
