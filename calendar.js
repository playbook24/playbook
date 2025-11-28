/**
 * calendar.js
 * Gère l'affichage du calendrier, la logique des événements, la RÉPÉTITION,
 * l'APPARENCE et la GESTION D'ÉQUIPE (Présence).
 */

window.ORB.calendar = {
    currentDate: new Date(),
    currentEvent: null,
    tempSnapshot: null,
    tempAttendance: {}, // Stocke l'état des cases (Présent/Absent) temporairement

    init: function() {
        console.log("ORB Calendar : Initialisation...");
        this.cacheDOM();
        if(!this.view) return;
        this.bindEvents();
        this.renderCalendar();
    },

    cacheDOM: function() {
        this.view = document.getElementById('calendar-view');
        this.grid = document.getElementById('calendar-grid');
        this.monthDisplay = document.getElementById('cal-month-display');
        
        // Modale Event
        this.eventModal = document.getElementById('event-editor-modal');
        this.eventIdInput = document.getElementById('event-id');
        this.eventDateStrInput = document.getElementById('event-date-str');
        this.eventDateDisplay = document.getElementById('event-date-display');
        this.eventTitleInput = document.getElementById('event-title');
        this.eventNotesInput = document.getElementById('event-notes');
        
        // Équipe (Nouveau)
        this.eventTeamSelect = document.getElementById('event-team-select');

        // Apparence (Couleur)
        this.eventColorInput = document.getElementById('event-color'); 
        this.colorOptions = document.querySelectorAll('.color-option');
        
        // Répétition
        this.recurrenceGroup = document.getElementById('recurrence-group');
        this.recurrenceCheck = document.getElementById('event-recurrence-check');
        this.recurrenceOptions = document.getElementById('recurrence-options');
        this.recurrenceEndInput = document.getElementById('event-recurrence-end');

        // Plan & Aperçu
        this.planEmptyState = document.getElementById('event-plan-empty');
        this.planSelectedState = document.getElementById('event-plan-selected');
        this.snapshotNameDisplay = document.getElementById('snapshot-plan-name');
        this.snapshotPreviewImg = document.getElementById('snapshot-preview-img');
        this.snapshotNoPreview = document.getElementById('snapshot-no-preview');
        
        // Présence (Appel)
        this.btnManageAttendance = document.getElementById('btn-manage-attendance');
        this.attendanceSummary = document.getElementById('attendance-summary');
        this.attendanceModal = document.getElementById('attendance-modal');
        this.attendanceList = document.getElementById('attendance-list');
        
        // Sélecteur de Plan
        this.planPickerModal = document.getElementById('plan-picker-modal');
        this.planPickerList = document.getElementById('plan-picker-list');

        // Viewer (Lecteur)
        this.viewerModal = document.getElementById('snapshot-viewer-modal');
        this.viewerList = document.getElementById('viewer-list');
        this.viewerTitle = document.getElementById('viewer-title');
    },

    bindEvents: function() {
        // Bouton Ouverture Calendrier
        const showBtn = document.getElementById('show-calendar-btn');
        if(showBtn) {
            showBtn.addEventListener('click', () => {
                this.view.classList.remove('hidden');
                this.renderCalendar();
            });
        }

        // Navigation
        document.getElementById('calendar-close-btn').addEventListener('click', () => this.view.classList.add('hidden'));
        document.getElementById('cal-prev-btn').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('cal-next-btn').addEventListener('click', () => this.changeMonth(1));
        
        const todayBtn = document.getElementById('cal-today-btn');
        if(todayBtn) {
            todayBtn.addEventListener('click', () => {
                this.currentDate = new Date();
                this.renderCalendar();
            });
        }

        // Modale Événement
        document.getElementById('event-modal-close-btn').addEventListener('click', () => this.closeEventModal());
        document.getElementById('btn-save-event').addEventListener('click', () => this.saveEvent());
        document.getElementById('btn-delete-event').addEventListener('click', () => this.deleteEvent());

        // Sélecteur de Couleur
        this.colorOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                this.colorOptions.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                this.eventColorInput.value = opt.dataset.color;
            });
        });

        // Checkbox Répétition
        this.recurrenceCheck.addEventListener('change', (e) => {
            if(e.target.checked) {
                this.recurrenceOptions.classList.remove('hidden');
                if(!this.recurrenceEndInput.value) {
                    // Par défaut : +3 mois
                    const d = new Date(this.eventDateStrInput.value);
                    d.setMonth(d.getMonth() + 3);
                    this.recurrenceEndInput.value = d.toISOString().split('T')[0];
                }
            } else {
                this.recurrenceOptions.classList.add('hidden');
            }
        });

        // Gestion du Plan (Snapshot)
        document.getElementById('btn-open-plan-picker').addEventListener('click', () => this.openPlanPicker());
        document.getElementById('btn-remove-snapshot').addEventListener('click', () => {
            if(confirm("Détacher le plan ?")) {
                this.tempSnapshot = null;
                this.updatePlanUI();
            }
        });
        // Voir le détail
        document.getElementById('btn-view-snapshot-plan').addEventListener('click', () => {
            if (this.tempSnapshot) this.openSnapshotViewer(this.tempSnapshot);
        });

        // Gestion Présence (Appel)
        this.btnManageAttendance.addEventListener('click', () => this.openAttendanceModal());
        document.getElementById('attendance-close-btn').addEventListener('click', () => this.attendanceModal.classList.add('hidden'));
        
        // Valider l'appel
        document.getElementById('btn-save-attendance').addEventListener('click', () => {
            // On met à jour l'objet tempAttendance avec les cases cochées
            this.attendanceList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
                this.tempAttendance[chk.value] = chk.checked;
            });
            this.updateAttendanceSummary();
            this.attendanceModal.classList.add('hidden');
        });

        // Fermeture des autres modales
        document.getElementById('plan-picker-close-btn').addEventListener('click', () => this.planPickerModal.classList.add('hidden'));
        document.getElementById('viewer-close-btn').addEventListener('click', () => this.viewerModal.classList.add('hidden'));

        // Clic sur une case du calendrier
        this.grid.addEventListener('click', (e) => {
            const cell = e.target.closest('.calendar-day');
            if (cell && !cell.classList.contains('empty')) {
                const eventEl = e.target.closest('.calendar-event-chip');
                if (eventEl) {
                    // Édition
                    const eventId = parseInt(eventEl.dataset.id, 10);
                    this.openEventModal(null, eventId);
                    e.stopPropagation();
                } else {
                    // Création
                    const dateStr = cell.dataset.date;
                    this.openEventModal(dateStr, null);
                }
            }
        });
    },

    changeMonth: function(delta) {
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        this.renderCalendar();
    },

    async renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        this.monthDisplay.textContent = `${monthNames[month]} ${year}`;

        let events = [];
        try {
            if(typeof orbDB !== 'undefined') {
                const allEvents = await orbDB.getAllCalendarEvents();
                const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
                events = allEvents.filter(e => e.date.startsWith(prefix));
            }
        } catch (e) { console.error("Erreur DB Calendrier:", e); }

        this.grid.innerHTML = '';
        
        ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].forEach(d => {
            const dh = document.createElement('div');
            dh.className = 'calendar-header'; dh.textContent = d;
            this.grid.appendChild(dh);
        });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Cases vides avant le 1er
        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day empty';
            this.grid.appendChild(empty);
        }

        // Jours du mois
        for (let d = 1; d <= daysInMonth; d++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day';
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            cell.dataset.date = dateStr;

            const num = document.createElement('div');
            num.className = 'day-number'; num.textContent = d;
            
            const today = new Date();
            if (d === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                num.classList.add('today');
            }
            cell.appendChild(num);

            const dayEvents = events.filter(e => e.date === dateStr);
            dayEvents.forEach(evt => {
                const chip = document.createElement('div');
                chip.className = `calendar-event-chip`; 
                
                const bgColor = evt.color || '#BFA98D';
                chip.style.backgroundColor = bgColor;
                
                // Indicateur de plan (Icône)
                let iconHtml = '';
                if (evt.planSnapshot) {
                    iconHtml = `<svg viewBox="0 0 24 24" class="chip-icon" style="width:12px;height:12px;margin-right:4px;fill:white;"><path d="M19,3H14.82C14.4,1.84 13.3,1 12,1C10.7,1 9.6,1.84 9.18,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M12,3A1,1 0 0,1 13,4A1,1 0 0,1 12,5A1,1 0 0,1 11,4A1,1 0 0,1 12,3M7,7H17V9H7V7M7,11H17V13H7V11M7,15H14V17H7V15Z" /></svg>`;
                }
                
                chip.innerHTML = `${iconHtml}<span>${evt.title || 'Séance'}</span>`;
                chip.dataset.id = evt.id;
                cell.appendChild(chip);
            });
            this.grid.appendChild(cell);
        }
    },

    // --- GESTION ÉQUIPES (Dropdown) ---
    async loadTeamsIntoSelect(selectedTeamId) {
        try {
            const teams = await orbDB.getAllTeams();
            this.eventTeamSelect.innerHTML = '';
            
            if(teams.length === 0) {
                const opt = document.createElement('option');
                opt.textContent = "Aucune équipe (Créez-en une dans Effectif)";
                this.eventTeamSelect.appendChild(opt);
                return;
            }

            teams.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.name;
                if(selectedTeamId && t.id === selectedTeamId) opt.selected = true;
                this.eventTeamSelect.appendChild(opt);
            });
            
            // Sélection par défaut si rien de précisé
            if(!selectedTeamId && teams.length > 0) {
                this.eventTeamSelect.value = teams[0].id;
            }

        } catch(e) { console.error(e); }
    },

    async openEventModal(dateStr, eventId) {
        this.currentEvent = null;
        this.tempSnapshot = null;
        this.tempAttendance = {};
        this.eventIdInput.value = '';

        this.recurrenceCheck.checked = false;
        this.recurrenceOptions.classList.add('hidden');
        this.recurrenceEndInput.value = '';

        // Reset UI Couleur
        this.colorOptions.forEach(o => o.classList.remove('selected'));

        if (eventId) {
            // --- EDITION ---
            this.recurrenceGroup.classList.add('hidden');
            
            try {
                const events = await orbDB.getAllCalendarEvents();
                this.currentEvent = events.find(e => e.id === eventId);
                if (!this.currentEvent) return;

                this.eventIdInput.value = this.currentEvent.id;
                this.eventDateStrInput.value = this.currentEvent.date;
                this.eventDateDisplay.textContent = new Date(this.currentEvent.date).toLocaleDateString();
                
                this.eventTitleInput.value = this.currentEvent.title || '';
                this.eventNotesInput.value = this.currentEvent.notes || '';
                
                // Couleur
                const col = this.currentEvent.color || '#BFA98D';
                this.eventColorInput.value = col;
                const activeOpt = Array.from(this.colorOptions).find(o => o.dataset.color === col);
                if(activeOpt) activeOpt.classList.add('selected');
                else this.colorOptions[0].classList.add('selected');
                
                // Plan
                if (this.currentEvent.planSnapshot) {
                    this.tempSnapshot = this.currentEvent.planSnapshot;
                }
                // Attendance
                if (this.currentEvent.attendance) {
                    this.tempAttendance = { ...this.currentEvent.attendance };
                }

                // Charger les équipes
                await this.loadTeamsIntoSelect(this.currentEvent.teamId);

            } catch (e) { console.error(e); return; }
        } else {
            // --- CREATION ---
            this.recurrenceGroup.classList.remove('hidden');
            
            this.eventDateStrInput.value = dateStr;
            this.eventDateDisplay.textContent = new Date(dateStr).toLocaleDateString();
            this.eventTitleInput.value = '';
            this.eventNotesInput.value = '';
            
            this.eventColorInput.value = '#BFA98D';
            this.colorOptions[0].classList.add('selected');
            
            // Charger les équipes (défaut = 1ère)
            await this.loadTeamsIntoSelect(null);
        }
        
        this.updatePlanUI();
        this.updateAttendanceSummary();
        this.eventModal.classList.remove('hidden');
    },

    closeEventModal() {
        this.eventModal.classList.add('hidden');
        this.currentEvent = null;
        this.tempSnapshot = null;
        this.tempAttendance = {};
        this.snapshotPreviewImg.src = "";
    },

    updatePlanUI() {
        if (this.tempSnapshot) {
            this.planEmptyState.classList.add('hidden');
            this.planSelectedState.classList.remove('hidden');
            this.snapshotNameDisplay.textContent = this.tempSnapshot.name;
            
            if (this.tempSnapshot.playbooksData && this.tempSnapshot.playbooksData.length > 0) {
                const firstPB = this.tempSnapshot.playbooksData[0];
                if (firstPB.preview instanceof Blob) {
                    this.snapshotPreviewImg.src = URL.createObjectURL(firstPB.preview);
                    this.snapshotPreviewImg.classList.remove('hidden');
                    this.snapshotNoPreview.classList.add('hidden');
                } else {
                    this.snapshotPreviewImg.classList.add('hidden');
                    this.snapshotNoPreview.classList.remove('hidden');
                }
            } else {
                this.snapshotPreviewImg.classList.add('hidden');
                this.snapshotNoPreview.classList.remove('hidden');
            }

        } else {
            this.planEmptyState.classList.remove('hidden');
            this.planSelectedState.classList.add('hidden');
            this.snapshotPreviewImg.src = "";
        }
    },

    // --- GESTION PRÉSENCE (FILTRÉE PAR ÉQUIPE) ---
    async openAttendanceModal() {
        try {
            const teamId = parseInt(this.eventTeamSelect.value, 10);
            if(isNaN(teamId)) {
                alert("Veuillez sélectionner une équipe valide.");
                return;
            }

            const players = await orbDB.getAllPlayers();
            // FILTRE : On ne garde que les joueurs de cette équipe
            const teamPlayers = players.filter(p => p.teamId === teamId);

            this.attendanceList.innerHTML = '';
            if(teamPlayers.length === 0) {
                this.attendanceList.innerHTML = '<p style="text-align:center; opacity:0.7;">Aucun joueur dans cette équipe.</p>';
            } else {
                teamPlayers.sort((a,b) => a.lastName.localeCompare(b.lastName));
                teamPlayers.forEach(p => {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.justifyContent = 'space-between';
                    row.style.padding = '10px';
                    row.style.borderBottom = '1px solid #eee';
                    
                    const checked = this.tempAttendance[p.id] === true;
                    
                    row.innerHTML = `
                        <span style="font-weight:500;">${p.lastName.toUpperCase()} ${p.firstName}</span>
                        <input type="checkbox" value="${p.id}" ${checked ? 'checked' : ''} style="width:20px; height:20px; cursor:pointer;">
                    `;
                    this.attendanceList.appendChild(row);
                });
            }
            this.attendanceModal.classList.remove('hidden');
        } catch(e) { console.error(e); }
    },

    updateAttendanceSummary() {
        const count = Object.values(this.tempAttendance).filter(v => v === true).length;
        this.attendanceSummary.textContent = count > 0 ? `${count} présent(s)` : "Aucune présence notée";
    },

    // --- SAUVEGARDE ---
    async saveEvent() {
        const id = this.eventIdInput.value;
        const dateStr = this.eventDateStrInput.value;
        const title = this.eventTitleInput.value.trim() || 'Séance';
        const notes = this.eventNotesInput.value;
        const color = this.eventColorInput.value;
        const snapshot = this.tempSnapshot;
        const attendance = this.tempAttendance;
        const teamId = parseInt(this.eventTeamSelect.value, 10);

        const isRecurrent = this.recurrenceCheck.checked;
        const recurrenceEnd = this.recurrenceEndInput.value;

        // Plus de champ 'status', on garde le reste
        const baseData = { title, notes, color, planSnapshot: snapshot, attendance, teamId };

        try {
            if (id) {
                await orbDB.saveCalendarEvent({ id: parseInt(id, 10), date: dateStr, ...baseData });
            } else if (isRecurrent && recurrenceEnd) {
                // FIX DATE : 12:00 pour éviter décalage DST
                let currentDateLoop = new Date(dateStr);
                currentDateLoop.setHours(12, 0, 0, 0); 
                
                const endDate = new Date(recurrenceEnd);
                endDate.setHours(12, 0, 0, 0);

                const eventsToSave = [];
                
                while (currentDateLoop <= endDate) {
                    eventsToSave.push({
                        date: currentDateLoop.toISOString().split('T')[0],
                        ...baseData
                    });
                    // +7 jours
                    currentDateLoop.setDate(currentDateLoop.getDate() + 7);
                }
                await Promise.all(eventsToSave.map(evt => orbDB.saveCalendarEvent(evt)));
                alert(`${eventsToSave.length} séances créées !`);
            } else {
                await orbDB.saveCalendarEvent({ date: dateStr, ...baseData });
            }

            this.closeEventModal();
            this.renderCalendar();
        } catch (e) { console.error(e); alert("Erreur sauvegarde."); }
    },

    async deleteEvent() {
        const id = this.eventIdInput.value;
        if (!id) return;
        if (confirm("Supprimer cet événement ?")) {
            await orbDB.deleteCalendarEvent(parseInt(id, 10));
            this.closeEventModal();
            this.renderCalendar();
        }
    },

    // --- SÉLECTION DE PLAN ---
    async openPlanPicker() {
        try {
            const plans = await orbDB.getAllPlans();
            this.planPickerList.innerHTML = '';
            if (plans.length === 0) {
                this.planPickerList.innerHTML = '<p style="text-align:center; opacity:0.6;">Aucun plan trouvé.</p>';
            } else {
                plans.reverse().forEach(plan => {
                    const item = document.createElement('div');
                    item.className = 'plan-picker-item';
                    item.style.padding = '12px';
                    item.style.borderBottom = '1px solid #eee';
                    item.style.cursor = 'pointer';
                    item.innerHTML = `<div style="font-weight:bold;">${plan.name}</div><div style="font-size:0.8em; opacity:0.7;">Créé le ${new Date(plan.createdAt).toLocaleDateString()} - ${plan.playbookIds.length} exos</div>`;
                    item.addEventListener('click', () => this.selectPlanAsSnapshot(plan));
                    this.planPickerList.appendChild(item);
                });
            }
            this.planPickerModal.classList.remove('hidden');
        } catch (e) { console.error(e); }
    },

    async selectPlanAsSnapshot(plan) {
        try {
            const fullPlaybooks = [];
            for (const pbId of plan.playbookIds) {
                const pbData = await orbDB.getPlaybook(pbId);
                if (pbData) fullPlaybooks.push(pbData);
            }
            this.tempSnapshot = {
                originalPlanId: plan.id,
                name: plan.name,
                notes: plan.notes,
                capturedAt: new Date().toISOString(),
                playbooksData: fullPlaybooks 
            };
            this.planPickerModal.classList.add('hidden');
            this.updatePlanUI();
        } catch (e) { console.error(e); alert("Erreur snapshot."); }
    },

    // --- VIEWER ---
    openSnapshotViewer: function(snapshot) {
        this.viewerTitle.textContent = snapshot.name;
        this.viewerList.innerHTML = '';

        if (snapshot.playbooksData && snapshot.playbooksData.length > 0) {
            snapshot.playbooksData.forEach(pb => {
                const card = document.createElement('div');
                card.className = 'viewer-card';
                card.style.display = 'flex';
                card.style.alignItems = 'center';
                card.style.gap = '15px';
                card.style.padding = '10px';
                card.style.border = '1px solid #eee';
                card.style.borderRadius = '8px';
                card.style.background = 'var(--color-background)';

                let imgHtml = '<div style="width:80px; height:45px; background:#ccc; border-radius:4px;"></div>';
                if (pb.preview instanceof Blob) {
                    const url = URL.createObjectURL(pb.preview);
                    imgHtml = `<img src="${url}" style="width:80px; height:45px; object-fit:cover; border-radius:4px;">`;
                }

                card.innerHTML = `
                    ${imgHtml}
                    <div>
                        <div style="font-weight:bold;">${pb.name}</div>
                        <div style="font-size:0.8em; opacity:0.7;">${pb.playbookData.scenes.length} scènes</div>
                    </div>
                `;
                this.viewerList.appendChild(card);
            });
        } else {
            this.viewerList.innerHTML = '<p>Aucun exercice dans ce plan.</p>';
        }

        this.viewerModal.classList.remove('hidden');
    }
};