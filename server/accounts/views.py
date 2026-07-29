import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.core.mail import send_mail
from django.http import HttpResponse, HttpResponseRedirect
from django.utils import timezone
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AccessRequest, Invite, LoginToken, User
from .serializers import UserSerializer

logger = logging.getLogger(__name__)

# One owner notification per requesting email per day — a request-link retry
# loop (deliberate or just someone mashing the button) would otherwise spam
# OWNER_EMAIL once per attempt. Every attempt still gets recorded in
# AccessRequest either way, just not all of them re-notify.
NOTIFY_COOLDOWN = timedelta(hours=24)


class RequestLinkView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not Invite.objects.filter(email__iexact=email).exists():
            self._notify_owner(request, email)
            return Response(
                {
                    "detail": "This app is invite-only. Your request has been recorded — "
                    "the owner will be in touch if you're approved."
                },
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

    def _notify_owner(self, request, email):
        """Lets someone uninvited actually be noticed, instead of the
        request just silently 403ing — OWNER_EMAIL is blank by default
        (same optional-locally pattern as everything else), so this is a
        no-op until it's set. The email links straight to
        access_request_approve/deny below, so approving is one click, not a
        shell session.
        """
        recently_notified = AccessRequest.objects.filter(
            email__iexact=email, notified_at__gte=timezone.now() - NOTIFY_COOLDOWN
        ).exists()
        access_request = AccessRequest.objects.create(email=email)

        if recently_notified or not settings.OWNER_EMAIL:
            return

        approve_link = request.build_absolute_uri(f"/auth/access-requests/{access_request.token}/approve/")
        deny_link = request.build_absolute_uri(f"/auth/access-requests/{access_request.token}/deny/")

        try:
            send_mail(
                subject="PlainMed: new sign-in request",
                message=(
                    f"{email} just tried to sign in but isn't on the invite list.\n\n"
                    f"Approve: {approve_link}\n"
                    f"Deny: {deny_link}"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.OWNER_EMAIL],
            )
        except Exception:
            # A notification failure shouldn't turn into a 500 for the
            # person who just got told, correctly, that they're not invited.
            logger.exception("Failed to notify owner of access request for %s", email)
            return

        access_request.notified_at = timezone.now()
        access_request.save(update_fields=["notified_at"])


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


def access_request_approve(request, token):
    return _decide_access_request(request, token, AccessRequest.Decision.APPROVED)


def access_request_deny(request, token):
    return _decide_access_request(request, token, AccessRequest.Decision.DENIED)


def _decide_access_request(request, token, decision):
    access_request = AccessRequest.objects.filter(token=token).first()
    if access_request is None:
        return HttpResponse("This link is invalid.", status=404)

    # Unauthenticated by design (there's no admin login flow to gate this
    # on — the token in the link is what authorizes it), so a second click
    # of either link, or a link-prescanning bot, has to be a safe no-op
    # rather than re-deciding or double-inviting.
    if access_request.decision:
        return HttpResponse(
            f"{access_request.email} was already {access_request.decision} "
            f"on {access_request.decided_at:%b %-d, %Y %-I:%M %p}."
        )

    if decision == AccessRequest.Decision.APPROVED:
        Invite.objects.get_or_create(email=access_request.email)

    access_request.decision = decision
    access_request.decided_at = timezone.now()
    access_request.save(update_fields=["decision", "decided_at"])

    if decision == AccessRequest.Decision.APPROVED:
        _send_approval_email(request, access_request.email)

    verb = "approved and added to the invite list" if decision == AccessRequest.Decision.APPROVED else "denied"
    return HttpResponse(f"{access_request.email} has been {verb}.")


def _send_approval_email(request, email):
    """Lets someone who was just approved actually get in, instead of the
    only trace of their approval being the owner's plain-text confirmation
    page — issues a fresh sign-in link the same way RequestLinkView.post
    does, so it's a normal 15-minute magic link, not something the owner
    has to relay by hand.
    """
    login_token = LoginToken.objects.create(email=email)
    link = request.build_absolute_uri(f"/auth/callback/?token={login_token.token}")
    try:
        send_mail(
            subject="You're approved for PlainMed",
            message=(
                "Good news — you've been approved to sign in to PlainMed.\n\n"
                f"Click to sign in (expires in 15 minutes): {link}"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
        )
    except Exception:
        # The invite itself is already saved at this point — a failed
        # notification shouldn't turn into a 500 for whoever clicked
        # approve, and the person can still request a link normally.
        logger.exception("Failed to send approval email to %s", email)


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
