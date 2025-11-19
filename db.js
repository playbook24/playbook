/**
 * db.js
 * VERSION STABLE (v4.5) - CORRECTION MAJEURE
 * Base de données : ORB_Playbook_Reset_v4
 *
 * CORRECTION v4.5 : 
 * - Réécriture de savePlaybook pour corriger le blocage lors de la mise à jour (écrasement).
 * - Correction de importBackupData (dataURLToBlob) pour gérer les dataURL nulles.
 */

class ORBDatabase {
    // NOM DE BDD DIFFÉRENT POUR FORCER LA RÉINITIALISATION
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

    // ---
    // --- FONCTION savePlaybook (Corrigée v4.5) ---
    // ---
    async savePlaybook(playbookData, previewBlob, id = null) {
        if (!this.db) await this.open();

        // La fonction entière est enveloppée dans une promesse
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['playbooks'], 'readwrite');
            const store = transaction.objectStore('playbooks');
            let record;

            if (id) {
                // --- MISE À JOUR (UPDATE) ---
                // 1. Récupérer l'enregistrement en utilisant la transaction ACTUELLE
                const getRequest = store.get(id);

                getRequest.onerror = (e) => {
                    console.error("Erreur (get) lors de la mise à jour:", e.target.error);
                    reject(e.target.error);
                };

                // 2. Lorsque la lecture réussit, créer le nouvel enregistrement
                getRequest.onsuccess = (e) => {
                    const existing = e.target.result;
                    if (!existing) {
                        reject(new Error(`Playbook avec ID ${id} introuvable.`));
                        return;
                    }

                    record = {
                        ...existing, // Conserve les anciens champs (tagIds, createdAt)
                        name: playbookData.name || 'Playbook sans nom',
                        playbookData: playbookData,
                        preview: previewBlob, // Remplace l'aperçu
                        id: id // S'assure que l'ID est correct
                    };

                    // 3. Remettre l'enregistrement dans la base (toujours dans la même transaction)
                    const putRequest = store.put(record);
                    putRequest.onsuccess = (e) => resolve(e.target.result); // Renvoie l'ID
                    putRequest.onerror = (e) => {
                        console.error("Erreur (put) lors de la mise à jour:", e.target.error);
                        reject(e.target.error);
                    };
                };

            } else {
                // --- NOUVEAU (CREATE) ---
                record = {
                    name: playbookData.name || 'Playbook sans nom',
                    playbookData: playbookData,
                    preview: previewBlob,
                    createdAt: new Date(),
                    tagIds: [] // Initialise avec un tableau vide
                };

                // 4. Ajouter le nouvel enregistrement
                const addRequest = store.add(record);
                addRequest.onsuccess = (e) => resolve(e.target.result); // Renvoie le nouvel ID
                addRequest.onerror = (e) => {
                    console.error("Erreur (add) lors de la création:", e.target.error);
                    reject(e.target.error);
                };
            }
        });
    }


    // --- Fonctions Playbook (Inchangées) ---
    async getAllPlaybooks() {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['playbooks'], 'readonly');
            tx.objectStore('playbooks').getAll().onsuccess = (e) => resolve(e.target.result);
            tx.onerror = (e) => reject(e.target.error); // Ajout d'un gestionnaire d'erreur
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

    // --- NOUVELLES FONCTIONS DE GESTION DES TAGS ---

    async getAllTags() {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['tags'], 'readonly');
            tx.objectStore('tags').getAll().onsuccess = (e) => resolve(e.target.result);
            tx.onerror = (e) => reject(e.target.error); // Ajout d'un gestionnaire d'erreur
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
        if (!playbook) {
            throw new Error("Playbook non trouvé.");
        }
        
        playbook.tagIds = tagIdsArray;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['playbooks'], 'readwrite');
            const store = transaction.objectStore('playbooks');
            const req = store.put(playbook);
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    // ---
    // --- FONCTION importBackupData (Corrigée v4.5) ---
    // ---
    async importBackupData(data) {
        if (!this.db) await this.open();

        // Fonction d'aide pour convertir un DataURL (base64) en Blob
        const dataURLToBlob = (dataURL) => {
            // Si ce n'est pas une chaîne ou pas une DataURL, on retourne null
            // C'est le cas pour les aperçus déjà corrompus dans le backup
            if (!dataURL || typeof dataURL !== 'string' || !dataURL.startsWith('data:')) {
                return null; 
            }
            
            try {
                const arr = dataURL.split(',');
                if (arr.length < 2) return null; // Format invalide
                
                const mimeMatch = arr[0].match(/:(.*?);/);
                if (!mimeMatch) return null; // Format invalide
                
                const mime = mimeMatch[1];
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                
                while(n--){
                    u8arr[n] = bstr.charCodeAt(n);
                }
                
                return new Blob([u8arr], {type:mime});
            } catch (e) {
                console.error("Échec de la conversion DataURL en Blob:", e);
                return null; // Retourne null en cas d'échec
            }
        };

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
                    data.playbooks.forEach(pb => {
                        // Reconvertit la chaîne base64 en Blob (ou null si corrompu)
                        pb.preview = dataURLToBlob(pb.preview); 
                        pbStore.add(pb);
                    });
                }
                
                if (data.trainingPlans) {
                    data.trainingPlans.forEach(plan => planStore.add(plan));
                }
                
                console.log("Nouvelles données en cours d'insertion...");

            } catch (error) {
                console.error("Erreur lors de l'ajout des données du backup:", error);
                transaction.abort(); 
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
}

// Crée une instance globale unique
const orbDB = new ORBDatabase();