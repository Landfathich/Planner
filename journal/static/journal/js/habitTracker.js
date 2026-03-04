export class HabitTracker {
    constructor(weekManager) {
        this.weekManager = weekManager;
        this.habits = [];
        this.setupHabitCheckboxes();
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
        actionsCol.innerHTML = `
            <button class="habit-edit" title="Редактировать">✎</button>
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

            const states = ['empty', 'checked', 'crossed', 'circled'];
            const currentState = checkbox.dataset.state || 'empty';
            const currentIndex = states.indexOf(currentState);
            const nextIndex = (currentIndex + 1) % states.length;
            const nextState = states[nextIndex];

            checkbox.dataset.state = nextState;

            // Сохраняем изменение на сервер
            this.saveHabitEntry(checkbox, nextState);
        });
    }

    async saveHabitEntry(checkbox, status) {
        const habitRow = checkbox.closest('.habit-row');
        const habitId = habitRow.dataset.habitId;
        const date = checkbox.dataset.date;

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

            if (!response.ok) throw new Error('Failed to save habit entry');

            console.log('Habit entry saved:', {habitId, date, status});
        } catch (error) {
            console.error('Error saving habit entry:', error);
            // В случае ошибки возвращаем предыдущее состояние
            const prevState = status === 'empty' ? 'circled' :
                            states[(states.indexOf(status) - 1 + states.length) % states.length];
            checkbox.dataset.state = prevState;
        }
    }

    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }

    // Метод для обновления при смене недели
    updateForWeek() {
        this.loadAndDisplayHabits();
    }
}