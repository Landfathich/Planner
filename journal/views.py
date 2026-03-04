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

        # Получаем или создаем профиль пользователя
        profile, created = UserProfile.objects.get_or_create(
            user=self.request.user,
            defaults={
                'start_week_date': start_date,
                'start_week_number': 1
            }
        )

        # Вычисляем номер текущей недели
        week_number = profile.get_current_week_number(start_date)

        context['week_start'] = start_date
        context['week_end'] = start_date + timedelta(days=6)
        context['today_date'] = today
        # TODO
        # context['week_number'] = week_number
        return context


@login_required
def week_tasks(request):
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

        tasks_data = []
        for task in tasks:
            tasks_data.append({
                'id': task.id,
                'title': task.title,
                'description': task.description or '',
                'is_done': task.is_done,
                'date': task.date.isoformat(),
                'is_weekly': task.is_weekly
            })

        # Получаем ВСЕ привычки пользователя
        all_habits = Habit.objects.filter(user=request.user)

        habits_data = []
        for habit in all_habits:
            # Проверяем, активна ли привычка для этой недели
            if not habit.is_active_for_week(start_date):
                continue  # Пропускаем неактивные привычки

            # Получаем записи для этой недели
            entries = HabitEntry.objects.filter(
                habit=habit,
                date__range=[start_date, end_date]
            )

            # Создаем словарь статусов по датам
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
                'entries': entries_dict  # {'2026-03-02': 'checked', ...}
            })

        print(f"Returning {len(tasks_data)} tasks and {len(habits_data)} active habits")

        return JsonResponse({
            'success': True,
            'week_start': start_date.isoformat(),
            'week_end': end_date.isoformat(),
            'week_number': week_number,
            'tasks': tasks_data,
            'habits': habits_data
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
            order=data.get('order', 0)
        )

        return JsonResponse({
            'id': habit.id,
            'name': habit.name,
            'description': habit.description,
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
        habit.save()

        return JsonResponse({
            'id': habit.id,
            'name': habit.name,
            'description': habit.description,
            'order': habit.order
        })
    except Habit.DoesNotExist:
        return JsonResponse({'error': 'Habit not found'}, status=404)
    except Exception as e:
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
