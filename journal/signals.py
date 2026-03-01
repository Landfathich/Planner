from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import UserProfile


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        # При создании пользователя устанавливаем start_week_date = понедельник текущей недели
        today = timezone.now().date()
        monday = today - timedelta(days=today.weekday())

        UserProfile.objects.create(
            user=instance,
            start_week_date=monday,
            start_week_number=1
        )


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()
