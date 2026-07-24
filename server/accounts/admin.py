from django.contrib import admin

from .models import AccessRequest, Invite, LoginToken, User

admin.site.register(User)
admin.site.register(Invite)
admin.site.register(LoginToken)
admin.site.register(AccessRequest)
