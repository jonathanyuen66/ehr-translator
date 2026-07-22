resource "random_password" "db_password" {
  length  = 32
  special = false # simplifies passing through as a Cloud Run env var / DB URL
}

resource "random_password" "django_secret_key" {
  length  = 50
  special = true
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "ehr-translator-db-password"
  replication {
    auto {}
  }
  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

resource "google_secret_manager_secret" "django_secret_key" {
  secret_id = "ehr-translator-django-secret-key"
  replication {
    auto {}
  }
  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "django_secret_key" {
  secret      = google_secret_manager_secret.django_secret_key.id
  secret_data = random_password.django_secret_key.result
}
