/**
 * manager.js
 * Gère la bibliothèque avec le NOUVEAU système de Tags Gérés (v4.2)
 *
 * CORRECTION v4.5 : 
 * - Envoie l'enregistrement complet (avec ID) lors du chargement.
 * - Gestion d'erreur robuste (v4.4) pour les cartes.
 */

function initManager() {
    if (typeof orbDB === 'undefined' || !orbDB) {
        console.error("ERREUR : orbDB n'est pas défini.");
        return;
    }

    // --- Références DOM (Bibliothèque) ---
    const libraryView = document.getElementById('library-view');
    const libraryGrid = document.getElementById('library-grid');
    const showLibraryBtn = document.getElementById('show-library-btn');
    const closeLibraryBtn = document.getElementById('library-close-btn');
    const libraryFilters = document.getElementById('library-filters');
    const btnManageTags = document.getElementById('btn-manage-tags');

    // --- Références DOM (Modale "Gérer") ---
    const manageTagsModal = document.getElementById('manage-tags-modal');
    const manageTagsCloseBtn = document.getElementById('manage-tags-close-btn');
    const newTagInput = document.getElementById('new-tag-name-input');
    const addNewTagBtn = document.getElementById('btn-add-new-tag');
    const masterTagList = document.getElementById('master-tag-list');

    // --- Références DOM (Modale "Assigner") ---
    const assignTagsModal = document.getElementById('assign-tags-modal');
    const assignTagsTitle = document.getElementById('assign-tags-title');
    const assignTagsCloseBtn = document.getElementById('assign-tags-close-btn');
    const assignTagsList = document.getElementById('assign-tags-list');
    const saveTagAssignmentBtn = document.getElementById('btn-save-tag-assignment');

    // --- État de la bibliothèque ---
    let allPlaybooks = [];
    let allTags = [];
    let activeFilterTagId = null; // 'null' pour "Tout voir"
    let currentPlaybookToTag = null; // Stocke le playbook en cours d'édition

    // --- Écouteurs d'événements (Bibliothèque) ---
    showLibraryBtn.addEventListener('click', () => {
        libraryView.classList.remove('hidden');
        loadLibrary();
    });

    closeLibraryBtn.addEventListener('click', () => {
        libraryView.classList.add('hidden');
    });

    btnManageTags.addEventListener('click', () => {
        openManageTagsModal();
    });

    // --- Écouteurs d'événements (Modale "Gérer") ---
    manageTagsCloseBtn.addEventListener('click', () => {
        manageTagsModal.classList.add('hidden');
    });

    addNewTagBtn.addEventListener('click', async () => {
        const name = newTagInput.value.trim();
        if (name) {
            try {
                await orbDB.addTag(name);
                newTagInput.value = '';
                await updateTagsCache(); // Met à jour notre cache local
                renderMasterTagList(); // Redessine la liste des tags
            } catch (e) {
                alert("Erreur : Ce tag existe déjà ou un problème est survenu.");
            }
        }
    });
    
    // Clic "Supprimer" dans la liste des tags maîtres
    masterTagList.addEventListener('click', async (e) => {
        if (e.target.closest('.tag-delete-btn')) {
            const tagId = parseInt(e.target.closest('li').dataset.id, 10);
            if (confirm("Voulez-vous vraiment supprimer ce tag ? Il sera retiré de tous les playbooks.")) {
                await orbDB.deleteTag(tagId);
                // On doit aussi le retirer de tous les playbooks
                allPlaybooks.forEach(pb => {
                    if (pb.tagIds && pb.tagIds.includes(tagId)) {
                        pb.tagIds = pb.tagIds.filter(id => id !== tagId);
                        orbDB.assignTagsToPlaybook(pb.id, pb.tagIds); // Met à jour en arrière-plan
                    }
                });
                await updateTagsCache();
                renderMasterTagList();
                renderFilters(); // Met à jour les filtres de la bibliothèque
            }
        }
    });

    // --- Écouteurs d'événements (Modale "Assigner") ---
    assignTagsCloseBtn.addEventListener('click', () => {
        assignTagsModal.classList.add('hidden');
    });

    saveTagAssignmentBtn.addEventListener('click', async () => {
        if (!currentPlaybookToTag) return;

        const selectedTagIds = [];
        assignTagsList.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            selectedTagIds.push(parseInt(checkbox.value, 10));
        });

        try {
            await orbDB.assignTagsToPlaybook(currentPlaybookToTag.id, selectedTagIds);
            assignTagsModal.classList.add('hidden');
            loadLibrary(); // Recharge la bibliothèque pour afficher les changements
        } catch (e) {
            alert("Erreur lors de la sauvegarde des tags.");
        }
    });

    /**
     * Charge TOUTES les données (playbooks et tags) et rafraîchit l'UI.
     */
    async function loadLibrary() {
        activeFilterTagId = null; // Réinitialise le filtre
        libraryGrid.innerHTML = '';
        
        try {
            // 1. Récupérer toutes les données en parallèle
            [allPlaybooks, allTags] = await Promise.all([
                orbDB.getAllPlaybooks(),
                orbDB.getAllTags()
            ]);
            
            if (allPlaybooks.length === 0) {
                libraryGrid.innerHTML = '<p class="library-empty-message">La bibliothèque est vide.</p>';
            }

            // 2. Générer les boutons de filtre
            renderFilters();
            // 3. Afficher la grille (tous les playbooks par défaut)
            renderGrid();

        } catch (error) {
            console.error("Erreur lors du chargement de la bibliothèque:", error);
            libraryGrid.innerHTML = '<p class="library-empty-message">Erreur lors du chargement de la bibliothèque.</p>';
        }
    }

    /**
     * Met à jour le cache local 'allTags'
     */
    async function updateTagsCache() {
        allTags = await orbDB.getAllTags();
    }

    /**
     * Crée les boutons de filtre en fonction des tags maîtres.
     */
    function renderFilters() {
        libraryFilters.innerHTML = ''; // Vide les filtres existants

        // Crée le bouton "Tout voir"
        const allBtn = document.createElement('button');
        allBtn.textContent = "Tout voir";
        allBtn.className = (activeFilterTagId === null) ? 'btn-primary' : '';
        allBtn.onclick = () => {
            activeFilterTagId = null;
            renderFilters();
            renderGrid();
        };
        libraryFilters.appendChild(allBtn);

        // Crée un bouton pour chaque tag
        allTags.forEach(tag => {
            const tagBtn = document.createElement('button');
            tagBtn.textContent = tag.name;
            tagBtn.className = (activeFilterTagId === tag.id) ? 'btn-primary' : '';
            tagBtn.onclick = () => {
                activeFilterTagId = tag.id;
                renderFilters();
                renderGrid();
            };
            libraryFilters.appendChild(tagBtn);
        });
    }

    /**
     * Affiche les playbooks dans la grille en fonction du filtre 'activeFilterTagId'.
     */
    function renderGrid() {
        libraryGrid.innerHTML = '';

        // Filtre les playbooks (logique de filtrage sécurisée)
        const filteredPlaybooks = (activeFilterTagId === null)
            ? allPlaybooks // Si pas de tag actif, on montre tout
            : allPlaybooks.filter(pb => pb.tagIds && pb.tagIds.includes(activeFilterTagId));

        if (filteredPlaybooks.length === 0) {
            libraryGrid.innerHTML = '<p class="library-empty-message">Aucun playbook ne correspond à ce filtre.</p>';
            return;
        }

        // Affiche les playbooks filtrés
        filteredPlaybooks.reverse().forEach(playbook => {
            try {
                // On essaie de créer la carte
                const card = createPlaybookCard(playbook);
                libraryGrid.appendChild(card);
            } catch (error) {
                // Si la création d'UNE carte échoue (à cause du Blob corrompu)
                // On affiche une carte d'erreur mais on ne plante pas tout.
                console.error("Impossible de créer la carte pour le playbook:", playbook.name, error);
                
                const errorCard = document.createElement('div');
                errorCard.className = 'playbook-card';
                // On met l'ID pour pouvoir le supprimer/charger
                if (playbook && typeof playbook.id !== 'undefined') {
                    errorCard.dataset.id = playbook.id;
                }
                
                errorCard.innerHTML = `
                    <div class="card-preview" style="background: #D32F2F; display: flex; align-items: center; justify-content: center; color: white; padding: 10px; text-align: center; aspect-ratio: 280 / 150;">
                        <svg viewBox="0 0 24 24" style="width: 40px; height: 40px; fill: white;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    </div>
                    <div class="card-info">
                        <h3 style="color: #D32F2F;">${playbook.name || "Playbook corrompu"}</h3>
                        <p>Aperçu illisible. Chargez-le et re-sauvegardez-le pour le réparer.</p>
                    </div>
                    <div class="card-actions">
                        <button class="card-btn-load" title="Charger"><svg viewBox="0 0 24 24"><path d="M9 3v10H6l6 7l6-7h-3V3H9z"/></svg></button>
                        <button class="card-btn-assign-tags" title="Assigner des tags"><svg viewBox="0 0 24 24"><path d="M5.5,7A1.5,1.5 0 0,0 7,5.5A1.5,1.5 0 0,0 5.5,4A1.5,1.5 0 0,0 4,5.5A1.5,1.5 0 0,0 5.5,7M21.4,11.6L20.7,14.4C20.4,15.8 19.2,16.8 17.8,16.8H17.2L12.8,21.2C12.4,21.6 11.7,21.8 11.1,21.6C10.5,21.4 10,20.9 9.8,20.3L9.1,18H4C2.9,18 2,17.1 2,16V4C2,2.9 2.9,2 4,2H16C17.1,2 18,2.9 18,4V10.3L20.8,10.6C21.6,10.7 22.1,11.3 21.9,12.1L21.4,11.6M16,4H4V16H9.4L13.2,19.8L16.8,16.2C17,16.1 17.2,16 17.3,16H18.9L19.4,12H18V10C18,8.9 17.1,8 16,8H15V6C15,4.9 14.1,4 13,4H10V6H13V8H10V10H16V4Z"/></svg></button>
                        <button class="card-btn-delete danger" title="Supprimer"><svg viewBox="0 0 24 24"><path d="M19 4H15.5L14.5 3H9.5L8.5 4H5V6H19M6 19A2 2 0 0 0 8 21H16A2 2 0 0 0 18 19V7H6V19Z"/></svg></button>
                    </div>
                `;
                libraryGrid.appendChild(errorCard);
            }
        });
    }


    /**
     * Crée une carte HTML pour un playbook (modifiée pour afficher les tags).
     */
    function createPlaybookCard(playbook) {
        const card = document.createElement('div');
        card.className = 'playbook-card';
        card.dataset.id = playbook.id;
        
        // Icône d'erreur par défaut
        const errorIconUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23D32F2F' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E";
        let previewUrl = errorIconUrl;
        let needsRevoke = false; // Doit-on libérer l'URL ?

        // On vérifie si 'playbook.preview' est un VRAI Blob avant de l'utiliser
        if (playbook.preview instanceof Blob) {
            try {
                previewUrl = URL.createObjectURL(playbook.preview);
                needsRevoke = true;
            } catch (e) {
                console.error("Erreur createObjectURL pour playbook:", playbook.name, e);
                // L'URL reste l'icône d'erreur
            }
        } else if (playbook.preview) {
            // Si 'preview' existe mais n'est pas un Blob (c'est '{}' ou 'null')
            console.warn("L'aperçu du playbook n'est pas un Blob:", playbook.name, playbook.preview);
        }

        // Crée le HTML pour les tags en utilisant les noms
        let tagsHtml = '';
        if (playbook.tagIds && playbook.tagIds.length > 0) {
            const tagNames = playbook.tagIds.map(id => {
                const tag = allTags.find(t => t.id === id);
                return tag ? tag.name : 'Tag supprimé';
            });

            tagsHtml = `
                <div class="card-tags">
                    ${tagNames.map(name => `<span>${name}</span>`).join('')}
                </div>
            `;
        }

        card.innerHTML = `
            <div class="card-preview">
                <img src="${previewUrl}" alt="Aperçu du playbook">
            </div>
            <div class="card-info">
                <h3>${playbook.name}</h3>
                <p>${new Date(playbook.createdAt).toLocaleDateString()}</p>
            </div>
            ${tagsHtml} <div class="card-actions">
                <button class="card-btn-load" title="Charger"><svg viewBox="0 0 24 24"><path d="M9 3v10H6l6 7l6-7h-3V3H9z"/></svg></button>
                <button class="card-btn-assign-tags" title="Assigner des tags"><svg viewBox="0 0 24 24"><path d="M5.5,7A1.5,1.5 0 0,0 7,5.5A1.5,1.5 0 0,0 5.5,4A1.5,1.5 0 0,0 4,5.5A1.5,1.5 0 0,0 5.5,7M21.4,11.6L20.7,14.4C20.4,15.8 19.2,16.8 17.8,16.8H17.2L12.8,21.2C12.4,21.6 11.7,21.8 11.1,21.6C10.5,21.4 10,20.9 9.8,20.3L9.1,18H4C2.9,18 2,17.1 2,16V4C2,2.9 2.9,2 4,2H16C17.1,2 18,2.9 18,4V10.3L20.8,10.6C21.6,10.7 22.1,11.3 21.9,12.1L21.4,11.6M16,4H4V16H9.4L13.2,19.8L16.8,16.2C17,16.1 17.2,16 17.3,16H18.9L19.4,12H18V10C18,8.9 17.1,8 16,8H15V6C15,4.9 14.1,4 13,4H10V6H13V8H10V10H16V4Z"/></svg></button>
                <button class="card-btn-delete danger" title="Supprimer"><svg viewBox="0 0 24 24"><path d="M19 4H15.5L14.5 3H9.5L8.5 4H5V6H19M6 19A2 2 0 0 0 8 21H16A2 2 0 0 0 18 19V7H6V19Z"/></svg></button>
            </div>
        `;
        
        // On ne libère l'URL que si on l'a créée
        if (needsRevoke) {
            card.querySelector('img').onload = () => {
                URL.revokeObjectURL(previewUrl);
            };
        }
        
        return card;
    }
    
    /**
     * Ouvre la modale de gestion des tags et la remplit.
     */
    async function openManageTagsModal() {
        await updateTagsCache();
        renderMasterTagList();
        manageTagsModal.classList.remove('hidden');
    }

    /**
     * Affiche la liste des tags dans la modale "Gérer".
     */
    function renderMasterTagList() {
        masterTagList.innerHTML = '';
        if (allTags.length === 0) {
            masterTagList.innerHTML = '<p class="library-empty-message">Aucun tag créé.</p>';
            return;
        }
        allTags.forEach(tag => {
            const li = document.createElement('li');
            li.dataset.id = tag.id;
            li.innerHTML = `
                <span>${tag.name}</span>
                <button class="tag-delete-btn danger" title="Supprimer ce tag">
                    <svg viewBox="0 0 24 24"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>
                </button>
            `;
            masterTagList.appendChild(li);
        });
    }

    /**
     * Ouvre la modale d'assignation pour un playbook spécifique.
     */
    function openAssignTagsModal(playbook) {
        currentPlaybookToTag = playbook;
        assignTagsTitle.textContent = `Assigner les tags pour : ${playbook.name}`;
        
        assignTagsList.innerHTML = '';
        if (allTags.length === 0) {
            assignTagsList.innerHTML = '<p class="library-empty-message">Vous n\'avez pas encore créé de tags. Allez dans "Gérer les tags" d\'abord.</p>';
            return;
        }

        const playbookTagIds = new Set(playbook.tagIds || []);

        allTags.forEach(tag => {
            const isChecked = playbookTagIds.has(tag.id);
            const label = document.createElement('label');
            label.className = 'tag-checkbox-label';
            label.innerHTML = `
                <input type="checkbox" value="${tag.id}" ${isChecked ? 'checked' : ''}>
                <span>${tag.name}</span>
            `;
            assignTagsList.appendChild(label);
        });

        assignTagsModal.classList.remove('hidden');
    }


    // --- Gestion des actions (Mise à jour) ---
    libraryGrid.addEventListener('click', async (e) => {
        const playbookCard = e.target.closest('.playbook-card');
        if (!playbookCard) return;

        const playbookId = parseInt(playbookCard.dataset.id, 10);
        // Si l'ID n'est pas un nombre (ex: carte d'erreur), on ne fait rien
        if (isNaN(playbookId)) return;
        
        // Clic sur "Supprimer"
        if (e.target.closest('.card-btn-delete')) {
            if (confirm(`Voulez-vous vraiment supprimer le playbook "${playbookCard.querySelector('h3').textContent}" ?`)) {
                try {
                    await orbDB.deletePlaybook(playbookId);
                    loadLibrary(); // Recharge tout
                } catch (error) {
                    console.error("Erreur lors de la suppression:", error);
                    alert("La suppression a échoué.");
                }
            }
        }

        // Clic sur "Charger"
        if (e.target.closest('.card-btn-load')) {
            try {
                const playbookRecord = await orbDB.getPlaybook(playbookId);
                if (playbookRecord) {
                    // --- CORRECTION v4.5 ---
                    // On envoie l'enregistrement complet (avec ID) et non juste les données
                    const loadEvent = new CustomEvent('loadPlaybook', { detail: playbookRecord });
                    // --- FIN CORRECTION ---
                    window.dispatchEvent(loadEvent);
                    libraryView.classList.add('hidden');
                }
            } catch (error) {
                 console.error("Erreur lors du chargement du playbook:", error);
                 alert("Le chargement a échoué.");
            }
        }
        
        // NOUVEAU : Clic sur "Assigner les tags"
        if (e.target.closest('.card-btn-assign-tags')) {
            const playbook = allPlaybooks.find(p => p.id === playbookId);
            if (playbook) {
                openAssignTagsModal(playbook);
            }
        }
    });
}