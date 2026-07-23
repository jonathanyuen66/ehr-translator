output "cloud_run_api_url" {
  description = "Cloud Run's own default URL for the api service — always reachable regardless of custom-domain/DNS/cert status, unlike api_custom_domain_url below. Useful for confirming a deploy succeeded independent of DNS, and as the CI FRONTEND_API_BASE_URL fallback before a custom domain is live."
  value       = google_cloud_run_v2_service.api.uri
}

output "cloud_run_frontend_url" {
  description = "Cloud Run's own default URL for the frontend service — same bootstrap purpose as cloud_run_api_url above."
  value       = google_cloud_run_v2_service.frontend.uri
}

output "app_custom_domain_url" {
  description = "The frontend's real, human-facing address once root_domain is set — null until then. DNS propagation plus Cloud Run's managed-cert provisioning can take up to ~24h after nameservers are updated; check `gcloud run domain-mappings describe --domain app.ROOT_DOMAIN --region REGION` for cert status before pointing real users at this."
  value       = var.root_domain != "" ? "https://${local.app_domain}" : null
}

output "api_custom_domain_url" {
  description = "Same as app_custom_domain_url, for the API — this is what the FRONTEND_API_BASE_URL GitHub Actions variable and default_from_email's domain should eventually point at, once confirmed live (same cert-provisioning caveat)."
  value       = var.root_domain != "" ? "https://${local.api_domain}" : null
}

output "dns_name_servers" {
  description = "Google's assigned name servers for the root_domain managed zone — set these as root_domain's nameservers at your registrar. Nothing above (app/api CNAMEs, Mailgun MX/TXT/DKIM records) resolves until that's done. Null until root_domain is set."
  value       = var.root_domain != "" ? google_dns_managed_zone.primary[0].name_servers : null
}

output "artifact_registry_repo" {
  description = "Push Docker images here: REGION-docker.pkg.dev/PROJECT_ID/ehr-translator/api"
  value       = google_artifact_registry_repository.app.name
}

output "uploads_bucket_name" {
  value = google_storage_bucket.uploads.name
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
