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
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='weekly_goals')
    text = models.CharField(max_length=500, verbose_name="Текст цели")
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


class YearlyGoal(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='yearly_goals')
    year = models.IntegerField(verbose_name="Год")
    text = models.TextField(verbose_name="Текст цели")
    is_completed = models.BooleanField(default=False, verbose_name="Выполнена")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['year', 'created_at']
        verbose_name = "Годовая цель"
        verbose_name_plural = "Годовые цели"

    def __str__(self):
        return f"{self.year}: {self.text[:50]}"


class YearlyReport(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='yearly_reports')
    year = models.IntegerField(verbose_name="Год")
    text = models.TextField(verbose_name="Годовой отчёт", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year']
        verbose_name = "Годовой отчёт"
        verbose_name_plural = "Годовые отчёты"

    def __str__(self):
        return f"Отчёт за {self.year}"


class MonthlyGoal(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='monthly_goals')
    year = models.IntegerField(verbose_name="Год")
    month = models.IntegerField(verbose_name="Месяц (1-12)")
    text = models.TextField(verbose_name="Текст цели")
    is_completed = models.BooleanField(default=False, verbose_name="Выполнена")
    carried_over = models.BooleanField(default=False, verbose_name="Перенесена на следующий месяц")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['year', 'month', 'created_at']
        verbose_name = "Цель месяца"
        verbose_name_plural = "Цели месяцев"

    def __str__(self):
        return f"{self.year}-{self.month}: {self.text[:50]}"


class MonthlyReport(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='monthly_reports')
    year = models.IntegerField(verbose_name="Год")
    month = models.IntegerField(verbose_name="Месяц (1-12)")
    text = models.TextField(verbose_name="Отчёт за месяц", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year', '-month']
        verbose_name = "Отчёт за месяц"
        verbose_name_plural = "Отчёты за месяц"

    def __str__(self):
        return f"Отчёт за {self.year}-{self.month}"

class ScheduleTemplate(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='schedule_templates')
    name = models.CharField(max_length=200, verbose_name="Название шаблона")
    description = models.TextField(blank=True, null=True, verbose_name="Описание")
    is_default = models.BooleanField(default=False, verbose_name="Шаблон по умолчанию")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_default', 'name']
        verbose_name = "Шаблон расписания"
        verbose_name_plural = "Шаблоны расписания"

    def __str__(self):
        return self.name


class ScheduleItem(models.Model):
    template = models.ForeignKey(ScheduleTemplate, on_delete=models.CASCADE, related_name='items')
    time = models.CharField(max_length=10, verbose_name="Время (например, 09:00)")
    title = models.CharField(max_length=200, verbose_name="Название")
    description = models.TextField(blank=True, null=True, verbose_name="Описание")
    order = models.IntegerField(default=0, verbose_name="Порядок")

    class Meta:
        ordering = ['order', 'time']
        verbose_name = "Пункт расписания"
        verbose_name_plural = "Пункты расписания"

    def __str__(self):
        return f"{self.time} - {self.title}"


class DailySchedule(models.Model):
    DAYS_OF_WEEK = [
        (0, 'Понедельник'),
        (1, 'Вторник'),
        (2, 'Среда'),
        (3, 'Четверг'),
        (4, 'Пятница'),
        (5, 'Суббота'),
        (6, 'Воскресенье'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='daily_schedules')
    day_of_week = models.IntegerField(choices=DAYS_OF_WEEK, verbose_name="День недели")
    template = models.ForeignKey(ScheduleTemplate, on_delete=models.CASCADE, verbose_name="Шаблон")
    active = models.BooleanField(default=True, verbose_name="Активно")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'day_of_week']
        verbose_name = "Расписание на день"
        verbose_name_plural = "Расписания на дни"

    def __str__(self):
        return f"{self.get_day_of_week_display()}: {self.template.name}"