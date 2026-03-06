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


class Habit(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='habits')
    name = models.CharField(max_length=200, verbose_name="Название привычки")
    description = models.TextField(blank=True, null=True, verbose_name="Описание")
    start_date = models.DateField(default=timezone.now, verbose_name="Дата начала")
    end_date = models.DateField(null=True, blank=True, verbose_name="Дата завершения")
    order = models.IntegerField(default=0, verbose_name="Порядок")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'created_at']
        verbose_name = "Привычка"
        verbose_name_plural = "Привычки"

    def __str__(self):
        return self.name

    def is_active_for_week(self, week_start):
        """Проверяет, активна ли привычка для указанной недели"""
        week_end = week_start + timedelta(days=6)

        # Если есть end_date и неделя полностью после окончания
        if self.end_date and week_start > self.end_date:
            return False

        # Если неделя полностью до начала
        if week_end < self.start_date:
            return False

        return True


class HabitEntry(models.Model):
    STATUS_CHOICES = [
        ('empty', 'Пусто'),
        ('checked', '✓'),
        ('crossed', '✗'),
        ('circled', '○'),
    ]

    habit = models.ForeignKey(Habit, on_delete=models.CASCADE, related_name='entries')
    date = models.DateField(verbose_name="Дата")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='empty', verbose_name="Статус")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['habit', 'date']  # одна запись на привычку в день
        ordering = ['date']
        verbose_name = "Запись привычки"
        verbose_name_plural = "Записи привычек"

    def __str__(self):
        return f"{self.habit.name} - {self.date} - {self.get_status_display()}"


class WeeklyGoal(models.Model):
    GOAL_TYPES = [
        ('once', '✔️ Однократная'),
        ('ongoing', '🕑 Постоянная'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='weekly_goals')
    text = models.CharField(max_length=500, verbose_name="Текст цели")
    goal_type = models.CharField(max_length=10, choices=GOAL_TYPES, default='once', verbose_name="Тип цели")
    week_start = models.DateField(verbose_name="Неделя (понедельник)")
    is_completed = models.BooleanField(default=False, verbose_name="Выполнена")
    is_carried_over = models.BooleanField(default=False, verbose_name="Перенесена на след. неделю")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['week_start', '-created_at']
        verbose_name = "Цель недели"
        verbose_name_plural = "Цели недели"

    def __str__(self):
        return f"{self.text[:50]}... ({self.week_start})"