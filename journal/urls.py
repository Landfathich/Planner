from django.urls import path

from . import views
from .views import WeekView

urlpatterns = [
    path('', WeekView.as_view(), name='week'),

    path('api/week-data/', views.week_data, name='api_week_data'),

    path('api/tasks/create/', views.create_task, name='create_task'),
    path('api/tasks/<int:task_id>/', views.get_task, name='get_task'),
    path('api/tasks/<int:task_id>/update/', views.update_task, name='update_task'),
    path('api/tasks/<int:task_id>/delete/', views.delete_task, name='delete_task'),

    path('api/habits/create/', views.create_habit, name='create_habit'),
    path('api/habits/<int:habit_id>/update/', views.update_habit, name='update_habit'),
    path('api/habits/<int:habit_id>/delete/', views.delete_habit, name='delete_habit'),
    path('api/habits/entry/update/', views.update_habit_entry, name='update_habit_entry'),

    path('api/weekly-goals/create/', views.create_weekly_goal, name='create_weekly_goal'),
    path('api/weekly-goals/<int:goal_id>/update/', views.update_weekly_goal, name='update_weekly_goal'),
    path('api/weekly-goals/<int:goal_id>/delete/', views.delete_weekly_goal, name='delete_weekly_goal'),

    path('goals/', views.GoalsView.as_view(), name='goals'),

    # Goals API
    path('api/goals/monthly/preview/', views.goals_monthly_preview, name='goals_monthly_preview'),

    path('api/goals/years/', views.goals_years_list, name='goals_years_list'),
    path('api/goals/years/create/', views.goals_create_year, name='goals_create_year'),
    path('api/goals/year/<int:year>/', views.goals_year_data, name='goals_year_data'),
    path('api/goals/yearly/create/', views.goals_create_yearly_goal, name='goals_create_yearly_goal'),
    path('api/goals/yearly/<int:goal_id>/toggle/', views.goals_toggle_yearly_goal, name='goals_toggle_yearly_goal'),
    path('api/goals/yearly/<int:goal_id>/update/', views.goals_update_yearly_goal, name='goals_update_yearly_goal'),
    path('api/goals/yearly/<int:goal_id>/delete/', views.goals_delete_yearly_goal, name='goals_delete_yearly_goal'),
    path('api/goals/yearly/<int:goal_id>/carry/', views.goals_carry_yearly_goal, name='goals_carry_yearly_goal'),
    path('api/goals/monthly/create/', views.goals_create_monthly_goal, name='goals_create_monthly_goal'),
    path('api/goals/monthly/<int:goal_id>/toggle/', views.goals_toggle_monthly_goal, name='goals_toggle_monthly_goal'),
    path('api/goals/monthly/<int:goal_id>/update/', views.goals_update_monthly_goal, name='goals_update_monthly_goal'),
    path('api/goals/monthly/<int:goal_id>/delete/', views.goals_delete_monthly_goal, name='goals_delete_monthly_goal'),
    path('api/goals/monthly/<int:goal_id>/carry/', views.goals_carry_monthly_goal, name='goals_carry_monthly_goal'),
    path('api/goals/report/yearly/update/', views.goals_update_yearly_report, name='goals_update_yearly_report'),
    path('api/goals/report/monthly/update/', views.goals_update_monthly_report, name='goals_update_monthly_report'),

    path('schedule/', views.ScheduleView.as_view(), name='schedule'),

# Schedule API
path('api/schedule/templates/', views.schedule_templates_list, name='schedule_templates_list'),
path('api/schedule/templates/create/', views.schedule_create_template, name='schedule_create_template'),
path('api/schedule/templates/<int:template_id>/update/', views.schedule_update_template, name='schedule_update_template'),
path('api/schedule/templates/<int:template_id>/delete/', views.schedule_delete_template, name='schedule_delete_template'),
path('api/schedule/templates/<int:template_id>/items/', views.schedule_template_items, name='schedule_template_items'),
path('api/schedule/templates/<int:template_id>/items/update/', views.schedule_update_items, name='schedule_update_items'),
path('api/schedule/daily/', views.schedule_daily_list, name='schedule_daily_list'),
path('api/schedule/daily/update/', views.schedule_update_daily, name='schedule_update_daily'),

path('today/', views.TodayScheduleView.as_view(), name='today_schedule'),

# Today Schedule API
path('api/schedule/today/', views.today_schedule, name='api_today_schedule'),  # ← поменял имя
path('api/schedule/today/toggle/', views.today_schedule_toggle, name='api_today_schedule_toggle'),
path('api/schedule/today/item/<int:item_id>/delete/', views.today_schedule_delete_item, name='api_today_schedule_delete_item'),
path('api/schedule/today/item/<int:item_id>/update/', views.today_schedule_update_item, name='api_today_schedule_update_item'),
    ]