from django.contrib import admin

from .models import Annotation, Document, DocumentAccessLog

admin.site.register(Document)
admin.site.register(Annotation)


@admin.register(DocumentAccessLog)
class DocumentAccessLogAdmin(admin.ModelAdmin):
    list_display = ["occurred_at", "user_email", "action", "document_display_name"]
    list_filter = ["action"]
    search_fields = ["user_email", "document_display_name"]
    date_hierarchy = "occurred_at"

    # An audit trail that could be edited or deleted through the same UI
    # used to review it isn't an audit trail — read-only end to end.
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
