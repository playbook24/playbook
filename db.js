/**
 * db.js
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

            // --- VERSION 5 : Ajout des Équipes ---
            const request = indexedDB.open(this.dbName, 5); 

            request.onerror = (event) => {
                console.error("Erreur IndexedDB:", event.target.error);
                reject("Erreur d'ouverture BDD.");
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("Base de données (v5.2 - Complet) ouverte.");
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const transaction = event.target.transaction;

                // 1. Store 'playbooks' (Dessins)
                if (!db.objectStoreNames.contains('playbooks')) {
                    const store = db.createObjectStore('playbooks', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                    store.createIndex('tagIds', 'tagIds', { unique: false, multiEntry: true });
                } else {
                    // Mise à jour si l'index tagIds manque (pour les anciennes versions)
                    const store = transaction.objectStore('playbooks');
                    if (!store.indexNames.contains('tagIds')) {
                        store.createIndex('tagIds', 'tagIds', { unique: false, multiEntry: true });
                    }
                }

                // 2. Store 'trainingPlans' (Plans)
                if (!db.objectStoreNames.contains('trainingPlans')) {
                    const store = db.createObjectStore('trainingPlans', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // 3. Store 'tags' (Catégories)
                if (!db.objectStoreNames.contains('tags')) {
                    const store = db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: true });
                }

                // 4. Store 'calendarEvents' (Calendrier)
                if (!db.objectStoreNames.contains('calendarEvents')) {
                    const store = db.createObjectStore('calendarEvents', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('date', 'date', { unique: false });
                }
                
                // 5. Store 'players' (Joueurs)
                if (!db.objectStoreNames.contains('players')) {
                    const store = db.createObjectStore('players', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('lastName', 'lastName', { unique: false });
                }

                // 6. Store 'teams' (Équipes) - NOUVEAU
                if (!db.objectStoreNames.contains('teams')) {
                    const store = db.createObjectStore('teams', { keyPath: 'id', autoIncrement: true });
                    console.log("Store 'teams' créé.");
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
                // Mise à jour
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
                // Création
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
        // Récupère d'abord le playbook pour ne pas écraser les autres données
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
    // GESTION DU CALENDRIER (EVÉNEMENTS)
    // ==========================================

    async saveCalendarEvent(eventData) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['calendarEvents'], 'readwrite');
            const store = tx.objectStore('calendarEvents');
            // eventData contient : id, date, title, notes, color, planSnapshot, attendance, teamId...
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
    // GESTION DES ÉQUIPES (NOUVEAU)
    // ==========================================

    async saveTeam(teamData) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['teams'], 'readwrite');
            const store = tx.objectStore('teams');
            // teamData : { id, name }
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
    // GESTION DES JOUEURS (EFFECTIF)
    // ==========================================

    async savePlayer(playerData) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['players'], 'readwrite');
            const store = tx.objectStore('players');
            // playerData : { id, lastName, firstName, license, teamId, createdAt }
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

    // ==========================================
    // SAUVEGARDE ET IMPORTATION (BACKUP GLOBAL)
    // ==========================================

    async importBackupData(data) {
        if (!this.db) await this.open();

        // Fonction utilitaire pour convertir DataURL en Blob
        const dataURLToBlob = (dataURL) => {
            if (!dataURL || typeof dataURL !== 'string' || !dataURL.startsWith('data:')) return null; 
            try {
                const arr = dataURL.split(',');
                if (arr.length < 2) return null;
                const mimeMatch = arr[0].match(/:(.*?);/);
                if (!mimeMatch) return null;
                const mime = mimeMatch[1];
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while(n--) u8arr[n] = bstr.charCodeAt(n);
                return new Blob([u8arr], {type:mime});
            } catch (e) { return null; }
        };

        return new Promise((resolve, reject) => {
            // Liste de tous les stores gérés
            const storeNames = ['playbooks', 'tags', 'trainingPlans', 'calendarEvents', 'players', 'teams'];
            
            // On vérifie ceux qui existent vraiment dans la BDD actuelle (pour la compatibilité)
            const availableStores = [];
            for(let name of storeNames) {
                if (this.db.objectStoreNames.contains(name)) {
                    availableStores.push(name);
                }
            }

            const transaction = this.db.transaction(availableStores, 'readwrite');

            transaction.onerror = (event) => reject(event.target.error);
            transaction.oncomplete = () => resolve(true);

            try {
                // 1. VIDAGE DES TABLES EXISTANTES
                availableStores.forEach(store => {
                    transaction.objectStore(store).clear();
                });

                // 2. REMPLISSAGE AVEC LES DONNÉES DU BACKUP
                if (data.tags && availableStores.includes('tags')) {
                    data.tags.forEach(x => transaction.objectStore('tags').add(x));
                }
                if (data.trainingPlans && availableStores.includes('trainingPlans')) {
                    data.trainingPlans.forEach(x => transaction.objectStore('trainingPlans').add(x));
                }
                if (data.calendarEvents && availableStores.includes('calendarEvents')) {
                    data.calendarEvents.forEach(x => transaction.objectStore('calendarEvents').add(x));
                }
                if (data.players && availableStores.includes('players')) {
                    data.players.forEach(x => transaction.objectStore('players').add(x));
                }
                if (data.teams && availableStores.includes('teams')) {
                    data.teams.forEach(x => transaction.objectStore('teams').add(x));
                }
                
                // Gestion spéciale pour les playbooks (Blobs)
                if (data.playbooks && availableStores.includes('playbooks')) {
                    data.playbooks.forEach(pb => {
                        pb.preview = dataURLToBlob(pb.preview); 
                        transaction.objectStore('playbooks').add(pb);
                    });
                }

            } catch (error) {
                transaction.abort(); 
                reject(error);
            }
        });
    }
}

// Instance unique globale
const orbDB = new ORBDatabase();