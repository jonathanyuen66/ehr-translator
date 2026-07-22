variable "project_id" {
  description = "GCP project ID everything gets deployed into."
  type        = string
}

variable "region" {
  description = "Primary region for regional resources (Cloud Run, Cloud SQL, VPC connector, KMS key ring)."
  type        = string
  default     = "us-central1"
}

variable "domain_name" {
  description = <<-EOT
    Domain to point at the load balancer (e.g. "app.example.com"). Leave blank
    until you have one — the LB, Cloud Armor, and all routing still stand up
    and are reachable over plain HTTP on the LB's static IP for smoke testing;
    the Google-managed SSL cert just stays PROVISIONING until DNS resolves to
    that IP. Set this and re-apply once DNS is in place, before go-live.
  EOT
  type        = string
  default     = ""
}

variable "github_repo" {
  description = "\"owner/repo\" — scopes the Workload Identity Federation trust so only this GitHub repo's Actions runs can deploy. Leave blank to skip creating the WIF pool (CI deploy won't work until this is set)."
  type        = string
  default     = ""
}

variable "app_image" {
  description = "Artifact Registry image URI for the Django container. Updated by CI after each build; the placeholder default is only for the first `terraform apply` before any image exists."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "db_tier" {
  description = "Cloud SQL machine tier. db-g1-small is a low-cost shared-core tier appropriate for this app's scale — not recommended if you outgrow family-scale usage."
  type        = string
  default     = "db-g1-small"
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
