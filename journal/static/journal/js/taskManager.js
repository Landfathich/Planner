import {showNotification} from "./utils.js";

export class TaskManager {
    constructor(weekManager) {
        this.weekManager = weekManager;
        this.allTasks = this.extractTasksFromDOM();
        this.setupModalListeners();
        this.setupTaskListeners();

        console.log("daily task manager initialized")
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
            const taskElement = e.target.closest('.general-task');
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

        try {
            const updatedTask = await this.sendTaskUpdate(taskData);
            this.updateTaskInDOM(updatedTask);
            this.closeModalAndUpdateStats('task-detail-modal');
            showNotification('Задача обновлена!', 'success');
        } catch (error) {
            this.handleError('Error updating task:', error, 'Ошибка обновления задачи');
        }
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
            this.allTasks = this.allTasks.filter(t => t.id !== taskId);
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

    extractTasksFromDOM() {
        return Array.from(document.querySelectorAll('.general-task')).map(taskElement => {
            const dateStr = taskElement.closest('.day-card')?.querySelector('.add-day-task-btn')?.dataset.date;
            return dateStr ? {
                id: taskElement.dataset.taskId,
                date: new Date(dateStr),
                element: taskElement,
                dayCard: taskElement.closest('.day-card')
            } : null;
        }).filter(Boolean);
    }

    displayTasksForWeek(tasks, weekDates) {
        this.allTasks = [];
        document.querySelectorAll('.general-task').forEach(task => task.remove());

        tasks.forEach(task => this.addTaskToDOM(task));
        this.updateStatistics();
    }

    addTaskToDOM(task) {
        const taskElement = this.createTaskElement(task);
        const dayCard = this.findDayCardByDate(task.date);

        if (dayCard) {
            dayCard.querySelector('.task-list').appendChild(taskElement);
            this.allTasks.push({
                id: task.id,
                date: new Date(task.date),
                element: taskElement
            });
        }
    }

    createTaskElement(task) {
        const li = document.createElement('li');
        li.className = `task general-task ${task.is_done ? 'done' : ''}`;
        li.dataset.taskId = task.id;
        li.innerHTML = `
            <div class="task-main general-task-main">
                <span class="task-title general-task-title">${task.title}</span>
                <div class="task-actions general-task-actions">
                    <button class="task-toggle task-toggle-btn">✓</button>
                    <button class="task-edit task-edit-btn">✎</button>
                    <button class="task-delete task-delete-btn">×</button>
                </div>
            </div>
            ${task.description ? `<div class="task-description general-task-description">${task.description}</div>` : ''}
        `;
        return li;
    }

    findDayCardByDate(dateString) {
        return document.querySelector(`.add-day-task-btn[data-date="${dateString}"]`)?.closest('.day-card');
    }

    updateDayStats(weekDates) {
        const dateStrings = weekDates.map(date => date.toISOString().split('T')[0]);

        dateStrings.forEach((dateStr, index) => {
            const dayCard = document.querySelectorAll('.day-card')[index];
            if (!dayCard) return;

            const taskList = dayCard.querySelector('.task-list');
            const tasks = taskList?.querySelectorAll('.general-task') || [];
            const doneTasks = taskList?.querySelectorAll('.task.done') || [];
            const pointsElement = dayCard.querySelector('.points');

            if (pointsElement) {
                pointsElement.textContent = tasks.length > 0
                    ? `${doneTasks.length} / ${tasks.length} задач`
                    : `Задач нет`;
            }
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
        const closeBtn = document.querySelector('.close');
        const form = document.getElementById('task-form');

        document.querySelectorAll('.add-day-task-btn, .add-week-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.getElementById('task-date').value = e.target.dataset.date;
                document.getElementById('task-type').value = e.target.dataset.taskType;
                modal.style.display = 'flex';
            });
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

        const taskData = {
            title: formData.get('title'),
            description: formData.get('description'),
            date: formData.get('date'),
            is_done: false,
            is_weekly: formData.get('type') === "week"
        };
        console.log(taskData)

        try {
            const result = await this.sendCreateTask(taskData);
            this.updateTasksForDate(result.tasks, taskData.date);
            this.filterTasksForWeek(this.weekManager.getCurrentWeekDates());
            document.getElementById('task-modal').style.display = 'none';
            document.getElementById('task-form').reset();
            showNotification('Задача успешно создана!', 'success');
        } catch (error) {
            this.handleError('Error creating task:', error, 'Ошибка создания задачи');
        }
    }

    async sendCreateTask(taskData) {
        const response = await fetch('/api/tasks/create/', {
            method: 'POST',
            headers: this.getRequestHeaders(),
            body: JSON.stringify(taskData)
        });
        if (!response.ok) throw new Error('Create failed');
        return await response.json();
    }

    updateTasksForDate(tasks, dateString) {
        const dayCard = this.findDayCardByDate(dateString);
        if (!dayCard) return;

        const taskList = dayCard.querySelector('.task-list');
        taskList.innerHTML = '';
        tasks.forEach(task => taskList.appendChild(this.createTaskElement(task)));
        this.allTasks = this.extractTasksFromDOM();
    }

    filterTasksForWeek(weekDates) {
        const dateStrings = weekDates.map(date => date.toISOString().split('T')[0]);

        this.allTasks.forEach(task => {
            const taskDateStr = task.date.toISOString().split('T')[0];
            task.element.style.display = dateStrings.includes(taskDateStr) ? 'block' : 'none';
        });

        this.updateDayStats(weekDates);
    }
}