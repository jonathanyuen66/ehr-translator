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

    # Public IP, not the private-IP-only + VPC connector design this
    # originally had. Cloud Run's Cloud SQL integration (run.tf) connects via
    # the Cloud SQL Auth Proxy regardless of public/private IP — it
    # authenticates with IAM-issued ephemeral client certificates, not a bare
    # TCP connection, so this doesn't mean "open to the internet" the way a
    # traditional exposed database port would. ssl_mode enforces encryption
    # on any connection attempt at the database layer too, as a second
    # guarantee beyond what the proxy already does.
    #
    # Traded away: the "no network path to the database exists at all" property
    # the private-IP + VPC connector design had. Not a HIPAA requirement (the
    # required safeguards — encryption at rest/in transit, IAM access control,
    # audit logging — all still hold); it was defense-in-depth on top of that.
    # authorized_networks is deliberately left empty: no direct TCP allowlist
    # is configured, so the Auth Proxy's IAM-authenticated path is the only
    # practical way in.
    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
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
