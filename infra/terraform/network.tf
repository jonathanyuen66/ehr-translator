# VPC for Cloud SQL's private IP, and Cloud Run's Direct VPC egress to
# reach it — the "private-IP-only + VPC connector design" sql.tf's own
# comments describe as traded away for cost/complexity, recreated here now
# that Direct VPC egress (network_interfaces in run.tf, not a
# google_vpc_access_connector) makes it free to bring back: no standing
# connector VM, unlike the older Serverless VPC Access connector this would
# have needed previously.
resource "google_compute_network" "main" {
  name                    = "ehr-translator"
  auto_create_subnetworks = false

  depends_on = [google_project_service.required]
}

# Only actually used by Cloud Run's Direct VPC egress (run.tf) — Cloud SQL's
# own private IP lives in the separate reserved range below, not in this
# subnet.
resource "google_compute_subnetwork" "main" {
  name          = "ehr-translator-${var.region}"
  region        = var.region
  network       = google_compute_network.main.id
  ip_cidr_range = "10.10.0.0/24"
}

# Reserves an internal range for Google's own managed services — Cloud
# SQL's private IP gets allocated out of this range once the peering
# connection below exists, not out of the subnet above.
resource "google_compute_global_address" "private_service_access" {
  name          = "ehr-translator-private-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

# The actual Private Service Access peering — Cloud SQL can't attach
# private_network (sql.tf) until this connection exists.
resource "google_service_networking_connection" "private_service_access" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_service_access.name]
}
