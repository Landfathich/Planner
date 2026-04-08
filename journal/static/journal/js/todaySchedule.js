import {showNotification} from './utils.js';

class TodayScheduleManager {
    constructor() {
        this.items = [];
        this.completions = {};
        this.today = new Date().toISOString().split('T')[0];
        this.init();
    }

    async init() {
        await this.loadSchedule();
        this.renderDate();
        this.renderTimeline();
        this.setupEventListeners();
    }

    renderDate() {
        const dateElement = document.getElementById('current-date');
        const today = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateElement.textContent = today.toLocaleDateString('ru-RU', options);
    }

    async loadSchedule() {
        try {
            const response = await fetch('/api/schedule/today/');
            if (response.ok) {
                const data = await response.json();
                this.items = data.items || [];
                this.completions = data.completions || {};
                this.updateProgress();
            } else {
                console.error('Failed to load schedule');
            }
        } catch (error) {
            console.error('Error loading schedule:', error);
        }
    }

    renderTimeline() {
        const container = document.getElementById('schedule-timeline');
        if (!container) return;

        if (this.items.length === 0) {
            container.innerHTML = `
                <div class="loading">
                    <p>Нет расписания на сегодня</p>
                    <p style="font-size: 12px; margin-top: 8px;">Настройте шаблон в разделе "Настройки"</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        // Сортируем по времени
        const sortedItems = [...this.items].sort((a, b) => a.time.localeCompare(b.time));

        sortedItems.forEach(item => {
            const isCompleted = this.completions[item.id] || false;
            const itemCard = this.createScheduleCard(item, isCompleted);
            container.appendChild(itemCard);
        });
    }

    createScheduleCard(item, isCompleted) {
        const card = document.createElement('div');
        card.className = `schedule-item-card ${isCompleted ? 'completed' : ''}`;
        card.dataset.id = item.id;

        card.innerHTML = `
            <div class="item-checkbox ${isCompleted ? 'checked' : ''}"></div>
            <div class="item-time">${item.time}</div>
            <div class="item-content">
                <div class="item-title">${this.escapeHtml(item.title)}</div>
                ${item.description ? `<div class="item-description">${this.escapeHtml(item.description)}</div>` : ''}
            </div>
            <div class="item-actions">
                <button class="item-edit" title="Редактировать">✎</button>
                <button class="item-delete" title="Удалить">×</button>
            </div>
        `;

        const checkbox = card.querySelector('.item-checkbox');
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleItemCompletion(item.id);
        });

        const editBtn = card.querySelector('.item-edit');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editScheduleItem(item);
        });

        const deleteBtn = card.querySelector('.item-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteScheduleItem(item.id);
        });

        return card;
    }

    async toggleItemCompletion(itemId) {
        try {
            const response = await fetch('/api/schedule/today/toggle/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    item_id: itemId,
                    date: this.today
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.completions[itemId] = data.is_completed;
                this.updateProgress();
                this.renderTimeline();
                showNotification(data.is_completed ? 'Готово! ✓' : 'Отмечено как невыполненное', 'success');
            }
        } catch (error) {
            console.error('Error toggling item:', error);
            showNotification('Ошибка', 'error');
        }
    }

    async deleteScheduleItem(itemId) {
        if (!confirm('Удалить этот пункт из расписания?')) return;

        try {
            const response = await fetch(`/api/schedule/today/item/${itemId}/delete/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.getCSRFToken()
                }
            });

            if (response.ok) {
                this.items = this.items.filter(i => i.id !== itemId);
                delete this.completions[itemId];
                this.renderTimeline();
                this.updateProgress();
                showNotification('Пункт удалён', 'success');
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            showNotification('Ошибка', 'error');
        }
    }

    editScheduleItem(item) {
        const modal = document.getElementById('schedule-item-modal');
        const title = document.getElementById('modal-title');

        title.textContent = 'Редактировать пункт';
        document.getElementById('item-id').value = item.id;
        document.getElementById('item-time').value = item.time;
        document.getElementById('item-title').value = item.title;
        document.getElementById('item-description').value = item.description || '';

        modal.style.display = 'flex';

        const form = document.getElementById('schedule-item-form');
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateScheduleItem(item.id);
        });
    }

    async updateScheduleItem(itemId) {
        const data = {
            time: document.getElementById('item-time').value,
            title: document.getElementById('item-title').value,
            description: document.getElementById('item-description').value
        };

        try {
            const response = await fetch(`/api/schedule/today/item/${itemId}/update/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                document.getElementById('schedule-item-modal').style.display = 'none';
                await this.loadSchedule();
                this.renderTimeline();
                showNotification('Пункт обновлён', 'success');
            }
        } catch (error) {
            console.error('Error updating item:', error);
            showNotification('Ошибка', 'error');
        }
    }

    updateProgress() {
        const total = this.items.length;
        if (total === 0) {
            document.getElementById('progress-percent').textContent = '0%';
            document.getElementById('progress-fill').style.width = '0%';
            return;
        }

        const completed = Object.values(this.completions).filter(v => v === true).length;
        const percent = Math.round((completed / total) * 100);

        document.getElementById('progress-percent').textContent = `${percent}%`;
        document.getElementById('progress-fill').style.width = `${percent}%`;
    }

    setupEventListeners() {
        // Кнопка настроек
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                window.location.href = '/schedule/';
            });
        }

        // Закрытие модалки
        const closeBtn = document.querySelector('#schedule-item-modal .close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('schedule-item-modal').style.display = 'none';
            });
        }

        window.addEventListener('click', (e) => {
            const modal = document.getElementById('schedule-item-modal');
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TodayScheduleManager();
});