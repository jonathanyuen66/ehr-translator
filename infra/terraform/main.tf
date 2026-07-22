terraform {
  required_version = ">= 1.5"

  required_providers {
    google      = { source = "hashicorp/google", version = "~> 6.0" }
    google-beta = { source = "hashicorp/google-beta", version = "~> 6.0" }
    random      = { source = "hashicorp/random", version = "~> 3.6" }
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

locals {
  has_domain = length(var.domain_name) > 0
}
