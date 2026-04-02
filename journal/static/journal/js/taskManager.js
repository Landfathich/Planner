import {showNotification} from "./utils.js";

export class TaskManager {
    constructor(weekManager) {
        this.weekManager = weekManager;
        this.draggedTask = null;
        this.setupModalListeners();
        this.setupTaskListeners();
        this.setupDragAndDrop();
    }

    updateDayProgress(dayCard, tasks, doneTasks) {
        const total = tasks.length;
        const done = doneTasks.length;
        const percent = total === 0 ? 0 : Math.round((done / total) * 100);

        const progressFill = dayCard.querySelector('.progress-fill');
        const progressPercent = dayCard.querySelector('.progress-percent');

        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
        if (progressPercent) {
            progressPercent.textContent = `${percent}%`;
        }
    }

    setupDragAndDrop() {
        // Обработчик начала перетаскивания (делегирование, т.к. задачи динамические)
        document.addEventListener('dragstart', (e) => {
            const taskElement = e.target.closest('.task');
            if (!taskElement) return;

            this.draggedTask = taskElement;
            taskElement.classList.add('dragging');
            e.dataTransfer.setData('text/plain', taskElement.dataset.taskId);
            e.dataTransfer.effectAllowed = 'move';
        });

        document.addEventListener('dragend', (e) => {
            const taskElement = e.target.closest('.task');
            if (taskElement) {
                taskElement.classList.remove('dragging');
            }
            this.draggedTask = null;
        });

        // Разрешаем сброс на целевых зонах
        const dropZones = document.querySelectorAll('.day-card, .weekly-tasks-section');
        dropZones.forEach(zone => {
            zone.addEventListener('dragover', (e) => e.preventDefault());
            zone.addEventListener('drop', (e) => this.handleDrop(e, zone));
        });

        // Также добавим обработчики на динамически добавляемые зоны через делегирование
        document.addEventListener('dragover', (e) => {
            if (e.target.closest('.day-card') || e.target.closest('.weekly-tasks-section')) {
                e.preventDefault();
            }
        });

        document.addEventListener('drop', (e) => {
            const zone = e.target.closest('.day-card') || e.target.closest('.weekly-tasks-section');
            if (zone) {
                e.preventDefault();
                this.handleDrop(e, zone);
            }
        });
    }

    handleDrop(e, zone) {
        e.preventDefault();
        if (!this.draggedTask) return;

        const taskId = this.draggedTask.dataset.taskId;
        const isWeeklyZone = zone.classList.contains('weekly-tasks-section');

        // Определяем новую дату и тип задачи
        let newDate, newIsWeekly;

        if (isWeeklyZone) {
            // Сброс в блок недельных задач: задача становится недельной, дата = понедельник текущей недели
            const monday = this.weekManager.getCurrentWeekDates()[0];
            newDate = monday.toISOString().split('T')[0];
            newIsWeekly = true;
        } else {
            // Сброс на день: задача становится дневной, дата = дата дня
            const dayCard = zone.closest('.day-card');
            const dateButton = dayCard.querySelector('.add-task-btn');
            if (!dateButton) return;
            newDate = dateButton.dataset.date;
            newIsWeekly = false;
        }

        // Вызываем обновление задачи (переиспользуем sendTaskUpdate)
        this.moveTask(taskId, newDate, newIsWeekly);
    }

    async moveTask(taskId, newDate, newIsWeekly) {
        // Получаем текущее состояние задачи из DOM для старой позиции
        const oldState = this.getTaskOldState(taskId);

        // Формируем данные для обновления (берём текущие title, description, is_done)
        const taskElement = document.querySelector(`.task[data-task-id="${taskId}"]`);
        const title = taskElement?.querySelector('.task-title')?.textContent || '';
        const description = taskElement?.querySelector('.task-description')?.textContent || '';
        const isDone = taskElement?.classList.contains('done') || false;

        const taskData = {
            id: taskId,
            title: title,
            description: description,
            date: newDate,
            is_done: isDone,
            is_weekly: newIsWeekly
        };

        try {
            const updatedTask = await this.sendTaskUpdate(taskData);

            // Проверяем, изменилась ли позиция (используем ту же логику, что в updateTask)
            if (this.hasPositionChanged(oldState, updatedTask)) {
                await this.refreshWeekDisplay();
            } else {
                // Теоретически такого не должно быть при перетаскивании, но на всякий случай
                this.updateTaskInDOM(updatedTask);
            }

            showNotification('Задача перемещена!', 'success');
        } catch (error) {
            this.handleError('Error moving task:', error, 'Ошибка перемещения задачи');
        }
    }

    setupTaskListeners() {
        this.setupModalEventListeners();
        this.setupTaskClickHandlers();
    }

    setupModalEventListeners() {
        const closeModal = (modalId) => document.getElementById(modalId).style.display = 'none';
        const openModal = (modalId) => document.getElementById(modalId).style.display = 'flex';

        window.addEventListener('click', (e) => {
            if (e.target.id === 'task-detail-modal') closeModal('task-detail-modal');
            if (e.target.id === 'confirm-modal') closeModal('confirm-modal');
        });

        document.getElementById('close-task-modal').addEventListener('click', () => closeModal('task-detail-modal'));
        document.getElementById('task-edit-form').addEventListener('submit', (e) => this.handleFormSubmit(e));
        document.getElementById('delete-task-btn').addEventListener('click', () => openModal('confirm-modal'));
        document.getElementById('cancel-delete').addEventListener('click', () => closeModal('confirm-modal'));
        document.getElementById('confirm-delete').addEventListener('click', () => this.deleteTask());
    }

    setupTaskClickHandlers() {
        document.addEventListener('click', (e) => {
            const taskElement = e.target.closest('.task');
            if (!taskElement) return;

            const taskId = taskElement.dataset.taskId;
            const targetClass = e.target.classList;

            if (targetClass.contains('task-toggle')) {
                e.stopPropagation();
                this.toggleTaskDone(taskId);
            } else if (targetClass.contains('task-edit')) {
                e.stopPropagation();
                this.openTaskModal(taskId);
            } else if (targetClass.contains('task-delete')) {
                e.stopPropagation();
                this.prepareDeleteTask(taskId);
            } else {
                this.openTaskModal(taskId);
            }
        });
    }

    async openTaskModal(taskId) {
        try {
            const task = await this.fetchTask(taskId);
            this.populateTaskForm(task);
            document.getElementById('task-detail-modal').style.display = 'flex';
        } catch (error) {
            this.handleError('Error loading task:', error, 'Ошибка загрузки задачи');
        }
    }

    async fetchTask(taskId) {
        const response = await fetch(`/api/tasks/${taskId}/`);
        if (!response.ok) throw new Error('Task not found');
        return await response.json();
    }

    populateTaskForm(task) {
        document.getElementById('edit-task-id').value = task.id;
        document.getElementById('edit-task-date').value = task.date;
        document.getElementById('edit-task-title').value = task.title;
        document.getElementById('edit-task-description').value = task.description || '';
        document.getElementById('edit-task-done').checked = task.is_done;
    }

    handleFormSubmit(e) {
        e.preventDefault();
        this.updateTask();
    }

    async updateTask() {
        const taskData = this.getFormData();
        const oldState = this.getTaskOldState(taskData.id);

        try {
            const updatedTask = await this.sendTaskUpdate(taskData);

            if (this.hasPositionChanged(oldState, updatedTask)) {
                await this.refreshWeekDisplay();
            } else {
                this.updateTaskInDOM(updatedTask);
            }

            this.closeModalAndUpdateStats('task-detail-modal');
            showNotification('Задача обновлена!', 'success');
        } catch (error) {
            this.handleError('Error updating task:', error, 'Ошибка обновления задачи');
        }
    }

    getTaskOldState(taskId) {
        const element = document.querySelector(`.task[data-task-id="${taskId}"]`);
        if (!element) return null;

        return {
            date: element.closest('.day-card')?.querySelector('.add-task-btn')?.dataset.date,
            isWeekly: element.classList.contains('weekly-task')
        };
    }

    hasPositionChanged(oldState, updatedTask) {
        if (!oldState) return true;

        const dateChanged = oldState.date && oldState.date !== updatedTask.date;
        const typeChanged = oldState.isWeekly !== updatedTask.is_weekly;

        return dateChanged || typeChanged;
    }

    async refreshWeekDisplay() {
        const tasks = await this.weekManager.loadWeekTasks(this.weekManager.currentWeekOffset);
        this.displayTasksForWeek(tasks, this.weekManager.getCurrentWeekDates());
    }

    getFormData() {
        const formData = new FormData(document.getElementById('task-edit-form'));
        return {
            id: formData.get('id'),
            title: formData.get('title'),
            description: formData.get('description'),
            date: formData.get('date'),
            is_done: formData.get('is_done') === 'on'
        };
    }

    async sendTaskUpdate(taskData) {
        const response = await fetch(`/api/tasks/${taskData.id}/update/`, {
            method: 'POST',
            headers: this.getRequestHeaders(),
            body: JSON.stringify(taskData)
        });
        if (!response.ok) throw new Error('Update failed');
        return await response.json();
    }

    prepareDeleteTask(taskId) {
        this.taskToDelete = taskId;
        document.getElementById('confirm-modal').style.display = 'flex';
    }

    async deleteTask() {
        if (!this.taskToDelete) return;

        try {
            await this.sendDeleteRequest(this.taskToDelete);
            this.removeTaskFromDOM(this.taskToDelete);
            this.closeModalAndUpdateStats('confirm-modal');
            showNotification('Задача удалена!', 'success');
            this.taskToDelete = null;
        } catch (error) {
            this.handleError('Error deleting task:', error, 'Ошибка удаления задачи');
        }
    }

    async sendDeleteRequest(taskId) {
        const response = await fetch(`/api/tasks/${taskId}/delete/`, {
            method: 'POST',
            headers: {'X-CSRFToken': this.getCSRFToken()}
        });
        if (!response.ok) throw new Error('Delete failed');
    }

    closeModalAndUpdateStats(modalId) {
        document.getElementById(modalId).style.display = 'none';
        document.getElementById('task-detail-modal').style.display = 'none';
        this.updateStatistics();
    }

    updateStatistics() {
        const currentWeekDates = this.weekManager.getCurrentWeekDates();
        this.updateDayStats(currentWeekDates);
        this.updateWeekStats();
    }

    async toggleTaskDone(taskId) {
        try {
            const task = await this.fetchTask(taskId);
            const updatedTask = await this.sendTaskUpdate({...task, is_done: !task.is_done});
            this.updateTaskInDOM(updatedTask);
            this.updateStatistics();
            showNotification('Задача обновлена!', 'success');
        } catch (error) {
            this.handleError('Error toggling task:', error, 'Ошибка обновления задачи');
        }
    }

    updateTaskInDOM(task) {
        const taskElement = document.querySelector(`.task[data-task-id="${task.id}"]`);
        if (!taskElement) return;

        taskElement.querySelector('.task-title').textContent = task.title;
        taskElement.classList.toggle('done', task.is_done);
        this.updateTaskDescription(taskElement, task.description);
    }

    updateTaskDescription(taskElement, description) {
        let descriptionEl = taskElement.querySelector('.task-description');

        if (description) {
            if (!descriptionEl) {
                descriptionEl = document.createElement('div');
                descriptionEl.className = 'task-description';
                taskElement.appendChild(descriptionEl);
            }
            descriptionEl.textContent = description;
        } else if (descriptionEl) {
            descriptionEl.remove();
        }
    }

    removeTaskFromDOM(taskId) {
        const taskElement = document.querySelector(`.task[data-task-id="${taskId}"]`);
        if (taskElement) {
            taskElement.remove();
            this.checkAndUpdateWeeklyTasksList();
        }
    }

    checkAndUpdateWeeklyTasksList() {
        const weeklyTaskList = document.querySelector('.weekly-task-list');
        if (!weeklyTaskList) return;

        const weeklyTasksInDOM = weeklyTaskList.querySelectorAll('.weekly-task');

        if (weeklyTasksInDOM.length === 0) {
            const noTasksElement = document.createElement('li');
            noTasksElement.className = 'no-tasks';
            noTasksElement.textContent = 'Нет задач на неделю';
            weeklyTaskList.appendChild(noTasksElement);
        } else {
            const noTasksElement = weeklyTaskList.querySelector('.no-tasks');
            if (noTasksElement) {
                noTasksElement.remove();
            }
        }
    }

    getRequestHeaders() {
        return {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCSRFToken()
        };
    }

    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }

    handleError(consoleMsg, error, userMsg) {
        console.error(consoleMsg, error);
        showNotification(userMsg, 'error');
    }

    displayTasksForWeek(tasks, weekDates) {
        // Очищаем все задачи
        document.querySelectorAll('.task-list').forEach(list => list.innerHTML = '');
        const weeklyTaskList = document.querySelector('.weekly-task-list');
        if (weeklyTaskList) {
            weeklyTaskList.innerHTML = '';
        }

        // ВАЖНО: Создаем карту дат для быстрого поиска
        this.createDateMap(weekDates);

        // Разделяем задачи на дневные и недельные
        const dailyTasks = tasks.filter(task => !task.is_weekly);
        const weeklyTasks = tasks.filter(task => task.is_weekly);

        // Отрисовываем дневные задачи по дням
        dailyTasks.forEach(task => {
            this.addTaskToDOM(task);
        });

        // Отрисовываем недельные задачи
        if (weeklyTasks.length === 0) {
            const noTasksElement = document.createElement('li');
            noTasksElement.className = 'no-tasks';
            noTasksElement.textContent = 'Нет задач на неделю';
            if (weeklyTaskList) {
                weeklyTaskList.appendChild(noTasksElement);
            }
        } else {
            weeklyTasks.forEach(task => {
                this.addWeeklyTaskToDOM(task);
            });
        }

        this.updateStatistics();
    }

// Добавляем новый метод
    createDateMap(weekDates) {
        this.dateMap = {};
        weekDates.forEach(date => {
            const dateStr = date.toISOString().split('T')[0];
            this.dateMap[dateStr] = date;
        });
    }

// Исправляем findDayCardByDate
    findDayCardByDate(dateString) {
        if (!dateString) {
            console.warn('Empty dateString provided');
            return null;
        }

        // Проверяем сначала в dateMap
        if (this.dateMap && this.dateMap[dateString]) {
            return document.querySelector(`.add-task-btn[data-date="${dateString}"]`)?.closest('.day-card');
        }

        return null;
    }

    addWeeklyTaskToDOM(task) {
        const taskElement = this.createTaskElement(task);
        const weeklyTaskList = document.querySelector('.weekly-task-list');

        if (weeklyTaskList) {
            // Удаляем сообщение "нет задач", если оно есть
            const noTasksElement = weeklyTaskList.querySelector('.no-tasks');
            if (noTasksElement) {
                noTasksElement.remove();
            }
            weeklyTaskList.appendChild(taskElement);
        }
    }

    addTaskToDOM(task) {
        const taskElement = this.createTaskElement(task);
        const dayCard = this.findDayCardByDate(task.date);

        if (dayCard) {
            dayCard.querySelector('.task-list').appendChild(taskElement);
        }
    }

    createTaskElement(task) {
        const li = document.createElement('li');
        li.className = `task ${task.is_weekly ? 'weekly-task' : 'day-task'} ${task.is_done ? 'done' : ''}`;
        li.dataset.taskId = task.id;
        li.draggable = true;
        li.innerHTML = `
            <div class="task-main">
                <span class="task-title">${task.title}</span>
                <div class="task-actions">
                    <button class="task-toggle">✓</button>
                    <button class="task-edit">✎</button>
                    <button class="task-delete">×</button>
                </div>
            </div>
            ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
        `;
        return li;
    }

    updateDayStats(weekDates) {
        const dateStrings = weekDates.map(date => date.toISOString().split('T')[0]);

        dateStrings.forEach((dateStr, index) => {
            const dayCard = document.querySelectorAll('.day-card')[index];
            if (!dayCard) return;

            const taskList = dayCard.querySelector('.task-list');
            const tasks = taskList?.querySelectorAll('.task') || [];
            const doneTasks = taskList?.querySelectorAll('.task.done') || [];
            const pointsElement = dayCard.querySelector('.points');

            if (pointsElement) {
                pointsElement.textContent = `${doneTasks.length} / ${tasks.length} задач`;
            }

            // Обновляем прогресс-бар
            this.updateDayProgress(dayCard, tasks, doneTasks);
        });
    }

    updateWeekStats() {
        const weekStatsElement = document.querySelector('.week-stats .points');
        if (weekStatsElement) {
            const doneTasksCount = document.querySelectorAll('.task.done').length;
            weekStatsElement.textContent = `${doneTasksCount} баллов`;
        }
    }

    setupModalListeners() {
        const modal = document.getElementById('task-modal');
        const closeBtn = modal.querySelector('.close');
        const form = document.getElementById('task-form');
        const modalTitle = document.getElementById('task-modal-title');

        // Обработчики для кнопок добавления задач
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-task-btn')) {
                const taskDate = e.target.dataset.date;
                const taskType = e.target.dataset.taskType;

                // Устанавливаем дату и тип
                document.getElementById('task-date').value = taskDate;
                document.getElementById('task-type').value = taskType;

                // Меняем заголовок в зависимости от типа задачи
                if (taskType === 'week') {
                    modalTitle.textContent = 'Создание недельной задачи';
                } else {
                    const date = new Date(taskDate);
                    const dayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
                    const dayName = dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1];
                    modalTitle.textContent = `Создание задачи на ${dayName}`;
                }

                modal.style.display = 'flex';
            }
        });

        closeBtn.addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createTask();
        });
    }

    async createTask() {
        const formData = new FormData(document.getElementById('task-form'));
        const isWeekly = formData.get('type') === "week";

        const taskData = {
            title: formData.get('title'),
            description: formData.get('description'),
            date: formData.get('date'),
            is_done: false,
            is_weekly: isWeekly
        };

        try {
            const response = await fetch('/api/tasks/create/', {
                method: 'POST',
                headers: this.getRequestHeaders(),
                body: JSON.stringify(taskData)
            });

            if (!response.ok) throw new Error('Create failed');

            const result = await response.json();
            console.log('Create response:', result);

            // РАЗБИРАЕМ ОТВЕТ БЕКЕНДА ПРАВИЛЬНО
            const createdTask = {
                id: result.new_task_id,
                title: taskData.title,
                description: taskData.description,
                date: taskData.date,
                is_done: false,
                is_weekly: isWeekly
            };

            if (isWeekly) {
                this.addWeeklyTaskToDOM(createdTask);
            } else {
                this.addTaskToDOM(createdTask);
            }

            this.updateStatistics();
            document.getElementById('task-modal').style.display = 'none';
            document.getElementById('task-form').reset();
            showNotification('Задача успешно создана!', 'success');

        } catch (error) {
            this.handleError('Error creating task:', error, 'Ошибка создания задачи');
        }
    }
}