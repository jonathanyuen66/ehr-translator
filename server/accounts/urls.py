from django.urls import path

from . import views

urlpatterns = [
    path("request-link/", views.RequestLinkView.as_view(), name="request-link"),
    path("me/", views.MeView.as_view(), name="me"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
]
