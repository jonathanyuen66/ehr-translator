locals {
  # Cloud Run actually serves each service on *two* live hostnames
  # simultaneously (confirmed against the real deployment, both return 200):
  # the deterministic "api-PROJECT_NUMBER.REGION.run.app" form (computable
  # ahead of creation, no circular reference needed) and a legacy
  # hash-based form assigned at creation time (not predictable — see
  # var.backend_host_override). Both are genuine Google-assigned hosts for
  # this exact service, not attacker-controllable, so both belong in
  # ALLOWED_HOSTS; relying on only one meant real requests to the other got
  # rejected with DisallowedHost.
  backend_host_deterministic = "api-${data.google_project.current.number}.${var.region}.run.app"
  backend_hosts = compact([
    local.backend_host_deterministic,
    var.backend_host_override,
    var.root_domain != "" ? local.api_domain : "",
  ])

  # Console backend until real Mailgun credentials are actually provided
  # (var.mailgun_smtp_login/_password both default to "") — same
  # optional-locally-required-eventually pattern as DLP/GCS/Vertex above,
  # except here "eventually" specifically means "before anyone but you
  # tries to sign in", since sign-in emails go nowhere without this.
  mailgun_configured = var.mailgun_smtp_login != "" && var.mailgun_smtp_password != ""

  # Shared across the api service and the migrate job so the two never drift.
  app_env = [
    { name = "DEBUG", value = "false" },
    { name = "ALLOWED_HOSTS", value = join(",", local.backend_hosts) },
    # A separate setting from ALLOWED_HOSTS (Django 4.0+) — same real hosts,
    # just each needs the full "https://" origin, not just the bare host.
    # Cloud Run is always HTTPS-fronted regardless of which of the two hosts
    # gets used, so this prefix is a safe assumption here specifically.
    { name = "CSRF_TRUSTED_ORIGINS", value = join(",", [for h in local.backend_hosts : "https://${h}"]) },
    # The frontend is its own Cloud Run service now — this points at its
    # mapped custom domain once root_domain is set (app_custom_domain_url
    # output), or its raw *.run.app URL otherwise (cloud_run_frontend_url
    # output) — same "real host, either way" idea as backend_hosts above.
    # No BACKEND_URL env var: the sign-in email link is built from the
    # request's own Host header (accounts/views.py, via
    # request.build_absolute_uri()) rather than a configured/guessed value —
    # correct regardless of what URL the backend actually ends up reachable
    # at, and safe specifically because ALLOWED_HOSTS above is the real host,
    # not a wildcard, so Django rejects any spoofed Host header before that
    # view code ever runs.
    { name = "FRONTEND_URL", value = var.root_domain != "" ? "https://${local.app_domain}" : google_cloud_run_v2_service.frontend.uri },
    { name = "DB_NAME", value = google_sql_database.main.name },
    { name = "DB_USER", value = google_sql_user.app.name },
    { name = "DB_HOST", value = "/cloudsql/${google_sql_database_instance.main.connection_name}" },
    { name = "DB_PORT", value = "5432" },
    { name = "GS_BUCKET_NAME", value = google_storage_bucket.uploads.name },
    { name = "GS_PROJECT_ID", value = var.project_id },
    { name = "DLP_PROJECT_ID", value = var.project_id },
    { name = "VISION_PROJECT_ID", value = var.project_id },
    { name = "VERTEX_PROJECT_ID", value = var.project_id },
    { name = "VERTEX_LOCATION", value = var.region },
    # Vertex's publisher-model catalog doesn't always carry the same model
    # IDs as the consumer/AI-Studio API (GEMINI_MODEL's default in
    # settings.py) — confirmed the hard way: gemini-3.1-flash-lite 404s on
    # Vertex in this project/region even though it works fine through the
    # plain API-key client. Blank falls back to GEMINI_MODEL
    # (documents/gemini.py), same as local dev.
    { name = "VERTEX_MODEL", value = var.vertex_model },
    {
      name  = "EMAIL_BACKEND"
      value = local.mailgun_configured ? "django.core.mail.backends.smtp.EmailBackend" : "django.core.mail.backends.console.EmailBackend"
    },
    { name = "EMAIL_HOST", value = var.mailgun_smtp_host },
    { name = "EMAIL_PORT", value = "587" },
    { name = "EMAIL_USE_TLS", value = "true" },
    { name = "EMAIL_HOST_USER", value = var.mailgun_smtp_login },
    { name = "DEFAULT_FROM_EMAIL", value = var.default_from_email },
    { name = "OWNER_EMAIL", value = var.owner_email },
  ]
}

resource "google_cloud_run_v2_service" "api" {
  name                = "api"
  location            = var.region
  deletion_protection = false
  # No load balancer in front anymore — the service's own default URL is the
  # public address, so ingress has to allow direct traffic. Cloud Run's own
  # TLS termination on that URL is what provides encryption in transit here.
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run_api.email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    # Direct VPC egress — only how this reaches Cloud SQL's private IP
    # (network.tf/sql.tf). PRIVATE_RANGES_ONLY keeps everything else (Vertex
    # AI, PubMed, Mailgun) on Cloud Run's normal public egress path, which is
    # what avoids needing a Cloud NAT gateway here.
    vpc_access {
      network_interfaces {
        network    = google_compute_network.main.id
        subnetwork = google_compute_subnetwork.main.id
      }
      egress = "PRIVATE_RANGES_ONLY"
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

      env {
        name = "EMAIL_HOST_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.mailgun_smtp_password.secret_id
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

# Public invocation is the whole point now that the service's own URL is the
# front door (no LB to gate it instead) — Cloud Run's own IAM/auth model for
# the *service* stays separate from the app's own auth (magic-link + token),
# which is what actually protects the data behind this.
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
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

      # Same reason as the api service above — this job connects to Cloud
      # SQL directly too, and would otherwise lose connectivity the moment
      # the instance goes private-IP-only.
      vpc_access {
        network_interfaces {
          network    = google_compute_network.main.id
          subnetwork = google_compute_subnetwork.main.id
        }
        egress = "PRIVATE_RANGES_ONLY"
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

        env {
          name = "EMAIL_HOST_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.mailgun_smtp_password.secret_id
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

# The static frontend build (web/dist), served by nginx (web/Dockerfile) —
# its own Cloud Run service rather than a public GCS bucket, so it can use
# the same domain-mapping mechanism as the api service above instead of
# needing a load balancer just to get a custom-domain HTTPS certificate.
# Genuinely free at family/friends scale (Cloud Run's perpetual free tier),
# unlike a load balancer's flat monthly charge.
resource "google_cloud_run_v2_service" "frontend" {
  name                = "frontend"
  location            = var.region
  deletion_protection = false
  ingress             = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run_frontend.email

    scaling {
      min_instance_count = 0
      max_instance_count = var.max_instances
    }

    containers {
      image = var.frontend_image

      ports {
        container_port = 8080
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public_invoker" {
  name     = google_cloud_run_v2_service.frontend.name
  location = google_cloud_run_v2_service.frontend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Maps app.ROOT_DOMAIN / api.ROOT_DOMAIN to the two services above and
# provisions a Google-managed cert for each — the whole reason a load
# balancer isn't needed for a custom HTTPS domain here. Requires the domain
# already verified in Search Console under this same GCP account (see
# variables.tf); `terraform apply` fails on these two specifically, not the
# rest of the plan, if that step was skipped.
resource "google_cloud_run_domain_mapping" "app" {
  count    = var.root_domain != "" ? 1 : 0
  location = var.region
  name     = local.app_domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.frontend.name
  }
}

resource "google_cloud_run_domain_mapping" "api" {
  count    = var.root_domain != "" ? 1 : 0
  location = var.region
  name     = local.api_domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.api.name
  }
}
