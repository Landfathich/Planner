import {WeekManager} from './weekManager.js';
import {TaskManager} from './taskManager.js';

class DailyPlannerApp {
    constructor() {
        this.weekManager = new WeekManager();
        this.taskManager = new TaskManager(this.weekManager);

        this.setupEventListeners();
        this.init();
    }

    init() {
        // Сначала создаем дни недели
        this.weekManager.updateWeekInfo();
        // Затем загружаем и показываем задачи
        this.loadAndDisplayWeek();
    }

    setupEventListeners() {
        document.getElementById('prev-week').addEventListener('click', () => {
            this.prevWeek();
        });

        document.getElementById('next-week').addEventListener('click', () => {
            this.nextWeek();
        });

        document.getElementById('current-week').addEventListener('click', () => {
            this.goToCurrentWeek();
        });
    }

    async prevWeek() {
        this.weekManager.currentWeekOffset--;
        await this.loadAndDisplayWeek();
    }

    async nextWeek() {
        this.weekManager.currentWeekOffset++;
        await this.loadAndDisplayWeek();
    }

    async goToCurrentWeek() {
        if (this.weekManager.currentWeekOffset !== 0) {
            this.weekManager.currentWeekOffset = 0;
            await this.loadAndDisplayWeek();
        }
    }

    async loadAndDisplayWeek() {
        // Обновляем отображение дней недели
        this.weekManager.updateWeekInfo();

        // Загружаем задачи для текущей недели
        const tasks = await this.weekManager.loadWeekTasks(this.weekManager.currentWeekOffset);

        // Показываем задачи
        this.taskManager.displayTasksForWeek(tasks, this.weekManager.getCurrentWeekDates());
    }
}

document.addEventListener("DOMContentLoaded", function () {
    new DailyPlannerApp();
});