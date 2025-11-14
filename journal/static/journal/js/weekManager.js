import {DAY_NAMES, formatDate, formatWeekRange} from './utils.js';

export class WeekManager {
    constructor() {
        this.currentWeekOffset = 0;
        this.dayNames = DAY_NAMES;
        this.cache = new Map();
        this.loadingWeeks = new Set();
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
        const dateElement = dayCard.querySelector('.date');
        if (dateElement) {
            dateElement.textContent = formatDate(date);
        }

        const dayNameElement = dayCard.querySelector('h3');
        if (dayNameElement) {
            dayNameElement.textContent = this.dayNames[dayIndex];
        }

        const addButton = dayCard.querySelector('.add-task-btn');
        if (addButton) {
            addButton.dataset.date = date.toISOString().split('T')[0];
        }

        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();
        dayCard.classList.toggle('today', isToday);
    }

    addTaskToCache(task) {
        for (const [offset, tasks] of this.cache) {
            const weekDates = this.getWeekDates(offset);
            const weekDateStrings = weekDates.map(date => date.toISOString().split('T')[0]);

            if (weekDateStrings.includes(task.date)) {
                if (!tasks.some(t => t.id === task.id)) {
                    tasks.push(task);
                }
                break;
            }
        }
        this.logCacheState(`After adding task ${task.id}`);
    }

    removeTaskFromCache(taskId) {
        let removed = false;
        for (const [offset, tasks] of this.cache) {
            const initialLength = tasks.length;
            const filteredTasks = tasks.filter(task => task.id != taskId);
            if (filteredTasks.length !== initialLength) {
                this.cache.set(offset, filteredTasks);
                removed = true;
            }
        }
        if (removed) {
            this.logCacheState(`After removing task ${taskId}`);
        }
        return removed;
    }

    updateTaskInCache(updatedTask) {
        let updated = false;
        for (const [offset, tasks] of this.cache) {
            const taskIndex = tasks.findIndex(task => task.id == updatedTask.id);
            if (taskIndex !== -1) {
                tasks[taskIndex] = updatedTask;
                updated = true;
            }
        }
        return updated;
    }

    async loadWeekWithNeighbors(targetOffset) {
        const weeksToLoad = [targetOffset - 1, targetOffset, targetOffset + 1];
        const loadPromises = [];

        for (const offset of weeksToLoad) {
            if (!this.cache.has(offset) && !this.loadingWeeks.has(offset)) {
                this.loadingWeeks.add(offset);
                loadPromises.push(this.loadWeekFromAPI(offset));
            }
        }

        if (loadPromises.length > 0) {
            await Promise.all(loadPromises);
        }

        const tasks = this.cache.get(targetOffset) || [];

        // ТОЛЬКО ЭТОТ ЛОГ ОСТАВЛЯЕМ - самый важный
        console.log(`📅 Week ${targetOffset}: ${tasks.length} tasks`);
        this.logCacheState(`After loading week ${targetOffset}`);

        return tasks;
    }

    async loadWeekFromAPI(offset) {
        try {
            const response = await fetch(`/api/tasks/week/?week_offset=${offset}`);
            if (response.ok) {
                const data = await response.json();
                this.cache.set(offset, data.tasks);
                return data.tasks;
            } else {
                return [];
            }
        } catch (error) {
            console.error('Error loading week:', error);
            return [];
        } finally {
            this.loadingWeeks.delete(offset);
        }
    }

    // НОВЫЙ МЕТОД - логирование состояния кеша
    logCacheState(context = '') {
        console.group(`🗂️ Cache State ${context}`);
        console.log('Cached weeks:', Array.from(this.cache.keys()));

        this.cache.forEach((tasks, offset) => {
            const doneCount = tasks.filter(t => t.is_done).length;
            console.log(`Week ${offset}: ${tasks.length} tasks (${doneCount} done)`);

            // Показываем только первые 3 задачи для краткости
            tasks.slice(0, 3).forEach(task => {
                console.log(`  ${task.is_done ? '✅' : '⏳'} ${task.title}`);
            });
            if (tasks.length > 3) {
                console.log(`  ... and ${tasks.length - 3} more tasks`);
            }
        });

        console.groupEnd();
    }

    // Метод для ручной отладки из консоли
    debugCache() {
        this.logCacheState('Manual Debug');
    }
}