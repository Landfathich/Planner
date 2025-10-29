import json
import logging
from datetime import timedelta

from django.contrib.auth import login
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
from .models import Task

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

        days = []
        day_names = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

        for i in range(7):
            date = start_date + timedelta(days=i)
            day_tasks = Task.objects.filter(
                user=self.request.user,
                date=date,
                is_weekly=False
            )

            days.append({
                'date': date,
                'day_name': day_names[i],
                'today': date == today,
                'tasks': day_tasks,
                'earned_points': day_tasks.filter(is_done=True).count()
            })

        # Get weekly tasks for current week
        weekly_tasks = Task.objects.filter(
            user=self.request.user,
            is_weekly=True
        )

        context['days'] = days
        context['weekly_tasks'] = weekly_tasks
        context['week_start'] = start_date
        context['week_end'] = start_date + timedelta(days=6)
        context['week_number'] = start_date.isocalendar()[1]
        context['total_points'] = Task.objects.filter(
            user=self.request.user,
            date__range=[start_date, start_date + timedelta(days=6)],
            is_done=True
        ).count()
        context['today_date'] = today

        logger.debug(f"Context for week page:\n{context}")
        return context


@csrf_exempt
@require_POST
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
        task.save()

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
