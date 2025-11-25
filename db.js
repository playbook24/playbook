/**
 * db.js
 * VERSION AVEC CALENDRIER (v5.0)
 * Base de données : ORB_Playbook_Reset_v4
 *
 * MODIFICATIONS :
 * - Version IndexedDB passée à 3.
 * - Ajout du store 'calendarEvents' pour stocker les entraînements et les snapshots de plans.
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

            // --- PASSAGE EN VERSION 3 pour ajouter le calendrier ---
            const request = indexedDB.open(this.dbName, 3); 

            request.onerror = (event) => {
                console.error("Erreur IndexedDB:", event.target.error);
                reject("Erreur d'ouverture BDD.");
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("Base de données (v5.0 - Calendrier) ouverte.");
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const transaction = event.target.transaction;

                // 1. Store 'playbooks'
                let playbookStore;
                if (!db.objectStoreNames.contains('playbooks')) {
                    playbookStore = db.createObjectStore('playbooks', { keyPath: 'id', autoIncrement: true });
                    playbookStore.createIndex('name', 'name', { unique: false });
                    playbookStore.createIndex('createdAt', 'createdAt', { unique: false });
                } else {
                    playbookStore = transaction.objectStore('playbooks');
                }
                
                if (!playbookStore.indexNames.contains('tagIds')) {
                    playbookStore.createIndex('tagIds', 'tagIds', { unique: false, multiEntry: true });
                }

                // 2. Store 'trainingPlans'
                if (!db.objectStoreNames.contains('trainingPlans')) {
                    const store = db.createObjectStore('trainingPlans', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // 3. Store 'tags'
                if (!db.objectStoreNames.contains('tags')) {
                    const tagsStore = db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true });
                    tagsStore.createIndex('name', 'name', { unique: true });
                }

                // 4. NOUVEAU STORE : 'calendarEvents'
                if (!db.objectStoreNames.contains('calendarEvents')) {
                    const eventStore = db.createObjectStore('calendarEvents', { keyPath: 'id', autoIncrement: true });
                    // On indexe par date pour retrouver facilement les entraînements d'un mois
                    eventStore.createIndex('date', 'date', { unique: false });
                    console.log("Store 'calendarEvents' créé.");
                }
            };
        });
    }

    // --- Fonctions Playbooks ---
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
                    if (!existing) { reject(new Error(`Playbook ${id} introuvable.`)); return; }
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

    // --- Fonctions Tags ---
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

    // --- Fonctions Plans ---
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

    // --- NOUVEAU : Fonctions CALENDRIER ---

    // Sauvegarde un événement avec une date et (optionnel) un Snapshot du plan
    async saveCalendarEvent(eventData) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['calendarEvents'], 'readwrite');
            const store = tx.objectStore('calendarEvents');
            
            // eventData contiendra : { id (si edit), dateString, title, planSnapshot: {...} }
            const req = eventData.id ? store.put(eventData) : store.add(eventData);
            
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    // Récupère tous les événements (on filtrera par mois en JS pour simplifier)
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

    // --- Import / Backup ---
    async importBackupData(data) {
        if (!this.db) await this.open();

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
            // Ajout de 'calendarEvents' à la liste des stores à nettoyer/importer
            const storeNames = ['playbooks', 'tags', 'trainingPlans', 'calendarEvents'];
            
            // On vérifie que les stores existent (pour éviter erreur si on importe un vieux backup sur une vieille BDD)
            const availableStores = [];
            for(let name of storeNames) {
                if (this.db.objectStoreNames.contains(name)) availableStores.push(name);
            }

            const transaction = this.db.transaction(availableStores, 'readwrite');

            transaction.onerror = (event) => reject(event.target.error);
            transaction.oncomplete = () => resolve(true);

            try {
                // Vidage
                if(availableStores.includes('playbooks')) transaction.objectStore('playbooks').clear();
                if(availableStores.includes('tags')) transaction.objectStore('tags').clear();
                if(availableStores.includes('trainingPlans')) transaction.objectStore('trainingPlans').clear();
                if(availableStores.includes('calendarEvents')) transaction.objectStore('calendarEvents').clear();

                // Remplissage
                if (data.tags && availableStores.includes('tags')) {
                    data.tags.forEach(tag => transaction.objectStore('tags').add(tag));
                }
                if (data.playbooks && availableStores.includes('playbooks')) {
                    data.playbooks.forEach(pb => {
                        pb.preview = dataURLToBlob(pb.preview); 
                        transaction.objectStore('playbooks').add(pb);
                    });
                }
                if (data.trainingPlans && availableStores.includes('trainingPlans')) {
                    data.trainingPlans.forEach(plan => transaction.objectStore('trainingPlans').add(plan));
                }
                // Import Calendrier
                if (data.calendarEvents && availableStores.includes('calendarEvents')) {
                    data.calendarEvents.forEach(evt => transaction.objectStore('calendarEvents').add(evt));
                }

            } catch (error) {
                transaction.abort(); 
                reject(error);
            }
        });
    }
}

const orbDB = new ORBDatabase();