from django.contrib import admin

from .models import Annotation, Document

admin.site.register(Document)
admin.site.register(Annotation)
