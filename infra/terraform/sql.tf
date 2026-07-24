resource "google_sql_database_instance" "main" {
  name             = "ehr-translator"
  project          = var.project_id
  region           = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = true
  encryption_key_name = google_kms_crypto_key.cloudsql.id

  settings {
    # This project defaults new Cloud SQL instances to the ENTERPRISE_PLUS
    # edition, which rejects legacy shared-core tiers like db-g1-small
    # outright ("Invalid Tier ... Use a predefined Tier like
    # db-perf-optimized-N-* instead" — confirmed against the real API).
    # ENTERPRISE is the standard edition and the cheaper one that actually
    # supports shared-core tiers, appropriate for family-scale traffic.
    edition           = "ENTERPRISE"
    tier              = var.db_tier
    availability_type = "ZONAL"

    # Private IP only — no network path to this instance exists outside the
    # VPC (network.tf) at all, not even an IAM-gated one. Cloud Run reaches
    # it via Direct VPC egress (run.tf's vpc_access block) rather than the
    # older Serverless VPC Access connector, so this doesn't bring back the
    # connector's standing per-hour cost this project avoided originally.
    # ssl_mode still enforces encryption on any connection attempt at the
    # database layer too, on top of what the Auth Proxy already does.
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
      ssl_mode        = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
    }

    disk_autoresize = true

    # A *separate* GCP-API-level flag from the top-level deletion_protection
    # above — confirmed the hard way that setting only one of the two isn't
    # enough; both need to independently say "protected" for either to
    # actually stop a delete.
    deletion_protection_enabled = true
  }

  depends_on = [
    google_kms_crypto_key_iam_member.cloudsql_encrypter,
    google_service_networking_connection.private_service_access,
  ]
}

resource "google_sql_database" "main" {
  name     = "ehr_translator"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  name     = "ehr_translator_app"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}
