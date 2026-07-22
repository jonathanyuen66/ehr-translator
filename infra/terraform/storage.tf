# Uploads bucket: private, CMEK-encrypted, IAM-only — this is where PHI
# actually lives, so no public access path exists at all.
resource "google_storage_bucket" "uploads" {
  name                        = "${var.project_id}-ehr-uploads"
  project                     = var.project_id
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  encryption {
    default_kms_key_name = google_kms_crypto_key.gcs_uploads.id
  }

  versioning {
    enabled = true
  }

  depends_on = [google_kms_crypto_key_iam_member.gcs_uploads_encrypter]
}

# Frontend bucket: the compiled Vite build (web/dist) — static JS/CSS/HTML
# only, never PHI, so public read here is expected and deliberately
# different from the uploads bucket above.
resource "google_storage_bucket" "frontend" {
  name                        = "${var.project_id}-ehr-frontend"
  project                     = var.project_id
  location                    = var.region
  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
  }
}

resource "google_storage_bucket_iam_member" "frontend_public_read" {
  bucket = google_storage_bucket.frontend.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
