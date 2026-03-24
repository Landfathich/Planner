import {DAY_NAMES, formatDate, formatWeekRange} from './utils.js';

export class WeekManager {
    constructor() {
        this.currentWeekOffset = 0;
        this.dayNames = DAY_NAMES;
    }

    getCurrentWeekDates() {
        return this.getWeekDates(this.currentWeekOffset);
    }

    getWeekDates(offset = 0) {
        const today = new Date();
        const currentDay = today.getDay();
        const diff = currentDay === 0 ? 6 : currentDay - 1;

        const monday = new Date(today);
        monday.setDate(today.getDate() - diff + (offset * 7));

        return Array.from({length: 7}, (_, i) => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            return date;
        });
    }

    updateWeekTaskButton(mondayDate) {
        const weekTaskButton = document.getElementById('add-weekly-task-btn');
        if (weekTaskButton) {
            weekTaskButton.dataset.date = mondayDate.toISOString().split('T')[0];
            console.log('Updated week task button date to:', weekTaskButton.dataset.date);
        }
    }

    updateWeekInfo() {
        const dates = this.getCurrentWeekDates();
        this.updateWeekRange(dates);
        this.updateDayCards(dates);
        this.updateWeekTaskButton(dates[0]);
    }

    updateWeekRange(dates) {
        const weekRangeElement = document.getElementById('week-range');
        if (weekRangeElement) {
            weekRangeElement.textContent = formatWeekRange(dates[0], dates[6]);
        }
    }

    updateWeekNumber(weekNumber) {
        const weekNumberElement = document.querySelector('.week-number');
        if (weekNumberElement) {
            weekNumberElement.textContent = `#${weekNumber}`;
        }
    }

    updateDayCards(dates) {
        const dayCards = document.querySelectorAll('.day-card');

        dates.forEach((date, index) => {
            if (dayCards[index]) {
                this.updateDayCard(dayCards[index], date, index);
            }
        });
    }

    updateDayCard(dayCard, date, dayIndex) {
        console.log('Updating day card:', dayIndex, date);

        const dateElement = dayCard.querySelector('.date[data-date-format]');
        if (dateElement) {
            console.log('Setting date to:', formatDate(date));
            dateElement.textContent = formatDate(date);
        } else {
            console.log('Date element not found for day:', dayIndex);
        }

        const addButton = dayCard.querySelector('.add-task-btn');
        if (addButton) {
            addButton.dataset.date = date.toISOString().split('T')[0];
        }

        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();
        dayCard.classList.toggle('today', isToday);
    }

    async loadWeekTasks(offset) {
        try {
            const response = await fetch(`/api/week-data/?week_offset=${offset}`);
            if (response.ok) {
                const data = await response.json();

                // Обновляем номер недели в DOM
                this.updateWeekNumber(data.week_number);

                return data.tasks || [];
            }
            return [];
        } catch (error) {
            console.error('Error loading week tasks:', error);
            return [];
        }
    }
}