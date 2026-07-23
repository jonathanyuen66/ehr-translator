from django.conf import settings
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.core.mail import send_mail
from django.http import HttpResponseRedirect
from django.utils import timezone
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Invite, LoginToken, User
from .serializers import UserSerializer


class RequestLinkView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not Invite.objects.filter(email__iexact=email).exists():
            return Response(
                {"detail": "This app is invite-only. Ask the owner to add your email to the invite list."},
                status=status.HTTP_403_FORBIDDEN,
            )

        login_token = LoginToken.objects.create(email=email)
        # Derived from the actual incoming request rather than a configured
        # BACKEND_URL — correct regardless of what URL the backend is
        # actually reachable at (Cloud Run's assigned URL isn't predictable
        # ahead of deploy), and one less thing to keep in sync locally.
        link = request.build_absolute_uri(f"/auth/callback/?token={login_token.token}")
        send_mail(
            subject="Your PlainMed sign-in link",
            message=f"Click to sign in (expires in 15 minutes): {link}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
        )
        return Response({"detail": "Sign-in link sent."})


def auth_callback(request):
    token_value = request.GET.get("token", "")
    login_token = LoginToken.objects.filter(token=token_value).first()

    if login_token is None or not login_token.is_valid():
        return HttpResponseRedirect(f"{settings.FRONTEND_URL}/#error=invalid_or_expired_link")

    if not Invite.objects.filter(email__iexact=login_token.email).exists():
        return HttpResponseRedirect(f"{settings.FRONTEND_URL}/#error=invalid_or_expired_link")

    login_token.used_at = timezone.now()
    login_token.save(update_fields=["used_at"])

    user, _ = User.objects.get_or_create(email=login_token.email)
    user.backend = "django.contrib.auth.backends.ModelBackend"
    django_login(request, user)

    api_token, _ = Token.objects.get_or_create(user=user)
    return HttpResponseRedirect(f"{settings.FRONTEND_URL}/#token={api_token.key}")


class MeView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class LogoutView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        django_logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)
