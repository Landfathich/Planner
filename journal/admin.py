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

from .models import Habit, HabitEntry

@admin.register(Habit)
class HabitAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'order', 'created_at']
    list_filter = ['user']
    search_fields = ['name', 'description']

@admin.register(HabitEntry)
class HabitEntryAdmin(admin.ModelAdmin):
    list_display = ['habit', 'date', 'status']
    list_filter = ['status', 'date']
    search_fields = ['habit__name']

from .models import WeeklyGoal


@admin.register(WeeklyGoal)
class WeeklyGoalAdmin(admin.ModelAdmin):
    list_display = ['text', 'user', 'week_start', 'is_completed', 'is_carried_over', 'created_at']
    list_filter = ['is_completed', 'is_carried_over', 'week_start']
    search_fields = ['text']
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        ('Основная информация', {
            'fields': ('user', 'text', 'week_start')
        }),
        ('Статус', {
            'fields': ('is_completed', 'is_carried_over')
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


from .models import YearlyGoal, YearlyReport, MonthlyGoal, MonthlyReport

@admin.register(YearlyGoal)
class YearlyGoalAdmin(admin.ModelAdmin):
    list_display = ['text', 'user', 'year', 'is_completed', 'created_at']
    list_filter = ['year', 'is_completed']
    search_fields = ['text']

@admin.register(YearlyReport)
class YearlyReportAdmin(admin.ModelAdmin):
    list_display = ['user', 'year', 'created_at']
    list_filter = ['year']

@admin.register(MonthlyGoal)
class MonthlyGoalAdmin(admin.ModelAdmin):
    list_display = ['text', 'user', 'year', 'month', 'is_completed', 'carried_over']
    list_filter = ['year', 'month', 'is_completed', 'carried_over']
    search_fields = ['text']

@admin.register(MonthlyReport)
class MonthlyReportAdmin(admin.ModelAdmin):
    list_display = ['user', 'year', 'month', 'created_at']
    list_filter = ['year', 'month']