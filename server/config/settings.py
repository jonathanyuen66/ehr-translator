"""
Django settings for config project.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("SECRET_KEY", "django-insecure-dev-key-change-me")
DEBUG = os.environ.get("DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# Cloud Run terminates TLS at its own edge and forwards plain HTTP
# internally, so without this, request.is_secure() is always False behind
# it — which breaks CSRF validation for any POST submitted over HTTPS (e.g.
# the admin login form). Safe locally too: only takes effect when the
# X-Forwarded-Proto header is actually present, which it never is for a
# direct, no-proxy local connection. Safe on Cloud Run specifically because
# containers there have no public IP of their own — every request genuinely
# passes through Cloud Run's own proxy, which is what sets this header, so
# it can't be spoofed by an external client bypassing that proxy.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# A separate setting from ALLOWED_HOSTS since Django 4.0 — easy to miss,
# and CSRF checks fail without it even when ALLOWED_HOSTS is already
# correct. Empty by default (a no-op locally); set via env in any deployed
# environment to the real, full origin(s) (scheme + host).
CSRF_TRUSTED_ORIGINS = [
    origin.strip() for origin in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if origin.strip()
]

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5174")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "accounts",
    "documents",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "ehr_translator"),
        "USER": os.environ.get("DB_USER", ""),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
    }
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

CORS_ALLOWED_ORIGINS = [FRONTEND_URL]

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")
PUBMED_API_KEY = os.environ.get("PUBMED_API_KEY", "")

# GCP project for Vertex AI (see documents/gemini.py). Left blank in local
# dev — falls back to the plain API-key Gemini client above, same "optional
# locally" pattern as DLP_PROJECT_ID and GS_BUCKET_NAME. Required in any
# deployed environment: Vertex AI is the BAA-eligible path, unlike the
# consumer/free-tier API key, whose terms permit Google to use inputs to
# improve their products.
VERTEX_PROJECT_ID = os.environ.get("VERTEX_PROJECT_ID", "")
VERTEX_LOCATION = os.environ.get("VERTEX_LOCATION", "us-central1")
# Vertex's publisher model IDs don't always match AI Studio's model names
# 1:1 — override here if the Vertex-side ID differs from GEMINI_MODEL.
# Confirm the exact ID against the Vertex Model Garden before deploying.
VERTEX_MODEL = os.environ.get("VERTEX_MODEL", "")

# GCP project running the Cloud DLP API used as the first redaction pass in
# documents/dlp.py. Left blank in local dev — that pass is skipped (with a
# warning) rather than requiring every developer to have GCP credentials.
DLP_PROJECT_ID = os.environ.get("DLP_PROJECT_ID", "")

# In dev, emails print to the runserver console instead of actually sending —
# the sign-in link shows up right in the terminal, same idea as grabbing the
# link from the Firebase Auth Emulator UI during the earlier prototype. In
# any deployed environment EMAIL_BACKEND is set to Django's SMTP backend
# against Mailgun's SMTP relay (see infra/terraform/run.tf) — the four
# EMAIL_HOST* settings below are only consulted when that backend is active,
# so they're harmless no-ops locally.
EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "true").lower() == "true"
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "no-reply@ehr-translator.local")

# Where RequestLinkView emails when someone not on the invite list tries to
# sign in (accounts/views.py) — blank by default, same optional-locally
# pattern as everything else: no owner address configured just means those
# attempts go unnoticed instead of erroring.
OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "")

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"  # populated by `collectstatic`, served by WhiteNoise

MEDIA_ROOT = BASE_DIR / "media"
MEDIA_URL = "/media/"  # not wired into urls.py on purpose — files are only
# ever served through the permission-checked DocumentViewSet.file action.

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Uploaded documents (Document.file) go to a private, CMEK-encrypted GCS
# bucket when GS_BUCKET_NAME is set — required in any deployed environment,
# since that's where actual patient PHI lives. Left blank in local dev, which
# falls back to Django's default local FileSystemStorage, same "optional
# locally" pattern as DLP_PROJECT_ID above. Static assets (admin, DRF
# browsable API) deliberately stay off GCS entirely — WhiteNoise serves those
# directly from the container instead, since they're small, contain no PHI,
# and don't need CMEK or per-object access control. STORAGES is set
# unconditionally (not via the legacy STATICFILES_STORAGE setting, which
# Django 5.1+ no longer derives STORAGES from automatically).
GS_BUCKET_NAME = os.environ.get("GS_BUCKET_NAME", "")
GS_PROJECT_ID = os.environ.get("GS_PROJECT_ID", "")

STORAGES = {
    "default": (
        {
            "BACKEND": "storages.backends.gcloud.GoogleCloudStorage",
            "OPTIONS": {
                "bucket_name": GS_BUCKET_NAME,
                "project_id": GS_PROJECT_ID,
                # No public ACLs and no signed URLs — the bucket is
                # IAM-only/private, and the only access path is the
                # permission-checked DocumentViewSet.file action, same as
                # local storage today.
                "default_acl": None,
                "querystring_auth": False,
            },
        }
        if GS_BUCKET_NAME
        else {"BACKEND": "django.core.files.storage.FileSystemStorage"}
    ),
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
