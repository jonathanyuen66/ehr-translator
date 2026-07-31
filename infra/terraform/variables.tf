variable "project_id" {
  description = "GCP project ID everything gets deployed into."
  type        = string
}

variable "region" {
  description = "Primary region for regional resources (Cloud Run, Cloud SQL, KMS key ring)."
  type        = string
  default     = "us-central1"
}

variable "vertex_model" {
  description = "Vertex AI publisher-model ID for documents/gemini.py, when it differs from GEMINI_MODEL's AI-Studio-side default (settings.py) — Vertex's catalog doesn't always carry the same model names as the consumer API. Leave blank to just use GEMINI_MODEL's value on Vertex too; only set this if that 404s (check with `gcloud ai model-garden models list` or by probing candidate IDs directly, per README)."
  type        = string
  default     = ""
}

variable "github_repo" {
  description = "\"owner/repo\" — scopes the Workload Identity Federation trust so only this GitHub repo's Actions runs can deploy. Leave blank to skip creating the WIF pool (CI deploy won't work until this is set)."
  type        = string
  default     = ""
}

variable "backend_host_override" {
  description = <<-EOT
    Cloud Run's legacy hash-based host (e.g. "api-XXXXXXXXXX-uc.a.run.app"),
    once known. Leave blank for the first apply — this specific form isn't
    predictable ahead of creation. The service is also always reachable on
    a second, deterministic host ("api-PROJECT_NUMBER.REGION.run.app",
    computed automatically in run.tf, no override needed for that one) —
    both are added to ALLOWED_HOSTS since both are genuine Google-assigned
    hosts for this exact service. ALLOWED_HOSTS deliberately isn't "*" — the
    sign-in email link is built from the request's Host header
    (accounts/views.py), so a permissive ALLOWED_HOSTS would let a spoofed
    Host header redirect a real sign-in token to an attacker-controlled
    domain. Set this after the first apply if you want the legacy URL to
    also work (`terraform output cloud_run_api_url`, strip "https://").
  EOT
  type        = string
  default     = ""
}

variable "app_image" {
  description = "Artifact Registry image URI for the Django container. Updated by CI after each build; the placeholder default is only for the first `terraform apply` before any image exists."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "frontend_image" {
  description = "Artifact Registry image URI for the frontend's nginx container (web/Dockerfile). Updated by CI after each build; the placeholder default is only for the first `terraform apply` before any image exists."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "root_domain" {
  description = <<-EOT
    Your own domain (e.g. "plainmed.health"), once bought — leave blank to
    skip all custom-domain/DNS resources entirely and keep using the raw
    Cloud Run *.run.app URLs (the default, no extra setup required).

    Setting this creates a Cloud DNS managed zone plus three subdomains:
    app.ROOT_DOMAIN (frontend), api.ROOT_DOMAIN (backend), and
    mg.ROOT_DOMAIN (Mailgun's sending domain — see mailgun_dkim_value
    below). None of it resolves anything until you also point ROOT_DOMAIN's
    nameservers at Google's, at whatever registrar you bought it from — see
    the `dns_name_servers` output after applying.

    Before this will apply cleanly: Cloud Run domain mappings require the
    domain to already be verified under the same Google account/org running
    `terraform apply`, via Search Console
    (https://search.google.com/search-console/welcome) — a one-time manual
    step outside Terraform, same category as the Mailgun account and the
    BAA (see README).
  EOT
  type        = string
  default     = ""
}

variable "db_tier" {
  description = "Cloud SQL machine tier. db-f1-micro is the cheapest shared-core tier (0.6GB RAM) — fine for light, occasional family-scale traffic; bump to db-g1-small or larger if that ever feels tight."
  type        = string
  default     = "db-f1-micro"
}

variable "min_instances" {
  description = "Cloud Run min instance count. 0 allows scale-to-zero (cheaper, adds cold-start latency); 1 keeps a warm instance."
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Cloud Run max instance count — a ceiling to cap runaway cost/load, not a target."
  type        = number
  default     = 3
}

variable "mailgun_smtp_host" {
  description = "Mailgun's SMTP relay host — smtp.mailgun.org (US) or smtp.eu.mailgun.org (EU), matching whichever region your Mailgun domain was created in."
  type        = string
  default     = "smtp.mailgun.org"
}

variable "mailgun_smtp_login" {
  description = "Mailgun SMTP username, from the Mailgun dashboard (Sending -> Domain settings -> SMTP credentials) — typically \"postmaster@mg.yourdomain.com\". Leave blank to keep the console email backend (sign-in links go nowhere in production until this is set)."
  type        = string
  default     = ""
}

variable "mailgun_smtp_password" {
  description = "Mailgun SMTP password, from the same place. Stored in Secret Manager, not baked into the container — same caveat as db_password though: it does end up in Terraform state, so state's own privacy (the tfstate GCS bucket, IAM-only) is what actually protects it."
  type        = string
  default     = ""
  sensitive   = true
}

variable "default_from_email" {
  description = "From address for outgoing email — must be on your verified Mailgun domain once one exists, e.g. \"PlainMed <no-reply@mg.yourdomain.com>\"."
  type        = string
  default     = "no-reply@ehr-translator.local"
}

variable "owner_email" {
  description = "Where accounts.views.RequestLinkView emails an approve/deny link when someone not on the invite list tries to sign in. Leave blank to skip notifying anyone — those attempts are still recorded (Django admin -> Access requests), just silently."
  type        = string
  default     = ""
}

variable "mailgun_dkim_selector" {
  description = "DKIM selector Mailgun assigned your sending domain (Sending -> Domain settings -> DNS records -> the TXT record name is \"SELECTOR._domainkey.mg.yourdomain.com\"). Mailgun defaults to \"smtp\" for newly added domains; only override if yours differs."
  type        = string
  default     = "smtp"
}

variable "mailgun_dkim_value" {
  description = "The DKIM TXT record value Mailgun generates for your sending domain (Sending -> Domain settings -> DNS records, once mg.ROOT_DOMAIN is added there) — domain-specific, can't be predicted ahead of time. Leave blank and the DKIM record is simply skipped: mail still sends, just without a DKIM signature (worse deliverability, no forgery protection) until this is set and re-applied."
  type        = string
  default     = ""
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Scoped API token (Zone:DNS:Edit, Zone:Zone Settings:Edit, Zone:Firewall Services:Edit, restricted to the one zone) from Cloudflare -> My Profile -> API Tokens — not the account-wide Global API Key. Leave blank to skip all cloudflare.tf resources entirely (root_domain still works on plain Google Cloud DNS with no WAF, same as before this variable existed)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Zone ID for root_domain's site in Cloudflare, shown on the zone's Overview page. Required alongside cloudflare_api_token for any cloudflare.tf resource to apply — the site has to already exist in your Cloudflare account (Cloudflare's \"Add a domain\" flow) before this can be set, same one-time-manual-step category as the Mailgun/Search Console prerequisites above."
  type        = string
  default     = ""
}
