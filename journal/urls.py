from django.urls import path

from . import views
from .views import WeekView

urlpatterns = [
    path('', WeekView.as_view(), name='week'),

    path('api/tasks/create/', views.create_task, name='create_task'),
    path('api/tasks/<int:task_id>/', views.get_task, name='get_task'),
    path('api/tasks/<int:task_id>/update/', views.update_task, name='update_task'),
    path('api/tasks/<int:task_id>/delete/', views.delete_task, name='delete_task'),
]
