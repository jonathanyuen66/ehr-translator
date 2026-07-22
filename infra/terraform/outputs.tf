output "lb_ip_address" {
  description = "Static IP of the load balancer. Point DNS at this once you have a domain (var.domain_name)."
  value       = google_compute_global_address.lb_ip.address
}

output "cloud_run_api_url" {
  description = "Default *.run.app URL for the api service. Not reachable directly (ingress is restricted to the LB) — useful mainly for confirming a deploy succeeded via `gcloud run services describe`."
  value       = google_cloud_run_v2_service.api.uri
}

output "artifact_registry_repo" {
  description = "Push Docker images here: REGION-docker.pkg.dev/PROJECT_ID/ehr-translator/api"
  value       = google_artifact_registry_repository.app.name
}

output "uploads_bucket_name" {
  value = google_storage_bucket.uploads.name
}

output "frontend_bucket_name" {
  value = google_storage_bucket.frontend.name
}

output "cloud_sql_connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "ci_deployer_service_account" {
  value = google_service_account.ci_deployer.email
}

output "workload_identity_provider" {
  description = "Set as GitHub Actions' `workload_identity_provider` input, if github_repo was set."
  value       = var.github_repo != "" ? google_iam_workload_identity_pool_provider.github[0].name : null
}
