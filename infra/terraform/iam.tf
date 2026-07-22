# Two service accounts, least-privilege: the app's own runtime identity, and
# a separate one for CI that can deploy but never touches application data.

resource "google_service_account" "cloud_run_api" {
  account_id   = "cloud-run-api-sa"
  display_name = "EHR Translator — Cloud Run runtime (api)"
}

resource "google_service_account" "ci_deployer" {
  account_id   = "ci-deployer-sa"
  display_name = "EHR Translator — CI deploy identity"
}

# --- cloud_run_api: only what the app itself needs at runtime ---

resource "google_project_iam_member" "cloud_run_api_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run_api.email}"
}

resource "google_project_iam_member" "cloud_run_api_dlp" {
  project = var.project_id
  role    = "roles/dlp.user"
  member  = "serviceAccount:${google_service_account.cloud_run_api.email}"
}

resource "google_project_iam_member" "cloud_run_api_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.cloud_run_api.email}"
}

# Bucket-scoped, not project-wide — the runtime SA can only touch the one
# bucket that actually holds uploaded documents.
resource "google_storage_bucket_iam_member" "cloud_run_api_uploads" {
  bucket = google_storage_bucket.uploads.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run_api.email}"
}

resource "google_secret_manager_secret_iam_member" "cloud_run_api_db_password" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_api.email}"
}

resource "google_secret_manager_secret_iam_member" "cloud_run_api_django_secret" {
  secret_id = google_secret_manager_secret.django_secret_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_api.email}"
}

# --- ci_deployer: deploy/build only, no access to PHI, DB, DLP, or Vertex ---

resource "google_project_iam_member" "ci_deployer_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.ci_deployer.email}"
}

# Lets the deployer deploy Cloud Run resources *as* the runtime SA, without
# granting the deployer any of the runtime SA's own data-access permissions.
resource "google_service_account_iam_member" "ci_deployer_act_as_runtime" {
  service_account_id = google_service_account.cloud_run_api.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.ci_deployer.email}"
}

resource "google_artifact_registry_repository_iam_member" "ci_deployer_ar_writer" {
  location   = google_artifact_registry_repository.app.location
  repository = google_artifact_registry_repository.app.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.ci_deployer.email}"
}

resource "google_storage_bucket_iam_member" "ci_deployer_frontend" {
  bucket = google_storage_bucket.frontend.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.ci_deployer.email}"
}

# --- Workload Identity Federation: keyless GitHub Actions auth ---
# No service account JSON key is ever downloaded — GitHub's OIDC token is
# exchanged for short-lived credentials, scoped to exactly this repo.

resource "google_iam_workload_identity_pool" "github" {
  count                     = var.github_repo != "" ? 1 : 0
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"

  depends_on = [google_project_service.required]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  count                              = var.github_repo != "" ? 1 : 0
  workload_identity_pool_id          = google_iam_workload_identity_pool.github[0].workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions"
  display_name                       = "GitHub Actions"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }
  # Scopes the trust to exactly this repo — any other repo's Actions runs,
  # even under the same GitHub org, are rejected.
  attribute_condition = "assertion.repository == \"${var.github_repo}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "ci_deployer_wif" {
  count              = var.github_repo != "" ? 1 : 0
  service_account_id = google_service_account.ci_deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github[0].name}/attribute.repository/${var.github_repo}"
}
