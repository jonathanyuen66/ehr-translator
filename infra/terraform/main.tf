terraform {
  required_version = ">= 1.5"

  required_providers {
    google      = { source = "hashicorp/google", version = "~> 6.0" }
    google-beta = { source = "hashicorp/google-beta", version = "~> 6.0" }
    random      = { source = "hashicorp/random", version = "~> 3.6" }
    time        = { source = "hashicorp/time", version = "~> 0.13" }
    cloudflare  = { source = "cloudflare/cloudflare", version = "~> 4.0" }
  }

  # Partial config: the state bucket itself must exist before this can be
  # used (Terraform can't create the bucket it stores its own state in).
  # One-time bootstrap:
  #   gcloud storage buckets create gs://YOUR_PROJECT_ID-tfstate \
  #     --uniform-bucket-level-access --project=YOUR_PROJECT_ID
  # Then:
  #   terraform init -backend-config="bucket=YOUR_PROJECT_ID-tfstate"
  backend "gcs" {
    prefix = "ehr-translator"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Harmless to configure even with an empty token (cloudflare_api_token
# defaults to "") — every resource in cloudflare.tf is gated on it being
# set, so no API call ever actually happens until it is.
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# Used to build Cloud Run's deterministic default URL (run.tf) without a
# circular reference to the service's own .uri output.
data "google_project" "current" {
  project_id = var.project_id
}
