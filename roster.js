/**
 * roster.js
 * Gère l'effectif des joueurs, les ÉQUIPES et les statistiques de présence.
 */

window.ORB.roster = {
    currentTeamId: null, // ID de l'équipe actuellement affichée

    init: function() {
        console.log("ORB Roster : Initialisation...");
        this.cacheDOM();
        if(!this.view) return; // Sécurité si le DOM n'est pas prêt
        this.bindEvents();
    },

    cacheDOM: function() {
        this.view = document.getElementById('roster-view');
        this.listContainer = document.getElementById('roster-list');
        
        // Formulaire Ajout Joueur
        this.inputLastName = document.getElementById('roster-lastname');
        this.inputFirstName = document.getElementById('roster-firstname');
        this.inputLicense = document.getElementById('roster-license');
        this.btnAdd = document.getElementById('btn-add-player');

        // Gestion Équipes
        this.teamSelect = document.getElementById('roster-team-select');
        this.btnCreateTeam = document.getElementById('btn-create-team');
    },

    bindEvents: function() {
        // Bouton ouverture (Header)
        const showBtn = document.getElementById('show-roster-btn');
        if (showBtn) {
            showBtn.addEventListener('click', () => {
                this.view.classList.remove('hidden');
                this.loadTeamsAndRoster();
            });
        }

        // Fermeture
        document.getElementById('roster-close-btn').addEventListener('click', () => {
            this.view.classList.add('hidden');
        });

        // Actions Joueurs
        this.btnAdd.addEventListener('click', () => this.addPlayer());
        
        // Actions Équipes
        this.btnCreateTeam.addEventListener('click', () => this.createTeam());
        
        this.teamSelect.addEventListener('change', (e) => {
            this.currentTeamId = parseInt(e.target.value, 10);
            this.loadRoster();
        });

        // Suppression Joueur (Délégation)
        this.listContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-delete-player');
            if (btn) {
                const id = parseInt(btn.dataset.id, 10);
                this.deletePlayer(id);
            }
        });
    },

    // Charge la liste des équipes dans le menu déroulant
    async loadTeamsAndRoster() {
        try {
            const teams = await orbDB.getAllTeams();
            this.teamSelect.innerHTML = '';
            
            if (teams.length === 0) {
                // Si aucune équipe, on en crée une par défaut pour ne pas bloquer
                const defaultTeamId = await orbDB.saveTeam({ name: 'Équipe 1' });
                this.currentTeamId = defaultTeamId;
                
                const opt = document.createElement('option');
                opt.value = defaultTeamId;
                opt.textContent = 'Équipe 1';
                this.teamSelect.appendChild(opt);
            } else {
                teams.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = t.name;
                    this.teamSelect.appendChild(opt);
                });
                
                // Si l'ID courant n'est pas valide, on prend le premier
                if (!this.currentTeamId || !teams.find(t => t.id === this.currentTeamId)) {
                    this.currentTeamId = teams[0].id;
                }
                this.teamSelect.value = this.currentTeamId;
            }
            
            // Une fois l'équipe calée, on charge les joueurs
            this.loadRoster();

        } catch (e) { console.error("Erreur chargement équipes:", e); }
    },

    async createTeam() {
        const name = prompt("Nom de la nouvelle équipe (ex: U15 Filles) :");
        if (name && name.trim() !== "") {
            try {
                const id = await orbDB.saveTeam({ name: name.trim() });
                this.currentTeamId = id;
                this.loadTeamsAndRoster(); // Recharge pour afficher la nouvelle équipe
            } catch (e) { 
                console.error(e);
                alert("Erreur lors de la création de l'équipe."); 
            }
        }
    },

    async loadRoster() {
        this.listContainer.innerHTML = '<p style="text-align:center; padding:20px;">Chargement...</p>';
        
        try {
            // On récupère TOUT (Joueurs et Evénements) pour calculer les stats
            const [players, events] = await Promise.all([
                orbDB.getAllPlayers(),
                orbDB.getAllCalendarEvents()
            ]);

            // 1. Filtrer les joueurs de l'équipe active
            const teamPlayers = players.filter(p => p.teamId === this.currentTeamId);
            
            this.listContainer.innerHTML = '';

            if (teamPlayers.length === 0) {
                this.listContainer.innerHTML = '<p class="library-empty-message">Aucun joueur dans cette équipe.</p>';
                return;
            }

            // 2. Filtrer les événements de l'équipe active pour les stats
            // On ne compte que les événements qui ont eu lieu (avec un appel fait)
            const teamEvents = events.filter(e => e.teamId === this.currentTeamId);
            const relevantEvents = teamEvents.filter(e => e.attendance && Object.keys(e.attendance).length > 0);
            const totalSessions = relevantEvents.length;

            // Tri alphabétique (Nom)
            teamPlayers.sort((a, b) => a.lastName.localeCompare(b.lastName));

            // 3. Générer l'affichage
            teamPlayers.forEach(p => {
                // Calcul du taux de présence
                let presentCount = 0;
                relevantEvents.forEach(evt => {
                    if (evt.attendance && evt.attendance[p.id] === true) presentCount++;
                });

                let presenceRate = 0;
                if (totalSessions > 0) {
                    presenceRate = Math.round((presentCount / totalSessions) * 100);
                }

                // Couleur de la barre
                let statColor = '#F44336'; // Rouge
                if (presenceRate >= 75) statColor = '#4CAF50'; // Vert
                else if (presenceRate >= 50) statColor = '#FF9800'; // Orange

                const card = document.createElement('div');
                card.className = 'roster-card';
                card.innerHTML = `
                    <div class="player-info">
                        <div class="player-name">${p.lastName.toUpperCase()} ${p.firstName}</div>
                        <div class="player-license">Licence : ${p.license || '-'}</div>
                    </div>
                    <div class="player-stats">
                        <div class="stat-bar-container" title="${presentCount}/${totalSessions} présences">
                            <div class="stat-bar-fill" style="width: ${presenceRate}%; background-color: ${statColor};"></div>
                        </div>
                        <div class="stat-text">${presenceRate}%</div>
                    </div>
                    <button class="btn-delete-player danger" data-id="${p.id}" title="Supprimer le joueur">
                        <svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2,0,0,0,8,21H16A2,2,0,0,0,18,19V7H6V19Z"/></svg>
                    </button>
                `;
                this.listContainer.appendChild(card);
            });

        } catch (e) {
            console.error(e);
            this.listContainer.innerHTML = '<p class="library-empty-message">Erreur de chargement.</p>';
        }
    },

    async addPlayer() {
        const lastName = this.inputLastName.value.trim();
        const firstName = this.inputFirstName.value.trim();
        const license = this.inputLicense.value.trim();

        if (!lastName || !firstName) {
            alert("Veuillez entrer au moins un Nom et un Prénom.");
            return;
        }
        if (!this.currentTeamId) {
            alert("Veuillez d'abord créer ou sélectionner une équipe.");
            return;
        }

        try {
            await orbDB.savePlayer({
                lastName, 
                firstName, 
                license,
                teamId: this.currentTeamId, // On lie le joueur à l'équipe active
                createdAt: new Date()
            });
            
            // Reset champs
            this.inputLastName.value = '';
            this.inputFirstName.value = '';
            this.inputLicense.value = '';
            
            this.loadRoster();
        } catch (e) {
            console.error(e);
            alert("Erreur lors de l'ajout du joueur.");
        }
    },

    async deletePlayer(id) {
        if (confirm("Voulez-vous vraiment supprimer ce joueur ?")) {
            try {
                await orbDB.deletePlayer(id);
                this.loadRoster();
            } catch (e) {
                console.error(e);
                alert("Erreur lors de la suppression.");
            }
        }
    }
};

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    if(window.ORB && window.ORB.roster) window.ORB.roster.init();
});