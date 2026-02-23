/**
 * modules/calendar/calendar.js
 */
const CalendarModule = {
    currentDate: new Date(),
    selectedDate: null,

    async init() {
        this.cacheDOM();
        this.bindEvents();
        await orbDB.open();
        this.render();
    },

    cacheDOM() {
        this.grid = document.getElementById('calendar-grid');
        this.monthDisplay = document.getElementById('cal-month-display');
        this.modal = document.getElementById('event-editor-modal');
        this.teamSelect = document.getElementById('event-team-select');
    },

    bindEvents() {
        document.getElementById('cal-prev-btn').onclick = () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.render();
        };
        document.getElementById('cal-next-btn').onclick = () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.render();
        };
        document.getElementById('close-event-modal').onclick = () => this.modal.classList.add('hidden');
        document.getElementById('btn-save-event').onclick = () => this.saveEvent();
    },

    async render() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        this.monthDisplay.textContent = this.currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        this.grid.innerHTML = '';

        // Jours de la semaine
        ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].forEach(d => {
            const h = document.createElement('div');
            h.className = 'calendar-header';
            h.textContent = d;
            this.grid.appendChild(h);
        });

        // Espaces vides
        for (let i = 0; i < firstDay; i++) {
            this.grid.appendChild(document.createElement('div'));
        }

        const events = await orbDB.getAllCalendarEvents();

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            dayCell.innerHTML = `<div class="day-number">${d}</div>`;
            
            // Affichage des événements
            events.filter(e => e.date === dateStr).forEach(e => {
                const chip = document.createElement('div');
                chip.className = 'event-chip';
                chip.textContent = e.title;
                dayCell.appendChild(chip);
            });

            dayCell.onclick = () => this.openEditor(dateStr);
            this.grid.appendChild(dayCell);
        }
    },

    async openEditor(dateStr) {
        this.selectedDate = dateStr;
        document.getElementById('event-date-display').textContent = new Date(dateStr).toLocaleDateString('fr-FR');
        
        // Charger les équipes dans le select
        const teams = await orbDB.getAllTeams();
        this.teamSelect.innerHTML = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        
        this.modal.classList.remove('hidden');
    },

    async saveEvent() {
        const eventData = {
            date: this.selectedDate,
            title: document.getElementById('event-title').value,
            teamId: parseInt(this.teamSelect.value, 10),
            notes: document.getElementById('event-notes').value
        };
        await orbDB.saveCalendarEvent(eventData);
        this.modal.classList.add('hidden');
        this.render();
    }
};

document.addEventListener('DOMContentLoaded', () => CalendarModule.init());