# Customer-managed encryption keys (CMEK) for the two places PHI is stored
# at rest: the uploads bucket and Cloud SQL.

resource "google_kms_key_ring" "main" {
  name     = "ehr-translator"
  location = var.region

  depends_on = [google_project_service.required]
}

resource "google_kms_crypto_key" "gcs_uploads" {
  name            = "gcs-uploads"
  key_ring        = google_kms_key_ring.main.id
  rotation_period = "7776000s" # 90 days

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_kms_crypto_key" "cloudsql" {
  name            = "cloudsql"
  key_ring        = google_kms_key_ring.main.id
  rotation_period = "7776000s" # 90 days

  lifecycle {
    prevent_destroy = true
  }
}

# The GCS service agent needs to use the uploads key on the bucket's behalf.
data "google_storage_project_service_account" "gcs" {
  project = var.project_id
}

resource "google_kms_crypto_key_iam_member" "gcs_uploads_encrypter" {
  crypto_key_id = google_kms_crypto_key.gcs_uploads.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${data.google_storage_project_service_account.gcs.email_address}"
}

# Same for the Cloud SQL service agent.
resource "google_project_service_identity" "sqladmin" {
  provider = google-beta
  project  = var.project_id
  service  = "sqladmin.googleapis.com"

  depends_on = [google_project_service.required]
}

resource "google_kms_crypto_key_iam_member" "cloudsql_encrypter" {
  crypto_key_id = google_kms_crypto_key.cloudsql.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_project_service_identity.sqladmin.email}"
}
