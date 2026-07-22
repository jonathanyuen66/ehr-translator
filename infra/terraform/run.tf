locals {
  # Shared across the api service and the migrate job so the two never drift.
  app_env = [
    { name = "DEBUG", value = "false" },
    { name = "ALLOWED_HOSTS", value = local.has_domain ? var.domain_name : "*" },
    { name = "FRONTEND_URL", value = local.has_domain ? "https://${var.domain_name}" : "http://${google_compute_global_address.lb_ip.address}" },
    { name = "BACKEND_URL", value = local.has_domain ? "https://${var.domain_name}" : "http://${google_compute_global_address.lb_ip.address}" },
    { name = "DB_NAME", value = google_sql_database.main.name },
    { name = "DB_USER", value = google_sql_user.app.name },
    { name = "DB_HOST", value = "/cloudsql/${google_sql_database_instance.main.connection_name}" },
    { name = "DB_PORT", value = "5432" },
    { name = "GS_BUCKET_NAME", value = google_storage_bucket.uploads.name },
    { name = "GS_PROJECT_ID", value = var.project_id },
    { name = "DLP_PROJECT_ID", value = var.project_id },
    { name = "VERTEX_PROJECT_ID", value = var.project_id },
    { name = "VERTEX_LOCATION", value = var.region },
    { name = "EMAIL_BACKEND", value = "django.core.mail.backends.console.EmailBackend" }, # swap for real SMTP/SendGrid before go-live
  ]
}

resource "google_cloud_run_v2_service" "api" {
  name                = "api"
  location            = var.region
  deletion_protection = false
  # Blocks the default *.run.app URL from being reachable directly — the
  # LB's serverless NEG (lb.tf) is the only path in, which is what makes
  # Cloud Armor coverage actually mean something.
  ingress = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    service_account = google_service_account.cloud_run_api.email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    vpc_access {
      connector = google_vpc_access_connector.main.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = var.app_image

      ports {
        container_port = 8080
      }

      dynamic "env" {
        for_each = local.app_env
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.django_secret_key.secret_id
            version = "latest"
          }
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# The LB's serverless NEG needs to invoke the service. Safe in combination
# with the INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER setting above, which is
# what actually prevents direct internet access to the service.
resource "google_cloud_run_v2_service_iam_member" "lb_invoker" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Migrations run as a one-off job, not on every container boot — avoids
# concurrent-migration races when multiple instances start up at once.
# Trigger with: gcloud run jobs execute migrate --region=REGION --wait
resource "google_cloud_run_v2_job" "migrate" {
  name                = "migrate"
  location            = var.region
  deletion_protection = false

  template {
    template {
      service_account = google_service_account.cloud_run_api.email
      max_retries     = 1

      vpc_access {
        connector = google_vpc_access_connector.main.id
        egress    = "PRIVATE_RANGES_ONLY"
      }

      containers {
        image   = var.app_image
        command = ["python", "manage.py"]
        args    = ["migrate", "--noinput"]

        dynamic "env" {
          for_each = local.app_env
          content {
            name  = env.value.name
            value = env.value.value
          }
        }

        env {
          name = "DB_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.db_password.secret_id
              version = "latest"
            }
          }
        }

        env {
          name = "SECRET_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.django_secret_key.secret_id
              version = "latest"
            }
          }
        }

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [google_sql_database_instance.main.connection_name]
        }
      }
    }
  }
}
