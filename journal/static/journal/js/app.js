import {WeekManager} from './weekManager.js';
import {TaskManager} from './taskManager.js';
import {HabitTracker} from './habitTracker.js';

class DailyPlannerApp {
    constructor() {
        this.weekManager = new WeekManager();
        this.taskManager = new TaskManager(this.weekManager);
        this.habitTracker = new HabitTracker(this.weekManager);

        this.setupEventListeners();
        this.init();
    }

    init() {
        this.weekManager.updateWeekInfo();
        this.loadAndDisplayWeek();
    }

    setupEventListeners() {
        document.getElementById('prev-week').addEventListener('click', () => this.prevWeek());
        document.getElementById('next-week').addEventListener('click', () => this.nextWeek());
        document.getElementById('current-week').addEventListener('click', () => this.goToCurrentWeek());
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
        this.weekManager.updateWeekInfo();

        // Загружаем задачи
        const tasks = await this.weekManager.loadWeekTasks(this.weekManager.currentWeekOffset);
        this.taskManager.displayTasksForWeek(tasks, this.weekManager.getCurrentWeekDates());

        // Загружаем привычки
        await this.habitTracker.updateForWeek();
    }
}

document.addEventListener("DOMContentLoaded", function () {
    new DailyPlannerApp();
});