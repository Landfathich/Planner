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
        console.log("Daily Planner initialized");
        //this.updateDisplay();
        // TODO определить когда отрисовываться будет контекстом, а когда через запрос к апи через s
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
        await this.updateDisplay();
    }

    async nextWeek() {
        this.weekManager.currentWeekOffset++;
        await this.updateDisplay();
    }

    async goToCurrentWeek() {
        if (this.weekManager.currentWeekOffset !== 0) {
            this.weekManager.currentWeekOffset = 0;
            await this.updateDisplay();
        }
    }

    async updateDisplay() {
        const currentWeekDates = this.weekManager.getCurrentWeekDates();
        this.weekManager.updateWeekInfo();

        // Загружаем задачи для текущей недели
        const tasks = await this.weekManager.loadWeekTasks(this.weekManager.currentWeekOffset);
        this.taskManager.displayTasksForWeek(tasks, currentWeekDates);
        console.log(tasks)
    }
}

document.addEventListener("DOMContentLoaded", function () {
    new DailyPlannerApp();
});