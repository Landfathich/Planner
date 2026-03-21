import {showNotification} from './utils.js';

class GeneralGoalsManager {
    constructor() {
        this.currentYear = new Date().getFullYear();
        this.years = [];
        this.yearlyGoals = [];
        this.monthlyGoals = {};
        this.monthlyReports = {};
        this.yearlyReport = null;

        this.init();
    }

    async init() {
        await this.loadYears();
        await this.loadYearData(this.currentYear);
        this.renderYears();
        this.setupEventListeners();
    }

    async loadYears() {
        try {
            const response = await fetch('/api/goals/years/');
            if (response.ok) {
                const data = await response.json();
                this.years = data.years;

                // Если нет годов - создаём текущий
                if (this.years.length === 0) {
                    await this.createYear(this.currentYear);
                    // Загружаем годы снова
                    const newResponse = await fetch('/api/goals/years/');
                    if (newResponse.ok) {
                        const newData = await newResponse.json();
                        this.years = newData.years;
                    }
                }
            }
        } catch (error) {
            console.error('Error loading years:', error);
        }
    }

    async createYear(year) {
        try {
            const response = await fetch('/api/goals/years/create/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({year: year})
            });
            if (response.ok) {
                console.log(`Год ${year} создан`);
                // Убираем showNotification, чтобы не спамило
            }
        } catch (error) {
            console.error('Error creating year:', error);
        }
    }

    async loadYearData(year) {
        try {
            const response = await fetch(`/api/goals/year/${year}/`);
            if (response.ok) {
                const data = await response.json();
                this.yearlyGoals = data.yearly_goals || [];
                this.monthlyGoals = data.monthly_goals || {};
                this.monthlyReports = data.monthly_reports || {};
                this.yearlyReport = data.yearly_report;
                this.renderYearContent();
            }
        } catch (error) {
            console.error('Error loading year data:', error);
        }
    }

    renderYears() {
        const container = document.getElementById('years-list');
        if (!container) return;

        container.innerHTML = '';
        this.years.forEach(year => {
            const yearDiv = document.createElement('div');
            yearDiv.className = `year-item ${year === this.currentYear ? 'active' : ''}`;
            yearDiv.textContent = year;
            yearDiv.dataset.year = year;
            yearDiv.addEventListener('click', () => this.switchYear(year));
            container.appendChild(yearDiv);
        });
    }

    async switchYear(year) {
        this.currentYear = year;
        document.querySelectorAll('.year-item').forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.year) === year);
        });
        document.getElementById('selected-year').textContent = year;
        await this.loadYearData(year);
    }

    renderYearContent() {
        this.renderYearlyGoals();
        this.renderMonths();
        this.renderYearlyReport();

        // Скроллим к текущему месяцу
        this.scrollToCurrentMonth();
    }

    scrollToCurrentMonth() {
        const currentMonthCard = document.querySelector('.month-card.current-month');
        if (currentMonthCard) {
            currentMonthCard.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    renderYearlyGoals() {
        const container = document.getElementById('yearly-goals-list');
        if (!container) return;

        container.innerHTML = '';

        if (this.yearlyGoals.length === 0) {
            container.innerHTML = '<div class="goal-card placeholder">Нет годовых целей</div>';
            return;
        }

        this.yearlyGoals.forEach(goal => {
            const goalCard = this.createGoalCard(goal, 'yearly');
            container.appendChild(goalCard);
        });
    }

    renderMonths() {
        const container = document.getElementById('months-container');
        if (!container) return;

        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

        container.innerHTML = '';

        for (let i = 0; i < 12; i++) {
            const monthNumber = i + 1;
            const monthGoals = this.monthlyGoals[monthNumber] || [];
            const monthReport = this.monthlyReports[monthNumber] || null;

            const monthCard = this.createMonthCard(monthNumber, monthNames[i], monthGoals, monthReport);
            container.appendChild(monthCard);
        }
    }

    createMonthCard(monthNumber, monthName, goals, report) {
        const card = document.createElement('div');
        card.className = 'month-card';

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        if (this.currentYear === currentYear && monthNumber === currentMonth) {
            card.classList.add('current-month');
        }

        card.innerHTML = `
        <div class="month-header">
            <h4>${monthName} ${this.currentYear}</h4>
        </div>
        <div class="month-content open">
            <div class="month-goals-list">
                ${goals.length === 0 ? '<div class="goal-card placeholder">Нет целей</div>' : ''}
            </div>
            <button class="add-month-goal-btn" data-month="${monthNumber}">+ Добавить цель</button>
            <div class="month-report">
                <div class="month-report-header">
                    <h5>Отчёт</h5>
                    <button class="edit-report-btn" data-month="${monthNumber}" data-type="monthly">✎</button>
                </div>
                <div class="month-report-content ${!report ? 'placeholder' : ''}" data-month="${monthNumber}">
                    ${report ? report.text : 'Написать отчёт...'}
                </div>
            </div>
        </div>
    `;

        // Добавляем цели
        const goalsList = card.querySelector('.month-goals-list');
        goals.forEach(goal => {
            goalsList.appendChild(this.createGoalCard(goal, 'monthly'));
        });

        // Обработчики
        const addGoalBtn = card.querySelector('.add-month-goal-btn');
        addGoalBtn.addEventListener('click', () => this.addMonthlyGoal(monthNumber));

        const editReportBtn = card.querySelector('.edit-report-btn');
        editReportBtn.addEventListener('click', () => this.editReport(monthNumber, 'monthly'));

        const reportContent = card.querySelector('.month-report-content');
        reportContent.addEventListener('click', () => this.editReport(monthNumber, 'monthly'));

        return card;
    }

    createGoalCard(goal, type) {
        const div = document.createElement('div');
        div.className = `goal-card ${goal.is_completed ? 'completed' : ''}`;
        div.dataset.id = goal.id;

        let actions = `
        <div class="goal-actions">
            <button class="goal-complete" title="Выполнено">✓</button>
            <button class="goal-edit" title="Редактировать">✎</button>
            <button class="goal-delete" title="Удалить">×</button>
    `;

        // Только для месячных целей добавляем кнопку переноса
        if (type === 'monthly') {
            actions += `<button class="goal-carry" title="Перенести">→</button>`;
        }

        actions += `</div>`;
        div.innerHTML = `<span class="goal-text">${goal.text}</span>${actions}`;

        // Навешиваем обработчики
        const completeBtn = div.querySelector('.goal-complete');
        const editBtn = div.querySelector('.goal-edit');
        const deleteBtn = div.querySelector('.goal-delete');

        completeBtn.addEventListener('click', () => this.toggleGoalComplete(goal.id, type));
        editBtn.addEventListener('click', () => this.editGoal(goal.id, type, goal.text));
        deleteBtn.addEventListener('click', () => this.deleteGoal(goal.id, type));

        if (type === 'monthly') {
            const carryBtn = div.querySelector('.goal-carry');
            carryBtn.addEventListener('click', () => this.carryOverGoal(goal.id, type));
        }

        return div;
    }

    renderYearlyReport() {
        const container = document.getElementById('yearly-report-content');
        if (!container) return;

        container.className = `report-content ${!this.yearlyReport ? 'placeholder' : ''}`;
        container.textContent = this.yearlyReport ? this.yearlyReport.text : 'Написать годовой отчёт...';

        // Убираем старый обработчик, чтобы не дублировать
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);

        newContainer.addEventListener('click', () => this.editReport(null, 'yearly'));
    }

    async toggleGoalComplete(goalId, type) {
        const url = `/api/goals/${type}/${goalId}/toggle/`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'X-CSRFToken': this.getCSRFToken()}
            });
            if (response.ok) {
                await this.loadYearData(this.currentYear);
                showNotification('Статус обновлён', 'success');
            }
        } catch (error) {
            console.error('Error toggling goal:', error);
            showNotification('Ошибка', 'error');
        }
    }

    async deleteGoal(goalId, type) {
        if (!confirm('Удалить цель?')) return;

        const url = `/api/goals/${type}/${goalId}/delete/`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'X-CSRFToken': this.getCSRFToken()}
            });
            if (response.ok) {
                await this.loadYearData(this.currentYear);
                showNotification('Цель удалена', 'success');
            }
        } catch (error) {
            console.error('Error deleting goal:', error);
            showNotification('Ошибка', 'error');
        }
    }

    async carryOverGoal(goalId, type) {
        const url = `/api/goals/${type}/${goalId}/carry/`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'X-CSRFToken': this.getCSRFToken()}
            });
            if (response.ok) {
                await this.loadYearData(this.currentYear);
                showNotification('Цель перенесена', 'success');
            }
        } catch (error) {
            console.error('Error carrying over goal:', error);
            showNotification('Ошибка', 'error');
        }
    }

    editGoal(goalId, type, currentText) {
        const newText = prompt('Редактировать цель:', currentText);
        if (newText && newText !== currentText) {
            this.updateGoal(goalId, type, newText);
        }
    }

    async updateGoal(goalId, type, text) {
        const url = `/api/goals/${type}/${goalId}/update/`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({text: text})
            });
            if (response.ok) {
                await this.loadYearData(this.currentYear);
                showNotification('Цель обновлена', 'success');
            }
        } catch (error) {
            console.error('Error updating goal:', error);
            showNotification('Ошибка', 'error');
        }
    }

    async addMonthlyGoal(month) {
        const text = prompt('Введите цель:');
        if (!text) return;

        const url = `/api/goals/monthly/create/`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    year: this.currentYear,
                    month: month,
                    text: text
                })
            });
            if (response.ok) {
                await this.loadYearData(this.currentYear);
                showNotification('Цель добавлена', 'success');
            }
        } catch (error) {
            console.error('Error adding monthly goal:', error);
            showNotification('Ошибка', 'error');
        }
    }

    editReport(month, type) {
        const modal = document.getElementById('report-modal');
        const textarea = document.getElementById('report-text');
        const modalTitle = modal.querySelector('.modal-title');

        if (!modal || !textarea) {
            console.error('Modal elements not found');
            return;
        }

        if (type === 'yearly') {
            modalTitle.textContent = 'Годовой отчёт';
            textarea.value = this.yearlyReport ? this.yearlyReport.text : '';
        } else {
            modalTitle.textContent = `Отчёт за ${this.getMonthName(month)} ${this.currentYear}`;
            const report = this.monthlyReports[month];
            textarea.value = report ? report.text : '';
        }

        modal.style.display = 'flex';

        // Сохраняем обработчик
        const saveBtn = document.getElementById('save-report-btn');
        if (saveBtn) {
            // Убираем старые обработчики
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
            newSaveBtn.onclick = () => this.saveReport(month, type, textarea.value);
        }

        // Закрытие
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = () => modal.style.display = 'none';
        }

        // Закрытие по клику вне модалки
        window.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        };
    }

    async saveReport(month, type, text) {
        const url = `/api/goals/report/${type}/update/`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    year: this.currentYear,
                    month: month,
                    text: text
                })
            });
            if (response.ok) {
                document.getElementById('report-modal').style.display = 'none';
                await this.loadYearData(this.currentYear);
                showNotification('Отчёт сохранён', 'success');
            }
        } catch (error) {
            console.error('Error saving report:', error);
            showNotification('Ошибка', 'error');
        }
    }

    setupEventListeners() {
        // Добавление годовой цели
        const addYearlyGoalBtn = document.querySelector('[data-type="yearly"]');
        if (addYearlyGoalBtn) {
            addYearlyGoalBtn.addEventListener('click', () => {
                const text = prompt('Введите годовую цель:');
                if (text) this.addYearlyGoal(text);
            });
        }

        // Добавление года - ИСПРАВЛЯЕМ
        const addYearBtn = document.getElementById('add-year-btn');
        if (addYearBtn) {
            addYearBtn.addEventListener('click', async () => {
                const year = prompt('Введите год (например: 2027):');
                if (year && !isNaN(year)) {
                    await this.createYear(parseInt(year));
                    // После создания года обновляем список годов
                    await this.loadYears();
                    this.renderYears();
                    // Если созданный год не равен текущему, не переключаемся
                    // Если равен - загружаем данные
                    if (parseInt(year) === this.currentYear) {
                        await this.loadYearData(this.currentYear);
                    }
                }
            });
        }
    }

    async addYearlyGoal(text) {
        const url = `/api/goals/yearly/create/`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    year: this.currentYear,
                    text: text
                })
            });
            if (response.ok) {
                await this.loadYearData(this.currentYear);
                showNotification('Цель добавлена', 'success');
            }
        } catch (error) {
            console.error('Error adding yearly goal:', error);
            showNotification('Ошибка', 'error');
        }
    }

    getMonthName(month) {
        const names = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        return names[month - 1];
    }

    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GeneralGoalsManager();
});