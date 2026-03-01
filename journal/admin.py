# Register your models here.
from django.contrib import admin

from .models import UserProfile, Task


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'start_week_number', 'start_week_date', 'created_at']
    list_filter = ['start_week_number']
    search_fields = ['user__username']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'date', 'is_weekly', 'is_done', 'created_at']
    list_filter = ['is_weekly', 'is_done', 'date', 'user']
    search_fields = ['title', 'description', 'user__username']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'date'

    fieldsets = (
        ('Основная информация', {
            'fields': ('user', 'title', 'description')
        }),
        ('Статус', {
            'fields': ('is_done', 'is_weekly', 'date')
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
