from django.contrib import admin
from django.urls import include, path

from accounts.views import access_request_approve, access_request_deny, auth_callback

urlpatterns = [
    path("admin/", admin.site.urls),
    path("auth/callback/", auth_callback, name="auth-callback"),
    path("auth/access-requests/<str:token>/approve/", access_request_approve, name="access-request-approve"),
    path("auth/access-requests/<str:token>/deny/", access_request_deny, name="access-request-deny"),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("documents.urls")),
]
