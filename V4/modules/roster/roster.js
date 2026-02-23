/**
 * modules/roster/roster.js
 */
const RosterModule = {
    currentTeamId: null,

    async init() {
        this.cacheDOM();
        this.bindEvents();
        await orbDB.open(); // Initialisation de la base de données
        await this.loadTeams();
    },

    cacheDOM() {
        this.teamSelect = document.getElementById('roster-team-select');
        this.listContainer = document.getElementById('roster-list');
        this.inputLastName = document.getElementById('roster-lastname');
        this.inputFirstName = document.getElementById('roster-firstname');
        this.inputLicense = document.getElementById('roster-license');
    },

    bindEvents() {
        this.teamSelect.addEventListener('change', (e) => {
            this.currentTeamId = parseInt(e.target.value, 10);
            this.loadRoster();
        });

        document.getElementById('btn-add-player').onclick = () => this.addPlayer();
        document.getElementById('btn-create-team').onclick = () => this.createTeam();
    },

    async loadTeams() {
        const teams = await orbDB.getAllTeams();
        this.teamSelect.innerHTML = '';
        if (teams.length === 0) {
            const defaultId = await orbDB.saveTeam({ name: 'Équipe 1' });
            this.currentTeamId = defaultId;
        } else {
            this.currentTeamId = teams[0].id;
        }
        
        teams.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            if(t.id === this.currentTeamId) opt.selected = true;
            this.teamSelect.appendChild(opt);
        });
        this.loadRoster();
    },

    async loadRoster() {
        this.listContainer.innerHTML = '<p>Chargement...</p>';
        const [players, events] = await Promise.all([
            orbDB.getAllPlayers(),
            orbDB.getAllCalendarEvents()
        ]);

        const teamPlayers = players.filter(p => p.teamId === this.currentTeamId);
        this.listContainer.innerHTML = '';

        if (teamPlayers.length === 0) {
            this.listContainer.innerHTML = '<p>Aucun joueur dans cette équipe.</p>';
            return;
        }

        teamPlayers.forEach(p => {
            const card = document.createElement('div');
            card.className = 'roster-card';
            card.innerHTML = `
                <div class="player-info">
                    <div class="player-name">${p.lastName.toUpperCase()} ${p.firstName}</div>
                    <div class="player-license">Licence : ${p.license || '-'}</div>
                </div>
                <button class="danger" onclick="RosterModule.deletePlayer(${p.id})">Supprimer</button>
            `;
            this.listContainer.appendChild(card);
        });
    },

    async addPlayer() {
        const lastName = this.inputLastName.value.trim();
        const firstName = this.inputFirstName.value.trim();
        if (!lastName || !firstName) return alert("Nom et prénom requis");

        await orbDB.savePlayer({
            lastName, firstName, 
            license: this.inputLicense.value,
            teamId: this.currentTeamId,
            createdAt: new Date()
        });
        
        this.inputLastName.value = '';
        this.inputFirstName.value = '';
        this.loadRoster();
    },

    async deletePlayer(id) {
        if(confirm("Supprimer ce joueur ?")) {
            await orbDB.deletePlayer(id);
            this.loadRoster();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => RosterModule.init());