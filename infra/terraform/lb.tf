# One external HTTPS load balancer in front of both the static frontend
# (GCS backend bucket) and the Django API (Cloud Run via a serverless NEG),
# so a single Cloud Armor policy set covers both — this is what the pasted
# architecture's "Cloud Armor in front of the frontend" bullet actually
# requires: Cloud Armor can't attach to a bare Cloud Run *.run.app URL or a
# bucket's default endpoint, only to LB backends.

resource "google_compute_global_address" "lb_ip" {
  name = "ehr-translator-lb-ip"
}

resource "google_compute_backend_bucket" "frontend" {
  name                 = "ehr-translator-frontend"
  bucket_name          = google_storage_bucket.frontend.name
  enable_cdn           = true
  edge_security_policy = google_compute_security_policy.frontend_edge.id
}

resource "google_compute_region_network_endpoint_group" "api" {
  name                  = "ehr-translator-api-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.api.name
  }
}

resource "google_compute_backend_service" "api" {
  name                  = "ehr-translator-api"
  protocol              = "HTTP"
  port_name             = "http"
  security_policy       = google_compute_security_policy.api.id
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_region_network_endpoint_group.api.id
  }
}

resource "google_compute_url_map" "default" {
  name            = "ehr-translator"
  default_service = google_compute_backend_bucket.frontend.id

  host_rule {
    hosts        = ["*"]
    path_matcher = "main"
  }

  path_matcher {
    name            = "main"
    default_service = google_compute_backend_bucket.frontend.id

    path_rule {
      paths   = ["/api/*", "/api", "/admin/*", "/admin", "/auth/*", "/auth"]
      service = google_compute_backend_service.api.id
    }
  }
}

# --- Before a domain exists: plain HTTP straight to the real url map, so the
# whole path (LB, Cloud Armor, routing) is smoke-testable on the static IP.
# --- Once a domain exists (has_domain = true): HTTP instead redirects to
# HTTPS, and the real url map moves to the HTTPS proxy with the managed cert.

resource "google_compute_url_map" "https_redirect" {
  count = local.has_domain ? 1 : 0
  name  = "ehr-translator-https-redirect"

  default_url_redirect {
    https_redirect         = true
    strip_query            = false
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
  }
}

resource "google_compute_target_http_proxy" "default" {
  name    = "ehr-translator-http"
  url_map = local.has_domain ? google_compute_url_map.https_redirect[0].id : google_compute_url_map.default.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "ehr-translator-http"
  ip_address            = google_compute_global_address.lb_ip.address
  port_range            = "80"
  target                = google_compute_target_http_proxy.default.id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

resource "google_compute_managed_ssl_certificate" "default" {
  count = local.has_domain ? 1 : 0
  name  = "ehr-translator"

  managed {
    domains = [var.domain_name]
  }
}

resource "google_compute_target_https_proxy" "default" {
  count            = local.has_domain ? 1 : 0
  name             = "ehr-translator-https"
  url_map          = google_compute_url_map.default.id
  ssl_certificates = [google_compute_managed_ssl_certificate.default[0].id]
}

resource "google_compute_global_forwarding_rule" "https" {
  count                 = local.has_domain ? 1 : 0
  name                  = "ehr-translator-https"
  ip_address            = google_compute_global_address.lb_ip.address
  port_range            = "443"
  target                = google_compute_target_https_proxy.default[0].id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}
