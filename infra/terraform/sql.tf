resource "google_sql_database_instance" "main" {
  name                = "ehr-translator"
  project             = var.project_id
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = true
  encryption_key_name = google_kms_crypto_key.cloudsql.id

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL"

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.main.id
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
    }

    disk_autoresize = true
  }

  depends_on = [
    google_service_networking_connection.private_services,
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
