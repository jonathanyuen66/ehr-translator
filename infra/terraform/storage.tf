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

# No GCS frontend bucket here anymore — the compiled Vite build (web/dist)
# is served by the "frontend" Cloud Run service in run.tf instead, so it can
# share that service's domain-mapping/managed-cert path (dns.tf) rather than
# needing a load balancer just to put a custom HTTPS domain in front of a
# public bucket.
