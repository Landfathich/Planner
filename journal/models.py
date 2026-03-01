from datetime import timedelta

from django.contrib.auth.models import User
from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    start_week_number = models.IntegerField(default=1, verbose_name="Начальный номер недели")
    start_week_date = models.DateField(default=timezone.now, verbose_name="Дата начала отсчёта")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def get_current_week_number(self, current_monday):
        """
        Вычисляет номер недели для заданного понедельника
        """
        # Приводим start_week_date к понедельнику (на всякий случай)
        start_monday = self.start_week_date - timedelta(days=self.start_week_date.weekday())

        # Сколько дней прошло
        days_diff = (current_monday - start_monday).days

        # Сколько полных недель прошло
        weeks_passed = days_diff // 7

        # Текущий номер
        return self.start_week_number + weeks_passed

    def __str__(self):
        return f"Profile for {self.user.username}"

    class Meta:
        verbose_name = "Профиль пользователя"
        verbose_name_plural = "Профили пользователей"


class Task(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    is_done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    date = models.DateField()
    is_weekly = models.BooleanField(default=False)  # Флаг для определения недельной задачи

    def toggle_done(self):
        self.is_done = not self.is_done
        self.save()

    class Meta:
        ordering = ['date', 'created_at']
