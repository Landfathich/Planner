import {showNotification} from './utils.js';

class ScheduleManager {
    constructor() {
        this.templates = [];
        this.currentTemplateId = null;
        this.dailySchedules = {};
        this.init();
    }

    async init() {
        await this.loadTemplates();
        await this.loadDailySchedules();
        this.renderTemplates();
        this.renderDays();
        this.setupEventListeners();
    }

    async loadTemplates() {
        try {
            const response = await fetch('/api/schedule/templates/');
            if (response.ok) {
                const data = await response.json();
                this.templates = data.templates;
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }

    async loadDailySchedules() {
        try {
            const response = await fetch('/api/schedule/daily/');
            if (response.ok) {
                const data = await response.json();
                this.dailySchedules = data.daily_schedules;
            }
        } catch (error) {
            console.error('Error loading daily schedules:', error);
        }
    }

    renderTemplates() {
    const container = document.getElementById('templates-list');
    if (!container) return;

    if (this.templates.length === 0) {
        container.innerHTML = '<div class="template-card placeholder">Нет шаблонов. Создайте первый!</div>';
        return;
    }

    container.innerHTML = '';
    this.templates.forEach(template => {
        const card = document.createElement('div');
        card.className = `template-card ${template.is_default ? 'default' : ''}`;
        card.innerHTML = `
            <div class="template-name">${template.name}</div>
            ${template.description ? `<div class="template-description">${template.description}</div>` : ''}
            <div class="template-actions">
                <button class="edit-template-btn" data-id="${template.id}">✎</button>
                <button class="edit-schedule-btn" data-id="${template.id}">📋</button>
            </div>
        `;

        // Редактирование шаблона (название, описание, default)
        card.querySelector('.edit-template-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.openTemplateModal(template.id);
        });

        // Редактирование пунктов расписания
        card.querySelector('.edit-schedule-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.currentTemplateId = template.id;
            this.openTemplateItemsModal();
        });

        container.appendChild(card);
    });
}

    selectTemplate(templateId) {
        this.currentTemplateId = templateId;
        this.renderTemplates();
        this.openTemplateItemsModal();
    }

    async openTemplateItemsModal() {
        const template = this.templates.find(t => t.id === this.currentTemplateId);
        if (!template) return;

        const modal = document.getElementById('schedule-items-modal');
        const title = document.getElementById('schedule-items-title');
        const container = document.getElementById('schedule-items-list');

        title.textContent = `Расписание: ${template.name}`;

        // Загружаем пункты расписания
        try {
            const response = await fetch(`/api/schedule/templates/${this.currentTemplateId}/items/`);
            if (response.ok) {
                const data = await response.json();
                this.renderScheduleItems(container, data.items);
            }
        } catch (error) {
            console.error('Error loading schedule items:', error);
        }

        modal.style.display = 'flex';
    }

    renderScheduleItems(container, items) {
        container.innerHTML = '';

        if (items.length === 0) {
            container.innerHTML = '<div class="placeholder">Нет пунктов расписания</div>';
        }

        items.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'schedule-item';
            itemDiv.dataset.id = item.id;
            itemDiv.innerHTML = `
                <input type="time" class="item-time" value="${item.time}" placeholder="09:00">
                <input type="text" class="item-title" value="${item.title}" placeholder="Название">
                <input type="text" class="item-desc" value="${item.description || ''}" placeholder="Описание">
                <button class="remove-item" data-index="${index}">×</button>
            `;
            container.appendChild(itemDiv);
        });

        // Навешиваем обработчики на кнопки удаления
        container.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.schedule-item').remove();
            });
        });
    }

    renderDays() {
        const container = document.getElementById('days-list');
        if (!container) return;

        const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

        container.innerHTML = '';

        days.forEach((day, index) => {
            const schedule = this.dailySchedules[index];
            const templateName = schedule ? schedule.template_name : 'Не выбран';

            const card = document.createElement('div');
            card.className = 'day-card';
            card.dataset.day = index;
            card.innerHTML = `
                <span class="day-name">${day}</span>
                <span class="day-template">${templateName}</span>
                <div class="day-actions">
                    <button class="edit-day-btn" data-day="${index}">✎</button>
                </div>
            `;
            container.appendChild(card);
        });

        // Навешиваем обработчики на кнопки редактирования
        container.querySelectorAll('.edit-day-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const day = e.target.dataset.day;
                this.openDayScheduleModal(day);
            });
        });
    }

    async openDayScheduleModal(day) {
        const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
        const currentTemplateId = this.dailySchedules[day]?.template_id || null;

        const modal = document.getElementById('day-schedule-modal');
        const title = document.getElementById('day-schedule-title');
        const select = document.getElementById('day-template-select');

        title.textContent = `Выбрать шаблон для ${days[day]}`;

        // Заполняем select
        select.innerHTML = '<option value="">— Не выбран —</option>';
        this.templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            if (template.id === currentTemplateId) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        modal.style.display = 'flex';

        // Сохраняем обработчик
        const saveBtn = document.getElementById('save-day-schedule-btn');
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.onclick = async () => {
            const templateId = select.value || null;
            await this.saveDaySchedule(day, templateId);
            modal.style.display = 'none';
        };
    }

    async saveDaySchedule(day, templateId) {
        try {
            const response = await fetch('/api/schedule/daily/update/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    day_of_week: parseInt(day),
                    template_id: templateId
                })
            });

            if (response.ok) {
                await this.loadDailySchedules();
                this.renderDays();
                showNotification('Расписание сохранено', 'success');
            }
        } catch (error) {
            console.error('Error saving daily schedule:', error);
            showNotification('Ошибка', 'error');
        }
    }

    setupEventListeners() {
        // Добавление шаблона
        const addBtn = document.getElementById('add-template-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.openTemplateModal());
        }

        // Сохранение шаблона
        const templateForm = document.getElementById('template-form');
        if (templateForm) {
            templateForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveTemplate();
            });
        }

        // Сохранение пунктов расписания
        const saveItemsBtn = document.getElementById('save-schedule-items-btn');
        if (saveItemsBtn) {
            saveItemsBtn.addEventListener('click', () => this.saveScheduleItems());
        }

        // Добавление пункта расписания
        const addItemBtn = document.getElementById('add-item-btn');
        if (addItemBtn) {
            addItemBtn.addEventListener('click', () => {
                const container = document.getElementById('schedule-items-list');
                const emptyItem = document.createElement('div');
                emptyItem.className = 'schedule-item';
                emptyItem.innerHTML = `
                    <input type="time" class="item-time" placeholder="09:00">
                    <input type="text" class="item-title" placeholder="Название">
                    <input type="text" class="item-desc" placeholder="Описание">
                    <button class="remove-item">×</button>
                `;
                emptyItem.querySelector('.remove-item').addEventListener('click', () => emptyItem.remove());
                container.appendChild(emptyItem);
            });
        }

        // Закрытие модалок
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                closeBtn.closest('.modal').style.display = 'none';
            });
        });

        window.addEventListener('click', (e) => {
            document.querySelectorAll('.modal').forEach(modal => {
                if (e.target === modal) modal.style.display = 'none';
            });
        });
    }

    openTemplateModal(templateId = null) {
    const modal = document.getElementById('template-modal');
    const title = document.getElementById('template-modal-title');
    const deleteBtn = document.getElementById('delete-template-btn');
    const form = document.getElementById('template-form');

    form.reset();
    document.getElementById('template-id').value = '';

    if (templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (template) {
            title.textContent = 'Редактировать шаблон';
            deleteBtn.style.display = 'block';
            document.getElementById('template-id').value = template.id;
            document.getElementById('template-name').value = template.name;
            document.getElementById('template-description').value = template.description || '';
            document.getElementById('template-default').checked = template.is_default;
            this.currentEditId = templateId;

            // Убираем старый обработчик и добавляем новый
            const newDeleteBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
            newDeleteBtn.addEventListener('click', () => this.deleteTemplate(templateId));
        }
    } else {
        title.textContent = 'Создать шаблон';
        deleteBtn.style.display = 'none';
        this.currentEditId = null;
    }

    modal.style.display = 'flex';
}

async deleteTemplate(templateId) {
    if (!confirm('Удалить этот шаблон? Все пункты расписания будут также удалены.')) {
        return;
    }

    try {
        const response = await fetch(`/api/schedule/templates/${templateId}/delete/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': this.getCSRFToken()
            }
        });

        if (response.ok) {
            document.getElementById('template-modal').style.display = 'none';
            await this.loadTemplates();
            await this.loadDailySchedules();
            this.renderTemplates();
            this.renderDays();
            showNotification('Шаблон удалён', 'success');
        } else {
            showNotification('Ошибка при удалении', 'error');
        }
    } catch (error) {
        console.error('Error deleting template:', error);
        showNotification('Ошибка', 'error');
    }
}

    async saveTemplate() {
        const templateId = document.getElementById('template-id').value;
        const isEditing = !!templateId;

        const data = {
            name: document.getElementById('template-name').value,
            description: document.getElementById('template-description').value,
            is_default: document.getElementById('template-default').checked
        };

        const url = isEditing ? `/api/schedule/templates/${templateId}/update/` : '/api/schedule/templates/create/';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                document.getElementById('template-modal').style.display = 'none';
                await this.loadTemplates();
                await this.loadDailySchedules();
                this.renderTemplates();
                this.renderDays();
                showNotification(isEditing ? 'Шаблон обновлён' : 'Шаблон создан', 'success');
            }
        } catch (error) {
            console.error('Error saving template:', error);
            showNotification('Ошибка', 'error');
        }
    }

    async saveScheduleItems() {
        if (!this.currentTemplateId) return;

        const items = [];
        const container = document.getElementById('schedule-items-list');
        const itemDivs = container.querySelectorAll('.schedule-item');

        itemDivs.forEach(div => {
            const time = div.querySelector('.item-time').value;
            const title = div.querySelector('.item-title').value;
            const description = div.querySelector('.item-desc').value;

            if (time && title) {
                items.push({time, title, description});
            }
        });

        try {
            const response = await fetch(`/api/schedule/templates/${this.currentTemplateId}/items/update/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({items: items})
            });

            if (response.ok) {
                document.getElementById('schedule-items-modal').style.display = 'none';
                showNotification('Расписание сохранено', 'success');
            }
        } catch (error) {
            console.error('Error saving schedule items:', error);
            showNotification('Ошибка', 'error');
        }
    }

    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ScheduleManager();
});