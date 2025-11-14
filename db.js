/**
 * db.js
 * VERSION STABLE (v4) - MISE À JOUR v2 : Ajout des Tags Gérés
 * Base de données : ORB_Playbook_Reset_v4
 *
 * CORRECTION v2.1 : Correction du bug dans assignTagsToPlaybook
 */

class ORBDatabase {
    // On garde le même nom de base
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

            // --- Passage à la version 2 ---
            const request = indexedDB.open(this.dbName, 2); 

            request.onerror = (event) => {
                console.error("Erreur IndexedDB (v4.2):", event.target.error);
                reject("Erreur d'ouverture BDD.");
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("Base de données (v4.2 - Tags Gérés) ouverte.");
                resolve(this.db);
            };

            /**
             * MISE À JOUR : Ajout du store 'tags' et de l'index 'tagIds'
             */
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const transaction = event.target.transaction;

                // 1. Store 'playbooks' (Mise à jour)
                let playbookStore;
                if (!db.objectStoreNames.contains('playbooks')) {
                    playbookStore = db.createObjectStore('playbooks', { keyPath: 'id', autoIncrement: true });
                    playbookStore.createIndex('name', 'name', { unique: false });
                    playbookStore.createIndex('createdAt', 'createdAt', { unique: false });
                } else {
                    playbookStore = transaction.objectStore('playbooks');
                }
                
                // NOUVEL INDEX pour lier les playbooks aux tags
                if (!playbookStore.indexNames.contains('tagIds')) {
                    // multiEntry: true permet d'indexer chaque ID dans le tableau [1, 2, 3]
                    playbookStore.createIndex('tagIds', 'tagIds', { unique: false, multiEntry: true });
                    console.log("Index 'tagIds' créé pour 'playbooks'.");
                }


                // 2. Store 'trainingPlans' (Inchangé)
                if (!db.objectStoreNames.contains('trainingPlans')) {
                    const store = db.createObjectStore('trainingPlans', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // 3. NOUVEAU STORE : 'tags'
                if (!db.objectStoreNames.contains('tags')) {
                    const tagsStore = db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true });
                    // 'name' doit être unique pour ne pas avoir "Attaque" deux fois
                    tagsStore.createIndex('name', 'name', { unique: true });
                    console.log("Store 'tags' créé.");
                }
            };
        });
    }

    // --- Sauvegarde Playbook (Modifié pour préserver/initialiser tagIds) ---
    async savePlaybook(playbookData, previewBlob, id = null) {
        if (!this.db) await this.open();

        return new Promise(async (resolve, reject) => {
            const transaction = this.db.transaction(['playbooks'], 'readwrite');
            const store = transaction.objectStore('playbooks');
            
            let record;

            if (id) {
                // MISE À JOUR : On récupère l'ancien pour ne pas écraser les tagIds
                const existing = await this.getPlaybook(id);
                record = {
                    ...existing, // Conserve les anciens champs (comme tagIds)
                    name: playbookData.name || 'Playbook sans nom',
                    playbookData: playbookData,
                    preview: previewBlob,
                    id: id // S'assure que l'ID est correct
                };
            } else {
                // NOUVEAU : On initialise tagIds
                record = {
                    name: playbookData.name || 'Playbook sans nom',
                    playbookData: playbookData,
                    preview: previewBlob,
                    createdAt: new Date(),
                    tagIds: [] // Initialise avec un tableau vide
                };
            }

            const request = store.put(record); // 'put' gère à la fois la création et la mise à jour
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- Fonctions Playbook (Inchangées) ---
    async getAllPlaybooks() {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['playbooks'], 'readonly');
            tx.objectStore('playbooks').getAll().onsuccess = (e) => resolve(e.target.result);
        });
    }
    async getPlaybook(id) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['playbooks'], 'readonly');
            tx.objectStore('playbooks').get(id).onsuccess = (e) => resolve(e.target.result);
        });
    }
    async deletePlaybook(id) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['playbooks'], 'readwrite');
            tx.objectStore('playbooks').delete(id).onsuccess = () => resolve(true);
        });
    }

    // --- NOUVELLES FONCTIONS DE GESTION DES TAGS ---

    /**
     * Récupère la liste de tous les tags maîtres.
     */
    async getAllTags() {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['tags'], 'readonly');
            tx.objectStore('tags').getAll().onsuccess = (e) => resolve(e.target.result);
        });
    }

    /**
     * Ajoute un nouveau tag à la liste maître.
     * @param {string} name Le nom du tag (ex: "Attaque")
     */
    async addTag(name) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['tags'], 'readwrite');
            const req = tx.objectStore('tags').add({ name: name });
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error); // Échouera si le nom existe déjà
        });
    }

    /**
     * Supprime un tag de la liste maître.
     * @param {number} id L'ID du tag à supprimer
     */
    async deleteTag(id) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['tags'], 'readwrite');
            const req = tx.objectStore('tags').delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * CORRIGÉ : Assigne un tableau d'ID de tags à un playbook.
     * @param {number} playbookId L'ID du playbook à mettre à jour
     * @param {number[]} tagIdsArray Le tableau d'IDs (ex: [1, 3, 5])
     */
    async assignTagsToPlaybook(playbookId, tagIdsArray) {
        if (!this.db) await this.open();

        // 1. Récupérer le playbook (l'await est maintenant à l'extérieur)
        const playbook = await this.getPlaybook(playbookId);
        if (!playbook) {
            throw new Error("Playbook non trouvé.");
        }
        
        // 2. Mettre à jour ses tagIds
        playbook.tagIds = tagIdsArray;

        // 3. Ouvrir une transaction et sauvegarder (put)
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['playbooks'], 'readwrite');
            const store = transaction.objectStore('playbooks');
            const req = store.put(playbook);
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * NOUVEAU : Efface toutes les données et les remplace par les données du backup.
     * @param {object} data - L'objet contenant { playbooks: [], tags: [], trainingPlans: [] }
     */
    async importBackupData(data) {
        if (!this.db) await this.open();

        return new Promise((resolve, reject) => {
            const storeNames = ['playbooks', 'tags', 'trainingPlans'];
            const transaction = this.db.transaction(storeNames, 'readwrite');

            transaction.onerror = (event) => {
                console.error("Erreur de transaction lors de l'import:", event.target.error);
                reject(event.target.error);
            };
            transaction.oncomplete = () => {
                console.log("Importation du backup terminée avec succès.");
                resolve(true);
            };

            try {
                // 1. Vider toutes les tables
                const pbStore = transaction.objectStore('playbooks');
                pbStore.clear();
                const tagStore = transaction.objectStore('tags');
                tagStore.clear();
                const planStore = transaction.objectStore('trainingPlans');
                planStore.clear();
                
                console.log("Anciennes données effacées.");

                // 2. Ré-insérer les données du backup
                if (data.tags) {
                    data.tags.forEach(tag => tagStore.add(tag));
                }
                if (data.playbooks) {
                    data.playbooks.forEach(pb => pbStore.add(pb));
                }
                if (data.trainingPlans) {
                    data.trainingPlans.forEach(plan => planStore.add(plan));
                }
                
                console.log("Nouvelles données en cours d'insertion...");

            } catch (error) {
                console.error("Erreur lors de l'ajout des données du backup:", error);
                transaction.abort(); // Annule la transaction en cas d'erreur
                reject(error);
            }
        });
    }

    // --- Fonctions Plans (Inchangées) ---
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
        });
    }
    async getPlan(id) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['trainingPlans'], 'readonly');
            tx.objectStore('trainingPlans').get(id).onsuccess = (e) => resolve(e.target.result);
        });
    }
    async deletePlan(id) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['trainingPlans'], 'readwrite');
            tx.objectStore('trainingPlans').delete(id).onsuccess = () => resolve(true);
        });
    }
}

// Crée une instance globale unique
const orbDB = new ORBDatabase();