# Data Access audit logs — this is what actually produces the "who accessed
# what patient record, when" trail a HIPAA audit needs. Off by default in
# GCP for cost/volume reasons; turning it on is a deliberate choice here.
#
# Scoped to "allServices" rather than enumerating individual services: it's
# broader than strictly necessary, but guarantees storage/Cloud SQL/DLP/
# Vertex AI access is all covered without needing to get each service's
# exact audit-config service name right. DATA_READ across all services can
# get noisy (and add minor logging cost) — worth revisiting narrower scoping
# once this is running for real if volume becomes a problem.
resource "google_project_iam_audit_config" "all_services" {
  project = var.project_id
  service = "allServices"

  audit_log_config {
    log_type = "ADMIN_READ"
  }
  audit_log_config {
    log_type = "DATA_READ"
  }
  audit_log_config {
    log_type = "DATA_WRITE"
  }
}
