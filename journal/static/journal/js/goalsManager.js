import {showNotification} from './utils.js';

export class GoalsManager {
    constructor(weekManager) {
        this.weekManager = weekManager;
        this.weeklyGoals = [];
        this.monthlyGoals = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Переключение колонок (если нужно)
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Кнопки добавления
        document.querySelectorAll('.add-goal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                this.openGoalModal(type);
            });
        });

        // Обработка кликов по целям (делегирование)
        document.addEventListener('click', async (e) => {
            const goalCard = e.target.closest('.goal-card');
            if (!goalCard) return;

            const goalId = goalCard.dataset.goalId;
            const goalType = goalCard.dataset.goalType; // 'weekly' или 'monthly'

            if (e.target.classList.contains('goal-complete')) {
                e.preventDefault();
                await this.toggleGoalComplete(goalId, goalType);
            } else if (e.target.classList.contains('goal-edit')) {
                e.preventDefault();
                this.openGoalModal(goalType, goalId);
            } else if (e.target.classList.contains('goal-carry')) {
                e.preventDefault();
                await this.carryOverGoal(goalId, goalType);
            } else if (e.target.classList.contains('goal-delete')) {
                e.preventDefault();
                this.deleteGoal(goalId, goalType);
            }
        });

        // Закрытие модалки
        const closeBtn = document.getElementById('close-goal-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('goal-modal').style.display = 'none';
            });
        }

        // Сабмит формы
        const goalForm = document.getElementById('goal-form');
        if (goalForm) {
            goalForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveGoal();
            });
        }

        // Удаление (в модалке)
        const deleteGoalBtn = document.getElementById('delete-goal-btn');
        if (deleteGoalBtn) {
            deleteGoalBtn.addEventListener('click', () => {
                if (this.currentEditId) {
                    this.deleteGoal(this.currentEditId, 'weekly');
                    document.getElementById('goal-modal').style.display = 'none';
                }
            });
        }

        // Закрытие по клику вне модалки
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('goal-modal');
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tab}-goals-tab`);
        });
    }

    async saveGoal() {
        const goalId = document.getElementById('goal-id').value;
        const isEditing = !!goalId;

        const weekStartInput = document.getElementById('goal-week-start');
        const textInput = document.getElementById('goal-text');

        if (!weekStartInput || !textInput) {
            console.error('Missing form elements');
            showNotification('Ошибка формы', 'error');
            return;
        }

        const goalData = {
            text: textInput.value,
            week_start: weekStartInput.value
        };

        if (!goalData.text.trim()) {
            showNotification('Введите текст цели', 'error');
            return;
        }

        const url = isEditing ? `/api/weekly-goals/${goalId}/update/` : '/api/weekly-goals/create/';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify(goalData)
            });

            if (response.ok) {
                document.getElementById('goal-modal').style.display = 'none';
                await this.loadGoals();
                showNotification(isEditing ? 'Цель обновлена' : 'Цель создана', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save goal');
            }
        } catch (error) {
            console.error('Error saving goal:', error);
            showNotification('Ошибка при сохранении', 'error');
        }
    }

    async loadGoals(weekStart) {
        try {
            const response = await fetch(`/api/week-data/?week_offset=${this.weekManager.currentWeekOffset}`);
            if (response.ok) {
                const data = await response.json();
                this.weeklyGoals = data.weekly_goals || [];
                // TODO: Загрузить monthly_goals когда будут готовы
                this.renderWeeklyGoals();
            }
        } catch (error) {
            console.error('Error loading goals:', error);
        }
    }

    renderWeeklyGoals() {
        const container = document.getElementById('weekly-goals-list');
        if (!container) return;

        container.innerHTML = '';

        if (this.weeklyGoals.length === 0) {
            container.innerHTML = '<div class="goal-item placeholder"><span class="goal-text">Нет целей на эту неделю</span></div>';
            return;
        }

        this.weeklyGoals.forEach(goal => {
            const goalElement = this.createGoalElement(goal, 'weekly');
            container.appendChild(goalElement);
        });
    }

    createGoalElement(goal, type) {
        const div = document.createElement('div');
        div.className = `goal-card ${goal.is_completed ? 'completed' : ''} ${goal.is_carried_over ? 'carried' : ''}`;
        div.dataset.goalId = goal.id;
        div.dataset.goalType = type;

        div.innerHTML = `
        <div class="goal-header">
            <span class="goal-text">${goal.text}</span>
            <div class="goal-actions">
                <button class="goal-complete" title="${goal.is_completed ? 'Отменить' : 'Выполнить'}">✓</button>
                <button class="goal-edit" title="Редактировать">✎</button>
                <button class="goal-carry" title="Перенести на след. неделю">→</button>
                <button class="goal-delete" title="Удалить">×</button>
            </div>
        </div>
        ${goal.is_carried_over ? `
            <div class="goal-meta">
                <span class="carry-badge">перенесена</span>
            </div>
        ` : ''}
    `;

        return div;
    }

    async toggleGoalComplete(goalId, type) {
        try {
            const goal = this.weeklyGoals.find(g => g.id == goalId);
            if (!goal) return;

            const response = await fetch(`/api/weekly-goals/${goalId}/update/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    text: goal.text,
                    is_completed: !goal.is_completed,
                    is_carried_over: goal.is_carried_over
                })
            });

            if (response.ok) {
                goal.is_completed = !goal.is_completed;
                this.renderWeeklyGoals();
                showNotification(goal.is_completed ? 'Цель выполнена!' : 'Статус обновлён', 'success');
            } else {
                throw new Error('Failed to update');
            }
        } catch (error) {
            console.error('Error toggling goal:', error);
            showNotification('Ошибка при обновлении', 'error');
        }
    }

    async carryOverGoal(goalId, type) {
        try {
            const goal = this.weeklyGoals.find(g => g.id == goalId);
            if (!goal) return;

            // Создаём копию цели на следующую неделю
            const currentWeekDates = this.weekManager.getCurrentWeekDates();
            const nextWeekStart = new Date(currentWeekDates[0]);
            nextWeekStart.setDate(nextWeekStart.getDate() + 7);
            const nextWeekStr = nextWeekStart.toISOString().split('T')[0];

            const createResponse = await fetch('/api/weekly-goals/create/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    text: goal.text,
                    week_start: nextWeekStr,
                    is_carried_over: true
                })
            });

            if (createResponse.ok) {
                // Помечаем текущую как перенесённую
                await fetch(`/api/weekly-goals/${goalId}/update/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCSRFToken()
                    },
                    body: JSON.stringify({
                        text: goal.text,
                        is_completed: goal.is_completed,
                        is_carried_over: true
                    })
                });

                await this.loadGoals();
                showNotification('Цель перенесена на следующую неделю', 'success');
            } else {
                throw new Error('Failed to carry over');
            }
        } catch (error) {
            console.error('Error carrying over goal:', error);
            showNotification('Ошибка при переносе', 'error');
        }
    }

    deleteGoal(goalId, type) {
        if (!confirm('Удалить эту цель?')) return;

        fetch(`/api/weekly-goals/${goalId}/delete/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': this.getCSRFToken()
            }
        })
            .then(async response => {
                if (response.ok) {
                    this.weeklyGoals = this.weeklyGoals.filter(g => g.id != goalId);
                    this.renderWeeklyGoals();
                    showNotification('Цель удалена', 'success');
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Delete failed');
                }
            })
            .catch(error => {
                console.error('Error deleting goal:', error);
                showNotification('Ошибка при удалении', 'error');
            });
    }

    async loadMonthlyGoalsForWeek(weekDates) {
        // Определяем месяц по середине недели (четверг)
        const midWeek = weekDates[3];
        const year = midWeek.getFullYear();
        const month = midWeek.getMonth() + 1;

        try {
            const response = await fetch(`/api/goals/monthly/preview/?year=${year}&month=${month}`);
            if (response.ok) {
                const data = await response.json();
                this.renderMonthlyGoalsPreview(data.goals);
            }
        } catch (error) {
            console.error('Error loading monthly goals:', error);
        }
    }

    renderMonthlyGoalsPreview(goals) {
        const container = document.getElementById('monthly-goals-list');
        if (!container) return;

        container.innerHTML = '';

        if (goals.length === 0) {
            container.innerHTML = '<div class="goal-card placeholder">Нет целей на этот месяц</div>';
            return;
        }

        goals.forEach(goal => {
            const goalCard = document.createElement('div');
            goalCard.className = `goal-card ${goal.is_completed ? 'completed' : ''}`;
            goalCard.innerHTML = `<span class="goal-text">${goal.text}</span>`;
            container.appendChild(goalCard);
        });
    }

    openGoalModal(type, goalId = null) {
        const modal = document.getElementById('goal-modal');
        const modalTitle = document.getElementById('goal-modal-title');
        const deleteBtn = document.getElementById('delete-goal-btn');
        const form = document.getElementById('goal-form');

        if (!modal || !modalTitle || !deleteBtn || !form) {
            console.error('Modal elements not found');
            return;
        }

        // Получаем понедельник текущей недели
        const currentWeekDates = this.weekManager.getCurrentWeekDates();
        if (!currentWeekDates || currentWeekDates.length === 0) {
            console.error('No week dates found');
            return;
        }

        const weekStart = currentWeekDates[0].toISOString().split('T')[0];

        // Сбрасываем форму
        form.reset();
        document.getElementById('goal-id').value = '';
        document.getElementById('goal-week-start').value = weekStart;
        document.getElementById('goal-text').value = '';

        if (goalId) {
            // Редактирование
            const goal = this.weeklyGoals.find(g => g.id == goalId);
            if (goal) {
                modalTitle.textContent = 'Редактировать цель';
                deleteBtn.style.display = 'block';

                document.getElementById('goal-id').value = goal.id;
                document.getElementById('goal-text').value = goal.text;

                this.currentEditId = goalId;
            } else {
                console.error('Goal not found:', goalId);
                return;
            }
        } else {
            // Создание
            modalTitle.textContent = type === 'weekly' ? 'Добавить цель на неделю' : 'Добавить цель на месяц';
            deleteBtn.style.display = 'none';
            this.currentEditId = null;
        }

        modal.style.display = 'flex';
    }

    updateForWeek(weekDates) {
        // Загружаем недельные цели
        this.loadGoals();
        // Загружаем месячные цели для этой недели
        this.loadMonthlyGoalsForWeek(weekDates);
    }

    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }
}