from django.contrib import admin
from django.urls import include, path

from accounts.views import auth_callback

urlpatterns = [
    path("admin/", admin.site.urls),
    path("auth/callback/", auth_callback, name="auth-callback"),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("documents.urls")),
]
