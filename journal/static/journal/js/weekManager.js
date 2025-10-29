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

    updateWeekInfo() {
        const dates = this.getCurrentWeekDates();
        this.updateWeekRange(dates);
        this.updateDayCards(dates);
    }

    updateWeekRange(dates) {
        const weekRangeElement = document.getElementById('week-range');
        if (weekRangeElement) {
            weekRangeElement.textContent = formatWeekRange(dates[0], dates[6]);
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
        // Обновляем дату
        const dateElement = dayCard.querySelector('.date');
        if (dateElement) {
            dateElement.textContent = formatDate(date);
        }

        // Обновляем день недели
        const dayNameElement = dayCard.querySelector('h3');
        if (dayNameElement) {
            dayNameElement.textContent = this.dayNames[dayIndex];
        }

        // Обновляем data-атрибут для кнопки добавления
        const addButton = dayCard.querySelector('.add-task-btn');
        if (addButton) {
            addButton.dataset.date = date.toISOString().split('T')[0];
        }

        // Обновляем класс today
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();
        dayCard.classList.toggle('today', isToday);
    }

    async loadWeekTasks(offset = 0) {
        try {
            const response = await fetch(`/api/tasks/week/?week_offset=${offset}`);
            if (response.ok) {
                const data = await response.json();
                return data.tasks;
            }
        } catch (error) {
            console.error('Error loading week tasks:', error);
        }
        return [];
    }
}