export class HabitTracker {
    constructor(weekManager) {
        this.weekManager = weekManager;
        this.habits = [];
        this.currentHabitId = null;
        this.setupHabitCheckboxes();
        this.setupHabitModalListeners();
    }

    // Загружаем и отображаем привычки
    async loadAndDisplayHabits() {
        try {
            const response = await fetch(`/api/tasks/week/?week_offset=${this.weekManager.currentWeekOffset}`);
            if (response.ok) {
                const data = await response.json();
                this.habits = data.habits || [];
                this.renderHabits(data.habits, this.weekManager.getCurrentWeekDates());
            }
        } catch (error) {
            console.error('Error loading habits:', error);
        }
    }

    // Отрисовка привычек
    renderHabits(habits, weekDates) {
        const habitsList = document.querySelector('.habits-list');
        if (!habitsList) return;

        habitsList.innerHTML = '';

        if (habits.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'no-habits';
            emptyMessage.textContent = 'Нет привычек. Добавьте первую!';
            habitsList.appendChild(emptyMessage);
            return;
        }

        // Сортируем по order
        const sortedHabits = habits.sort((a, b) => a.order - b.order);

        sortedHabits.forEach(habit => {
            const habitRow = this.createHabitRow(habit, weekDates);
            habitsList.appendChild(habitRow);
        });
    }

    // Создание строки привычки
    createHabitRow(habit, weekDates) {
        const row = document.createElement('div');
        row.className = 'habit-row';
        row.dataset.habitId = habit.id;

        // Название привычки
        const nameCol = document.createElement('div');
        nameCol.className = 'habit-name-col';
        nameCol.innerHTML = `<span class="habit-name">${habit.name}</span>`;
        row.appendChild(nameCol);

        // Дни недели с чекбоксами
        const daysCol = document.createElement('div');
        daysCol.className = 'habit-days';

        weekDates.forEach(date => {
            const dateStr = date.toISOString().split('T')[0];
            const status = habit.entries?.[dateStr] || 'empty';

            const dayCell = document.createElement('div');
            dayCell.className = 'habit-day-check';
            dayCell.innerHTML = `<div class="habit-checkbox" data-state="${status}" data-date="${dateStr}"></div>`;
            daysCol.appendChild(dayCell);
        });

        row.appendChild(daysCol);

        // Кнопки действий
        const actionsCol = document.createElement('div');
        actionsCol.className = 'habit-actions-col';

        // Проверяем, завершена ли привычка
        const isCompleted = habit.end_date && new Date(habit.end_date) <= new Date();

        actionsCol.innerHTML = `
        <button class="habit-edit" title="Редактировать">✎</button>
        ${!isCompleted ? '<button class="habit-complete" title="Завершить привычку">✓</button>' : ''}
        <button class="habit-delete" title="Удалить">×</button>
    `;

        row.appendChild(actionsCol);

        return row;
    }

    setupHabitCheckboxes() {
        document.addEventListener('click', (e) => {
            const checkbox = e.target.closest('.habit-checkbox');
            if (!checkbox) return;

            e.preventDefault();
            e.stopPropagation();

            // Убеждаемся что data-state существует
            if (!checkbox.dataset.state) {
                checkbox.dataset.state = 'empty';
            }

            const states = ['empty', 'checked', 'crossed', 'circled'];
            const currentState = checkbox.dataset.state;
            const currentIndex = states.indexOf(currentState);
            const nextIndex = (currentIndex + 1) % states.length;
            const nextState = states[nextIndex];

            checkbox.dataset.state = nextState;
            this.saveHabitEntry(checkbox, nextState);

            return false;
        });
    }

    async saveHabitEntry(checkbox, status) {
        const habitRow = checkbox.closest('.habit-row');
        if (!habitRow) {
            console.error('No habit row found');
            return;
        }

        const habitId = habitRow.dataset.habitId;
        const date = checkbox.dataset.date;

        console.log('Saving habit entry:', {habitId, date, status, habitRow, checkbox});

        if (!habitId || !date) {
            console.error('Missing habitId or date:', {habitId, date});
            return;
        }

        try {
            const response = await fetch('/api/habits/entry/update/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    habit_id: parseInt(habitId),
                    date: date,
                    status: status
                })
            });

            const responseData = await response.json();
            console.log('Server response:', responseData);

            if (!response.ok) {
                console.error('Server error:', responseData);
                throw new Error('Failed to save habit entry');
            }

            console.log('Habit entry saved successfully:', {habitId, date, status});
        } catch (error) {
            console.error('Error saving habit entry:', error);
            // В случае ошибки возвращаем предыдущее состояние
            const states = ['empty', 'checked', 'crossed', 'circled'];
            const prevIndex = (states.indexOf(status) - 1 + states.length) % states.length;
            const prevState = states[prevIndex];
            checkbox.dataset.state = prevState;
        }
    }

    // Настройка обработчиков для модального окна
    setupHabitModalListeners() {
        // Кнопка добавления привычки
        document.querySelector('.add-habit-btn').addEventListener('click', () => {
            this.openHabitModal();
        });

        // Кнопки редактирования и удаления (делегирование)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('habit-edit')) {
                const habitRow = e.target.closest('.habit-row');
                const habitId = habitRow.dataset.habitId;
                this.openHabitModal(habitId);
            }

            if (e.target.classList.contains('habit-delete')) {
                const habitRow = e.target.closest('.habit-row');
                const habitId = habitRow.dataset.habitId;
                const habitName = habitRow.querySelector('.habit-name').textContent;
                this.prepareDeleteHabit(habitId, habitName);
            }
        });

        // Обработчик для кнопки завершения
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('habit-complete')) {
                const habitRow = e.target.closest('.habit-row');
                const habitId = habitRow.dataset.habitId;
                const habitName = habitRow.querySelector('.habit-name').textContent;
                this.completeHabit(habitId, habitName);
            }
        });

        // Закрытие модального окна
        document.getElementById('close-habit-modal').addEventListener('click', () => {
            document.getElementById('habit-modal').style.display = 'none';
        });

        // Сабмит формы
        document.getElementById('habit-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveHabit();
        });

        // Удаление привычки
        document.getElementById('delete-habit-btn').addEventListener('click', () => {
            document.getElementById('delete-habit-modal').style.display = 'flex';
        });

        document.getElementById('cancel-habit-delete').addEventListener('click', () => {
            document.getElementById('delete-habit-modal').style.display = 'none';
        });

        document.getElementById('confirm-habit-delete').addEventListener('click', () => {
            this.deleteHabit();
        });

        // Закрытие по клику вне модалки
        window.addEventListener('click', (e) => {
            const habitModal = document.getElementById('habit-modal');
            const deleteModal = document.getElementById('delete-habit-modal');

            if (e.target === habitModal) habitModal.style.display = 'none';
            if (e.target === deleteModal) deleteModal.style.display = 'none';
        });
    }

    async completeHabit(habitId, habitName) {
        if (!confirm(`Завершить привычку "${habitName}"? Она пропадёт на этой неделе и больше не будет показываться в будущих неделях.`)) {
            return;
        }

        try {
            // Устанавливаем end_date на сегодня
            const today = new Date().toISOString().split('T')[0];

            // Получаем текущие данные привычки
            const habit = this.habits.find(h => h.id == habitId);

            const response = await fetch(`/api/habits/${habitId}/update/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    name: habit.name,
                    description: habit.description || '',
                    start_date: habit.start_date,
                    end_date: today  // Добавляем дату завершения
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to complete habit');
            }

            // Обновляем список привычек
            await this.loadAndDisplayHabits();
            console.log('Habit completed successfully');

        } catch (error) {
            console.error('Error completing habit:', error);
            alert('Ошибка при завершении привычки');
        }
    }

    // Открыть модальное окно (для создания или редактирования)
    async openHabitModal(habitId = null) {
    const modal = document.getElementById('habit-modal');
    const modalTitle = document.getElementById('habit-modal-title');
    const deleteBtn = document.getElementById('delete-habit-btn');
    const form = document.getElementById('habit-form');

    // Сбрасываем форму
    form.reset();
    document.getElementById('habit-end-date').value = '';

    if (habitId) {
        // Редактирование
        modalTitle.textContent = 'Редактировать привычку';
        deleteBtn.style.display = 'block';

        // Загружаем данные привычки
        try {
            const habit = this.habits.find(h => h.id == habitId);
            if (habit) {
                document.getElementById('habit-id').value = habit.id;
                document.getElementById('habit-name').value = habit.name;
                document.getElementById('habit-description').value = habit.description || '';
                document.getElementById('habit-start-date').value = habit.start_date || '';
                document.getElementById('habit-end-date').value = habit.end_date || '';
                this.currentHabitId = habit.id;
            }
        } catch (error) {
            console.error('Error loading habit:', error);
        }
    } else {
        // Создание - ИСПРАВЛЯЕМ ДАТУ НАЧАЛА
        modalTitle.textContent = 'Добавить привычку';
        deleteBtn.style.display = 'none';
        document.getElementById('habit-id').value = '';

        // Используем дату понедельника текущей отображаемой недели, а не сегодня
        const weekDates = this.weekManager.getCurrentWeekDates();
        const mondayDate = weekDates[0].toISOString().split('T')[0];
        document.getElementById('habit-start-date').value = mondayDate;

        this.currentHabitId = null;
    }

    modal.style.display = 'flex';
}

    // Сохранить привычку
    async saveHabit() {
    const habitId = document.getElementById('habit-id').value;
    const isEditing = !!habitId;

    const habitData = {
        name: document.getElementById('habit-name').value,
        description: document.getElementById('habit-description').value,
        start_date: document.getElementById('habit-start-date').value,
        end_date: document.getElementById('habit-end-date').value || null  // Если пусто - отправляем null
    };

    const url = isEditing ? `/api/habits/${habitId}/update/` : '/api/habits/create/';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCSRFToken()
            },
            body: JSON.stringify(habitData)
        });

        if (!response.ok) throw new Error('Failed to save habit');

        // Закрываем модалку и обновляем список
        document.getElementById('habit-modal').style.display = 'none';
        await this.loadAndDisplayHabits();

    } catch (error) {
        console.error('Error saving habit:', error);
        alert('Ошибка при сохранении привычки');
    }
}

    // Подготовка к удалению
    prepareDeleteHabit(habitId, habitName) {
        this.currentHabitId = habitId;
        document.getElementById('delete-habit-modal').style.display = 'flex';
    }

    // Удалить привычку
    async deleteHabit() {
        if (!this.currentHabitId) return;

        try {
            const response = await fetch(`/api/habits/${this.currentHabitId}/delete/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.getCSRFToken()
                }
            });

            if (!response.ok) throw new Error('Failed to delete habit');

            // Закрываем модалки и обновляем список
            document.getElementById('delete-habit-modal').style.display = 'none';
            document.getElementById('habit-modal').style.display = 'none';
            await this.loadAndDisplayHabits();

        } catch (error) {
            console.error('Error deleting habit:', error);
            alert('Ошибка при удалении привычки');
        }
    }

    // Обновление при смене недели
    updateForWeek() {
        this.loadAndDisplayHabits();
    }

    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }
}