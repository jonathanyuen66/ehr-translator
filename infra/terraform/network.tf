# A custom VPC so Cloud SQL can run on a private IP only (no public IP at
# all), reached from Cloud Run via a Serverless VPC Access connector — this
# is the "database never has a public endpoint" half of the zero-trust goal.

resource "google_compute_network" "main" {
  name                    = "ehr-translator"
  auto_create_subnetworks = false

  depends_on = [google_project_service.required]
}

resource "google_compute_subnetwork" "main" {
  name          = "ehr-translator-${var.region}"
  network       = google_compute_network.main.id
  region        = var.region
  ip_cidr_range = "10.10.0.0/24"
}

# Reserved range + peering connection Cloud SQL private IP requires.
resource "google_compute_global_address" "private_services" {
  name          = "ehr-translator-private-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_services" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]
}

# Serverless VPC Access connector — lets Cloud Run reach the private-IP-only
# Cloud SQL instance (and nothing else; egress is restricted to private
# ranges on the Cloud Run service itself, see run.tf).
resource "google_vpc_access_connector" "main" {
  name          = "ehr-translator-vpc"
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = "10.10.1.0/28"

  depends_on = [google_project_service.required]
}
