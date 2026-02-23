/**
 * core/db.js
 * VERSION MULTI-EQUIPES (v5.2) - COMPLET
 * Base de données : ORB_Playbook_Reset_v4
 *
 * Ce fichier gère TOUTES les données de l'application :
 * - Playbooks (Dessins)
 * - Tags (Catégories)
 * - Plans d'entraînement
 * - Calendrier (Événements)
 * - Joueurs (Effectif)
 * - Équipes (Nouveau)
 */

class ORBDatabase {
    constructor(dbName = 'ORB_Playbook_Reset_v4', storeName = 'playbooks') {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
    }

    async open() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }

            const request = indexedDB.open(this.dbName, 5); 

            request.onerror = (event) => {
                console.error("Erreur IndexedDB:", event.target.error);
                reject("Erreur d'ouverture BDD.");
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("Base de données ouverte.");
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const transaction = event.target.transaction;

                // 1. Store 'playbooks'
                if (!db.objectStoreNames.contains('playbooks')) {
                    const store = db.createObjectStore('playbooks', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                    store.createIndex('tagIds', 'tagIds', { unique: false, multiEntry: true });
                } else {
                    const store = transaction.objectStore('playbooks');
                    if (!store.indexNames.contains('tagIds')) {
                        store.createIndex('tagIds', 'tagIds', { unique: false, multiEntry: true });
                    }
                }

                // 2. Store 'trainingPlans'
                if (!db.objectStoreNames.contains('trainingPlans')) {
                    const store = db.createObjectStore('trainingPlans', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // 3. Store 'tags'
                if (!db.objectStoreNames.contains('tags')) {
                    const store = db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: true });
                }

                // 4. Store 'calendarEvents'
                if (!db.objectStoreNames.contains('calendarEvents')) {
                    const store = db.createObjectStore('calendarEvents', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('date', 'date', { unique: false });
                }
                
                // 5. Store 'players'
                if (!db.objectStoreNames.contains('players')) {
                    const store = db.createObjectStore('players', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('lastName', 'lastName', { unique: false });
                }

                // 6. Store 'teams'
                if (!db.objectStoreNames.contains('teams')) {
                    const store = db.createObjectStore('teams', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    // ==========================================
    // GESTION DES PLAYBOOKS (SCHÉMAS)
    // ==========================================
    async savePlaybook(playbookData, previewBlob, id = null) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['playbooks'], 'readwrite');
            const store = transaction.objectStore('playbooks');
            let record;

            if (id) {
                const getRequest = store.get(id);
                getRequest.onerror = (e) => reject(e.target.error);
                getRequest.onsuccess = (e) => {
                    const existing = e.target.result;
                    if (!existing) { 
                        reject(new Error(`Playbook ${id} introuvable.`)); 
                        return; 
                    }
                    record = {
                        ...existing,
                        name: playbookData.name || 'Playbook sans nom',
                        playbookData: playbookData,
                        preview: previewBlob,
                        id: id
                    };
                    const putRequest = store.put(record);
                    putRequest.onsuccess = (e) => resolve(e.target.result);
                    putRequest.onerror = (e) => reject(e.target.error);
                };
            } else {
                record = {
                    name: playbookData.name || 'Playbook sans nom',
                    playbookData: playbookData,
                    preview: previewBlob,
                    createdAt: new Date(),
                    tagIds: []
                };
                const addRequest = store.add(record);
                addRequest.onsuccess = (e) => resolve(e.target.result);
                addRequest.onerror = (e) => reject(e.target.error);
            }
        });
    }

    async getAllPlaybooks() {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['playbooks'], 'readonly');
            tx.objectStore('playbooks').getAll().onsuccess = (e) => resolve(e.target.result);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async getPlaybook(id) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['playbooks'], 'readonly');
            tx.objectStore('playbooks').get(id).onsuccess = (e) => resolve(e.target.result);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async deletePlaybook(id) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['playbooks'], 'readwrite');
            tx.objectStore('playbooks').delete(id).onsuccess = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async assignTagsToPlaybook(playbookId, tagIdsArray) {
        if (!this.db) await this.open();
        const playbook = await this.getPlaybook(playbookId);
        if (!playbook) throw new Error("Playbook non trouvé.");
        
        playbook.tagIds = tagIdsArray;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['playbooks'], 'readwrite');
            const store = transaction.objectStore('playbooks');
            const req = store.put(playbook);
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    // ==========================================
    // GESTION DES TAGS
    // ==========================================
    async getAllTags() {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['tags'], 'readonly');
            tx.objectStore('tags').getAll().onsuccess = (e) => resolve(e.target.result);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async addTag(name) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['tags'], 'readwrite');
            const req = tx.objectStore('tags').add({ name: name });
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error); 
        });
    }

    async deleteTag(id) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['tags'], 'readwrite');
            const req = tx.objectStore('tags').delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    // ==========================================
    // GESTION DES PLANS D'ENTRAÎNEMENT
    // ==========================================
    async savePlan(planData, id = null) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['trainingPlans'], 'readwrite');
            const store = tx.objectStore('trainingPlans');
            const record = {
                name: planData.name || 'Plan sans nom',
                playbookIds: planData.playbookIds || [],
                notes: planData.notes || '',
                createdAt: planData.createdAt || new Date()
            };
            if (id) record.id = id;
            
            const req = id ? store.put(record) : store.add(record);
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllPlans() {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['trainingPlans'], 'readonly');
            tx.objectStore('trainingPlans').getAll().onsuccess = (e) => resolve(e.target.result);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async getPlan(id) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['trainingPlans'], 'readonly');
            tx.objectStore('trainingPlans').get(id).onsuccess = (e) => resolve(e.target.result);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async deletePlan(id) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['trainingPlans'], 'readwrite');
            tx.objectStore('trainingPlans').delete(id).onsuccess = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // ==========================================
    // GESTION DU CALENDRIER
    // ==========================================
    async saveCalendarEvent(eventData) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['calendarEvents'], 'readwrite');
            const store = tx.objectStore('calendarEvents');
            const req = eventData.id ? store.put(eventData) : store.add(eventData);
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllCalendarEvents() {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['calendarEvents'], 'readonly');
            tx.objectStore('calendarEvents').getAll().onsuccess = (e) => resolve(e.target.result);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteCalendarEvent(id) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['calendarEvents'], 'readwrite');
            tx.objectStore('calendarEvents').delete(id).onsuccess = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // ==========================================
    // GESTION DES ÉQUIPES
    // ==========================================
    async saveTeam(teamData) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['teams'], 'readwrite');
            const store = tx.objectStore('teams');
            const req = teamData.id ? store.put(teamData) : store.add(teamData);
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllTeams() {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['teams'], 'readonly');
            tx.objectStore('teams').getAll().onsuccess = (e) => resolve(e.target.result);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteTeam(id) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['teams'], 'readwrite');
            tx.objectStore('teams').delete(id).onsuccess = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // ==========================================
    // GESTION DES JOUEURS
    // ==========================================
    async savePlayer(playerData) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['players'], 'readwrite');
            const store = tx.objectStore('players');
            const req = playerData.id ? store.put(playerData) : store.add(playerData);
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllPlayers() {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['players'], 'readonly');
            tx.objectStore('players').getAll().onsuccess = (e) => resolve(e.target.result);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async deletePlayer(id) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['players'], 'readwrite');
            tx.objectStore('players').delete(id).onsuccess = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);
        });
    }
}

// Instance unique globale
const orbDB = new ORBDatabase();