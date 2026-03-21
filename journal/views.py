import json
import logging
from datetime import timedelta

from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.views import LoginView, LogoutView
from django.http import JsonResponse
from django.shortcuts import redirect
from django.urls import reverse_lazy
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.views.generic import CreateView
from django.views.generic import TemplateView

from .forms import CustomRegisterForm
from .models import Task, UserProfile

logger = logging.getLogger(__name__)


class CustomRegisterView(CreateView):
    template_name = 'journal/register.html'
    form_class = CustomRegisterForm
    success_url = reverse_lazy('week')

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect(self.success_url)
        return super().dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        response = super().form_valid(form)
        # Автоматически логиним пользователя после регистрации
        login(self.request, self.object)
        return response


class CustomLoginView(LoginView):
    template_name = 'journal/login.html'
    redirect_authenticated_user = True

    def get_success_url(self):
        return reverse_lazy('week')


class CustomLogoutView(LogoutView):
    next_page = reverse_lazy('login')


class WeekView(LoginRequiredMixin, TemplateView):
    template_name = "journal/week.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        today = timezone.now().date()
        start_date = today - timedelta(days=today.weekday())

        context['week_start'] = start_date
        context['week_end'] = start_date + timedelta(days=6)
        context['today_date'] = today

        return context


@login_required
def week_data(request):
    try:
        week_offset = int(request.GET.get('week_offset', 0))

        today = timezone.now().date()
        start_date = today - timedelta(days=today.weekday()) + timedelta(weeks=week_offset)
        end_date = start_date + timedelta(days=6)

        print(f"Loading tasks for week {week_offset}: {start_date} to {end_date}")

        # Получаем профиль пользователя
        profile = request.user.profile

        # Вычисляем номер недели для запрашиваемого понедельника
        week_number = profile.get_current_week_number(start_date)

        # Задачи
        tasks = Task.objects.filter(
            user=request.user,
            date__range=[start_date, end_date]
        )

        tasks_data = [{
            'id': task.id,
            'title': task.title,
            'description': task.description or '',
            'is_done': task.is_done,
            'date': task.date.isoformat(),
            'is_weekly': task.is_weekly
        } for task in tasks]

        # Привычки
        all_habits = Habit.objects.filter(user=request.user)
        habits_data = []
        for habit in all_habits:
            if not habit.is_active_for_week(start_date):
                continue

            entries = HabitEntry.objects.filter(
                habit=habit,
                date__range=[start_date, end_date]
            )

            entries_dict = {}
            for entry in entries:
                entries_dict[entry.date.isoformat()] = entry.status

            habits_data.append({
                'id': habit.id,
                'name': habit.name,
                'description': habit.description,
                'order': habit.order,
                'start_date': habit.start_date.isoformat() if habit.start_date else None,
                'end_date': habit.end_date.isoformat() if habit.end_date else None,
                'entries': entries_dict
            })

        # ЦЕЛИ НЕДЕЛИ - ДОБАВЛЯЕМ
        weekly_goals = WeeklyGoal.objects.filter(
            user=request.user,
            week_start=start_date
        )

        goals_data = [{
            'id': goal.id,
            'text': goal.text,
            'is_completed': goal.is_completed,
            'is_carried_over': goal.is_carried_over
        } for goal in weekly_goals]

        print(f"Returning {len(tasks_data)} tasks, {len(habits_data)} habits, {len(goals_data)} goals")

        return JsonResponse({
            'success': True,
            'week_start': start_date.isoformat(),
            'week_end': end_date.isoformat(),
            'week_number': week_number,
            'tasks': tasks_data,
            'habits': habits_data,
            'weekly_goals': goals_data  # ДОБАВИЛИ
        })

    except Exception as e:
        print(f"Error in week_tasks: {e}")
        import traceback
        print(traceback.format_exc())
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@csrf_exempt
@require_POST
@login_required
def create_task(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Требуется авторизация'}, status=401)

    try:
        data = json.loads(request.body)

        if not data.get('title'):
            return JsonResponse({'error': 'Название задачи обязательно'}, status=400)

        if not data.get('date'):
            return JsonResponse({'error': 'Дата задачи обязательна'}, status=400)

        task = Task.objects.create(
            user=request.user,
            title=data['title'],
            description=data.get('description', ''),
            date=data['date'],
            is_done=data.get('is_done', False),
            is_weekly=data.get('is_weekly', False),
            # TODO это надо присылать с фронтенда, сейчас это не присылается
        )

        # TODO так же если задача недельная, то получить возможно надо недельные задачи
        # Получаем все задачи на эту дату
        tasks = Task.objects.filter(date=data['date'], user=request.user)
        tasks_data = [{
            'id': t.id,
            'title': t.title,
            'description': t.description,
            'date': t.date.isoformat(),
            'is_done': t.is_done,
            'is_weekly': t.is_weekly
        } for t in tasks]

        return JsonResponse({
            'tasks': tasks_data,
            'new_task_id': task.id
        }, status=201)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Неверный JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
@csrf_exempt
def get_task(request, task_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Требуется авторизация'}, status=401)

    try:
        task = Task.objects.get(id=task_id, user=request.user)
        return JsonResponse({
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'date': task.date.isoformat(),
            'is_done': task.is_done,
            'is_weekly': task.is_weekly
        })
    except Task.DoesNotExist:
        return JsonResponse({'error': 'Задача не найдена'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
@require_POST
@login_required
def update_task(request, task_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Требуется авторизация'}, status=401)

    try:
        task = Task.objects.get(id=task_id, user=request.user)
        data = json.loads(request.body)

        task.title = data.get('title', task.title)
        task.description = data.get('description', task.description)
        task.is_done = data.get('is_done', task.is_done)
        task.is_weekly = data.get('is_weekly', task.is_weekly)
        task.date = data.get('date', task.date)

        task.save()

        return JsonResponse({
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'date': task.date,
            'is_done': task.is_done,
            'is_weekly': task.is_weekly
        })

    except Task.DoesNotExist:
        return JsonResponse({'error': 'Задача не найдена'}, status=404)
    except Exception as e:
        print(f"Error in update_task: {e}")
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
@require_POST
@login_required
def delete_task(request, task_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Требуется авторизация'}, status=401)

    try:
        task = Task.objects.get(id=task_id, user=request.user)
        task.delete()
        return JsonResponse({'status': 'deleted'})

    except Task.DoesNotExist:
        return JsonResponse({'error': 'Задача не найдена'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


from .models import Habit, HabitEntry


@login_required
def create_habit(request):
    """Создание новой привычки"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)

        habit = Habit.objects.create(
            user=request.user,
            name=data['name'],
            description=data.get('description', ''),
            start_date=data.get('start_date', timezone.now().date()),
            end_date=data.get('end_date'),  # Может быть None
            order=data.get('order', 0)
        )

        return JsonResponse({
            'id': habit.id,
            'name': habit.name,
            'description': habit.description,
            'start_date': habit.start_date,
            'end_date': habit.end_date,
            'order': habit.order
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
def update_habit(request, habit_id):
    """Обновление привычки"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        habit = Habit.objects.get(id=habit_id, user=request.user)
        data = json.loads(request.body)

        habit.name = data.get('name', habit.name)
        habit.description = data.get('description', habit.description)
        habit.order = data.get('order', habit.order)

        # Добавляем обработку дат
        if 'start_date' in data:
            habit.start_date = data['start_date']
        if 'end_date' in data:
            habit.end_date = data['end_date']

        habit.save()

        # ВОЗВРАЩАЕМ ДАТЫ КАК СТРОКИ, БЕЗ isoformat()
        return JsonResponse({
            'id': habit.id,
            'name': habit.name,
            'description': habit.description,
            'order': habit.order,
            'start_date': habit.start_date,  # Просто строка
            'end_date': habit.end_date if habit.end_date else None  # Просто строка или None
        })
    except Habit.DoesNotExist:
        return JsonResponse({'error': 'Habit not found'}, status=404)
    except Exception as e:
        print(f"Error in update_habit: {e}")
        return JsonResponse({'error': str(e)}, status=400)


@login_required
def delete_habit(request, habit_id):
    """Удаление привычки"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        habit = Habit.objects.get(id=habit_id, user=request.user)
        habit.delete()
        return JsonResponse({'success': True})
    except Habit.DoesNotExist:
        return JsonResponse({'error': 'Habit not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
def update_habit_entry(request):
    """Обновление статуса привычки на конкретную дату"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
        print(f"Received data: {data}")

        habit = Habit.objects.get(id=data['habit_id'], user=request.user)

        entry, created = HabitEntry.objects.get_or_create(
            habit=habit,
            date=data['date'],
            defaults={'status': data['status']}
        )

        if not created:
            entry.status = data['status']
            entry.save()

        # ВОЗВРАЩАЕМ ДАТУ КАК СТРОКУ, БЕЗ isoformat()
        return JsonResponse({
            'habit_id': habit.id,
            'date': data['date'],  # Просто возвращаем ту же строку, что пришла
            'status': entry.status
        })
    except Habit.DoesNotExist:
        return JsonResponse({'error': 'Habit not found'}, status=404)
    except Exception as e:
        print(f"Error in update_habit_entry: {e}")
        return JsonResponse({'error': str(e)}, status=400)


from .models import WeeklyGoal


@login_required
def create_weekly_goal(request):
    """Создать новую цель на неделю"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)

        goal = WeeklyGoal.objects.create(
            user=request.user,
            text=data['text'],
            week_start=data['week_start'],
            is_completed=data.get('is_completed', False),
            is_carried_over=data.get('is_carried_over', False)
        )

        return JsonResponse({
            'id': goal.id,
            'text': goal.text,
            'is_completed': goal.is_completed,
            'is_carried_over': goal.is_carried_over
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
def update_weekly_goal(request, goal_id):
    """Обновить цель"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        goal = WeeklyGoal.objects.get(id=goal_id, user=request.user)
        data = json.loads(request.body)

        goal.text = data.get('text', goal.text)
        goal.is_completed = data.get('is_completed', goal.is_completed)
        goal.is_carried_over = data.get('is_carried_over', goal.is_carried_over)
        goal.save()

        return JsonResponse({
            'id': goal.id,
            'text': goal.text,
            'is_completed': goal.is_completed,
            'is_carried_over': goal.is_carried_over
        })

    except WeeklyGoal.DoesNotExist:
        return JsonResponse({'error': 'Goal not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
def delete_weekly_goal(request, goal_id):
    """Удалить цель"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        goal = WeeklyGoal.objects.get(id=goal_id, user=request.user)
        goal.delete()
        return JsonResponse({'success': True})

    except WeeklyGoal.DoesNotExist:
        return JsonResponse({'error': 'Goal not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

class GoalsView(LoginRequiredMixin, TemplateView):
    template_name = "journal/general_goals.html"


from .models import YearlyGoal, YearlyReport, MonthlyGoal, MonthlyReport
from datetime import date


@login_required
def goals_years_list(request):
    """Получить список всех годов, для которых есть данные"""
    years = set()
    for goal in YearlyGoal.objects.filter(user=request.user):
        years.add(goal.year)
    for report in YearlyReport.objects.filter(user=request.user):
        years.add(report.year)
    for goal in MonthlyGoal.objects.filter(user=request.user):
        years.add(goal.year)
    for report in MonthlyReport.objects.filter(user=request.user):
        years.add(report.year)

    years = sorted(list(years), reverse=True)
    return JsonResponse({'years': years})


@login_required
def goals_create_year(request):
    """Создать новый год (создаёт пустые структуры)"""
    data = json.loads(request.body)
    year = data.get('year')

    if not year:
        return JsonResponse({'error': 'Year required'}, status=400)

    # Проверяем, есть ли уже данные за этот год
    yearly_goals_exists = YearlyGoal.objects.filter(user=request.user, year=year).exists()
    yearly_report_exists = YearlyReport.objects.filter(user=request.user, year=year).exists()
    monthly_goals_exists = MonthlyGoal.objects.filter(user=request.user, year=year).exists()
    monthly_reports_exists = MonthlyReport.objects.filter(user=request.user, year=year).exists()

    if not yearly_goals_exists and not yearly_report_exists and not monthly_goals_exists and not monthly_reports_exists:
        # СОЗДАЁМ ХОТЯ БЫ ОДНУ ЗАПИСЬ, ЧТОБЫ ГОД ПОЯВИЛСЯ В СПИСКЕ
        YearlyReport.objects.create(
            user=request.user,
            year=year,
            text=""
        )

    return JsonResponse({'success': True})


@login_required
def goals_year_data(request, year):
    """Получить все данные за год: годовые цели, цели по месяцам, отчёты"""
    yearly_goals = YearlyGoal.objects.filter(user=request.user, year=year)
    yearly_report = YearlyReport.objects.filter(user=request.user, year=year).first()

    monthly_goals = {}
    for month in range(1, 13):
        goals = MonthlyGoal.objects.filter(user=request.user, year=year, month=month)
        monthly_goals[month] = [{
            'id': g.id,
            'text': g.text,
            'is_completed': g.is_completed,
            'carried_over': g.carried_over
        } for g in goals]

    monthly_reports = {}
    for month in range(1, 13):
        report = MonthlyReport.objects.filter(user=request.user, year=year, month=month).first()
        if report:
            monthly_reports[month] = {'id': report.id, 'text': report.text}

    return JsonResponse({
        'yearly_goals': [{
            'id': g.id,
            'text': g.text,
            'is_completed': g.is_completed
        } for g in yearly_goals],
        'yearly_report': {'id': yearly_report.id, 'text': yearly_report.text} if yearly_report else None,
        'monthly_goals': monthly_goals,
        'monthly_reports': monthly_reports
    })


@login_required
def goals_create_yearly_goal(request):
    data = json.loads(request.body)
    goal = YearlyGoal.objects.create(
        user=request.user,
        year=data['year'],
        text=data['text']
    )
    return JsonResponse({'id': goal.id, 'text': goal.text, 'is_completed': goal.is_completed})


@login_required
def goals_toggle_yearly_goal(request, goal_id):
    goal = YearlyGoal.objects.get(id=goal_id, user=request.user)
    goal.is_completed = not goal.is_completed
    goal.save()
    return JsonResponse({'success': True})


@login_required
def goals_update_yearly_goal(request, goal_id):
    data = json.loads(request.body)
    goal = YearlyGoal.objects.get(id=goal_id, user=request.user)
    goal.text = data['text']
    goal.save()
    return JsonResponse({'success': True})


@login_required
def goals_delete_yearly_goal(request, goal_id):
    goal = YearlyGoal.objects.get(id=goal_id, user=request.user)
    goal.delete()
    return JsonResponse({'success': True})


@login_required
def goals_carry_yearly_goal(request, goal_id):
    """Перенести годовую цель на следующий год"""
    goal = YearlyGoal.objects.get(id=goal_id, user=request.user)
    next_year = goal.year + 1

    # Создаём копию на следующий год
    YearlyGoal.objects.create(
        user=request.user,
        year=next_year,
        text=goal.text,
        is_completed=False
    )

    # Помечаем текущую как выполненную? или оставляем? оставляем как есть
    return JsonResponse({'success': True})


@login_required
def goals_create_monthly_goal(request):
    data = json.loads(request.body)
    goal = MonthlyGoal.objects.create(
        user=request.user,
        year=data['year'],
        month=data['month'],
        text=data['text']
    )
    return JsonResponse({'id': goal.id, 'text': goal.text, 'is_completed': goal.is_completed})


@login_required
def goals_toggle_monthly_goal(request, goal_id):
    goal = MonthlyGoal.objects.get(id=goal_id, user=request.user)
    goal.is_completed = not goal.is_completed
    goal.save()
    return JsonResponse({'success': True})


@login_required
def goals_update_monthly_goal(request, goal_id):
    data = json.loads(request.body)
    goal = MonthlyGoal.objects.get(id=goal_id, user=request.user)
    goal.text = data['text']
    goal.save()
    return JsonResponse({'success': True})


@login_required
def goals_delete_monthly_goal(request, goal_id):
    goal = MonthlyGoal.objects.get(id=goal_id, user=request.user)
    goal.delete()
    return JsonResponse({'success': True})


@login_required
def goals_carry_monthly_goal(request, goal_id):
    """Перенести цель на следующий месяц"""
    goal = MonthlyGoal.objects.get(id=goal_id, user=request.user)

    next_month = goal.month + 1
    next_year = goal.year
    if next_month > 12:
        next_month = 1
        next_year = goal.year + 1

    # Создаём копию на следующий месяц
    MonthlyGoal.objects.create(
        user=request.user,
        year=next_year,
        month=next_month,
        text=goal.text,
        is_completed=False,
        carried_over=True
    )

    # Помечаем текущую как перенесённую
    goal.carried_over = True
    goal.save()

    return JsonResponse({'success': True})


@login_required
def goals_update_yearly_report(request):
    data = json.loads(request.body)
    report, created = YearlyReport.objects.get_or_create(
        user=request.user,
        year=data['year'],
        defaults={'text': data['text']}
    )
    if not created:
        report.text = data['text']
        report.save()
    return JsonResponse({'success': True})


@login_required
def goals_update_monthly_report(request):
    data = json.loads(request.body)
    report, created = MonthlyReport.objects.get_or_create(
        user=request.user,
        year=data['year'],
        month=data['month'],
        defaults={'text': data['text']}
    )
    if not created:
        report.text = data['text']
        report.save()
    return JsonResponse({'success': True})