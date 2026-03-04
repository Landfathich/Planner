from django.urls import path

from . import views
from .views import WeekView

urlpatterns = [
    path('', WeekView.as_view(), name='week'),

    path('api/tasks/week/', views.week_tasks, name='api_week_data'),

    path('api/tasks/create/', views.create_task, name='create_task'),
    path('api/tasks/<int:task_id>/', views.get_task, name='get_task'),
    path('api/tasks/<int:task_id>/update/', views.update_task, name='update_task'),
    path('api/tasks/<int:task_id>/delete/', views.delete_task, name='delete_task'),

    path('api/habits/create/', views.create_habit, name='create_habit'),
    path('api/habits/<int:habit_id>/update/', views.update_habit, name='update_habit'),
    path('api/habits/<int:habit_id>/delete/', views.delete_habit, name='delete_habit'),
    path('api/habits/entry/update/', views.update_habit_entry, name='update_habit_entry'),
]