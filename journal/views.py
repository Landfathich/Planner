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

        context['week_start'] = start_date
        context['week_end'] = start_date + timedelta(days=6)
        context['today_date'] = today
        # TODO
        context['week_number'] = 1
        return context


@login_required
def week_tasks(request):
    try:
        week_offset = int(request.GET.get('week_offset', 0))

        today = timezone.now().date()
        start_date = today - timedelta(days=today.weekday()) + timedelta(weeks=week_offset)
        end_date = start_date + timedelta(days=6)

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

        return JsonResponse({
            'success': True,
            'week_start': start_date.isoformat(),
            'week_end': end_date.isoformat(),
            'tasks': tasks_data
        })

    except Exception as e:
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
