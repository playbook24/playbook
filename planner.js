/**
 * planner.js
 * Gère le Planificateur d'Entraînement (Version 4.2)
 *
 * CORRECTION v2.1 : Mise à jour de l'export PDF (plus léger et pratique)
 */

function initPlanner() {
    
    // --- Références DOM (Planificateur) ---
    const plannerView = document.getElementById('planner-view');
    const showPlannerBtn = document.getElementById('show-planner-btn');
    const closePlannerBtn = document.getElementById('planner-close-btn');
    const plannerGrid = document.getElementById('planner-grid');

    // --- Références DOM (Modale d'Édition) ---
    const planEditorModal = document.getElementById('plan-editor-modal');
    const planEditorTitle = document.getElementById('plan-editor-title');
    const planEditorCloseBtn = document.getElementById('plan-editor-close-btn');
    const planEditorCancelBtn = document.getElementById('plan-editor-cancel-btn');
    const planEditorSaveBtn = document.getElementById('plan-editor-save-btn');
    
    const planEditorId = document.getElementById('plan-editor-id');
    const planEditorName = document.getElementById('plan-editor-name');
    const planEditorNotes = document.getElementById('plan-editor-notes');
    
    const planPlaybooksList = document.getElementById('plan-playbooks-list');
    
    // --- Références DOM (Sélecteur de Playbook) ---
    const planSelectorFilters = document.getElementById('plan-selector-filters');
    const planSelectorList = document.getElementById('plan-selector-list');
    const planSelectorSearch = document.getElementById('plan-selector-search');

    if (typeof orbDB === 'undefined' || !orbDB) {
        console.error("ERREUR : orbDB n'est pas chargé avant planner.js");
        return;
    }

    // --- État local de l'éditeur ---
    let currentPlan = { id: null, name: '', notes: '', playbookIds: [] };
    let fullPlaybookData = new Map(); 
    
    // --- État pour le filtrage du sélecteur ---
    let plannerAllPlaybooks = [];
    let plannerAllTags = [];
    let plannerActiveTagId = null;

    // --- Écouteurs d'événements principaux ---
    
    showPlannerBtn.addEventListener('click', async () => {
        plannerView.classList.remove('hidden');
        await loadPlannerGrid(); 
    });

    closePlannerBtn.addEventListener('click', () => {
        plannerView.classList.add('hidden');
    });

    plannerGrid.addEventListener('click', handleGridClick);

    // --- Écouteurs d'événements de la Modale ---

    planEditorCloseBtn.addEventListener('click', closePlanEditor);
    planEditorCancelBtn.addEventListener('click', closePlanEditor);
    planEditorSaveBtn.addEventListener('click', saveCurrentPlan);

    planSelectorList.addEventListener('click', (e) => {
        const item = e.target.closest('.plan-selector-item');
        if (!item) return;
        const id = parseInt(item.dataset.id, 10);
        const pbData = plannerAllPlaybooks.find(pb => pb.id === id);

        if (pbData && !currentPlan.playbookIds.includes(id)) {
            currentPlan.playbookIds.push(id);
            fullPlaybookData.set(id, pbData);
            renderPlanPlaybooksList();
        }
    });

    planPlaybooksList.addEventListener('click', (e) => {
        const button = e.target.closest('.btn-remove-from-plan');
        if (!button) return;
        const item = button.closest('.plan-playbook-item');
        const playbookId = parseInt(item.dataset.id, 10);
        currentPlan.playbookIds = currentPlan.playbookIds.filter(id => id !== playbookId);
        renderPlanPlaybooksList();
    });
    
    planSelectorSearch.addEventListener('input', () => {
        filterAndRenderSelectorList(); 
    });

    // --- Fonctions Logiques ---

    async function loadPlannerGrid() {
        try {
            const plans = await orbDB.getAllPlans(); 
            plannerGrid.innerHTML = ''; 

            const newPlanCard = document.createElement('div');
            newPlanCard.className = 'card-new-plan'; 
            newPlanCard.title = "Créer un nouveau plan d'entraînement";
            newPlanCard.innerHTML = `
                <div class="card-new-plan-content">
                    <svg viewBox="0 0 24 24"><path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>
                    <span>Nouveau Plan</span>
                </div>
            `;
            plannerGrid.appendChild(newPlanCard);

            if (plans.length > 0) {
                 plans.reverse().forEach(plan => {
                    const card = document.createElement('div');
                    card.className = 'plan-card'; 
                    card.dataset.id = plan.id;
                    card.innerHTML = `
                        <div class="plan-card-info">
                            <h3>${plan.name}</h3>
                            <p class="plan-stat"><strong>Exercices :</strong> ${plan.playbookIds.length}</p>
                            <p class="plan-stat"><strong>Créé le :</strong> ${new Date(plan.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div class="plan-card-actions">
                            <button class="btn-open-plan" title="Modifier le plan">
                                <svg viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C17.98,2.9 17.35,2.9 16.96,3.29L15.13,5.12L18.88,8.87M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z"/></svg>
                                Modifier
                            </button>
                            <button class="btn-export-plan btn-primary" title="Exporter en Fiche PDF">
                                <svg viewBox="0 0 24 24"><path d="M19,9H15V3H9V9H5L12,16L19,9M5,18V20H19V18H5Z"/></svg>
                                PDF
                            </button>
                            <button class="btn-delete-plan danger" title="Supprimer le plan">
                                <svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2,0,0,0,8,21H16A2,2,0,0,0,18,19V7H6V19Z"/></svg>
                            </button>
                        </div>
                    `;
                    plannerGrid.appendChild(card);
                });
            }

        } catch (error) {
            console.error("Erreur lors du chargement des plans:", error);
            plannerGrid.innerHTML = '<p class="planner-empty-message">Erreur lors du chargement de vos plans.</p>';
        }
    }

    async function handleGridClick(e) {
        const newPlanBtn = e.target.closest('.card-new-plan');
        if (newPlanBtn) {
            openPlanEditor(null);
            return;
        }

        const card = e.target.closest('.plan-card');
        if (!card) return; 
        
        const planId = parseInt(card.dataset.id, 10);
        
        if (e.target.closest('.btn-delete-plan')) {
            if (confirm(`Voulez-vous vraiment supprimer le plan "${card.querySelector('h3').textContent}" ?`)) {
                await orbDB.deletePlan(planId);
                card.remove(); 
            }
            return; 
        }
        
        if (e.target.closest('.btn-open-plan')) {
            const plan = await orbDB.getPlan(planId);
            if (plan) openPlanEditor(plan);
            return;
        }
        
        if (e.target.closest('.btn-export-plan')) {
            const plan = await orbDB.getPlan(planId);
            if (plan) exportPlanToPDF(plan); // <-- APPEL DE LA FONCTION MODIFIÉE
            return;
        }
    }

    async function openPlanEditor(plan = null) {
        planSelectorSearch.value = '';
        plannerActiveTagId = null; 
        fullPlaybookData.clear();

        try {
            [plannerAllPlaybooks, plannerAllTags] = await Promise.all([
                orbDB.getAllPlaybooks(),
                orbDB.getAllTags()
            ]);

            renderPlannerFilters(); 
            filterAndRenderSelectorList(); 

        } catch (e) {
            console.error("Erreur au chargement du sélecteur:", e);
            planSelectorList.innerHTML = '<p class="planner-empty-message">Erreur de chargement.</p>';
        }

        if (plan) {
            planEditorTitle.textContent = "Modifier le plan";
            currentPlan = JSON.parse(JSON.stringify(plan));
            
            for (const pbId of plan.playbookIds) {
                if (!fullPlaybookData.has(pbId)) {
                    const pbData = plannerAllPlaybooks.find(p => p.id === pbId);
                    if (pbData) {
                        fullPlaybookData.set(pbId, pbData);
                    }
                }
            }
            
        } else {
            planEditorTitle.textContent = "Créer un nouveau plan";
            currentPlan = { id: null, name: '', notes: '', playbookIds: [] };
        }
        
        planEditorId.value = currentPlan.id || '';
        planEditorName.value = currentPlan.name;
        planEditorNotes.value = currentPlan.notes;

        renderPlanPlaybooksList();
        planEditorModal.classList.remove('hidden');
    }

    function renderPlannerFilters() {
        planSelectorFilters.innerHTML = ''; 

        const allBtn = document.createElement('button');
        allBtn.textContent = "Tout voir";
        allBtn.className = (plannerActiveTagId === null) ? 'btn-primary' : '';
        allBtn.onclick = () => {
            plannerActiveTagId = null;
            renderPlannerFilters(); 
            filterAndRenderSelectorList(); 
        };
        planSelectorFilters.appendChild(allBtn);

        plannerAllTags.forEach(tag => {
            const tagBtn = document.createElement('button');
            tagBtn.textContent = tag.name;
            tagBtn.className = (plannerActiveTagId === tag.id) ? 'btn-primary' : '';
            tagBtn.onclick = () => {
                plannerActiveTagId = tag.id;
                renderPlannerFilters();
                filterAndRenderSelectorList();
            };
            planSelectorFilters.appendChild(tagBtn);
        });
    }

    function filterAndRenderSelectorList() {
        const searchTerm = planSelectorSearch.value.toLowerCase();
        let filteredList = plannerAllPlaybooks;

        if (plannerActiveTagId !== null) {
            filteredList = filteredList.filter(pb => 
                pb.tagIds && pb.tagIds.includes(plannerActiveTagId)
            );
        }

        if (searchTerm) {
            filteredList = filteredList.filter(pb => 
                pb.name.toLowerCase().includes(searchTerm)
            );
        }

        renderPlaybookSelectorUI(filteredList);
    }

    function renderPlaybookSelectorUI(items) {
        planSelectorList.innerHTML = '';
        
        if (items.length === 0) {
            planSelectorList.innerHTML = '<p class="planner-empty-message" style="padding: 15px;">Aucun exercice trouvé.</p>';
            return;
        }

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'plan-selector-item';
            div.dataset.id = item.id;
            div.dataset.name = item.name;

            const playbook = item;
            const previewUrl = URL.createObjectURL(playbook.preview);
            div.title = `Ajouter "${playbook.name}" au plan`;
            div.innerHTML = `
                <img src="${previewUrl}" alt="Aperçu">
                <span>${playbook.name}</span>
            `;
            div.querySelector('img').onload = () => {
                URL.revokeObjectURL(previewUrl);
            };
            
            planSelectorList.appendChild(div);
        });
    }

    function renderPlanPlaybooksList() {
        planPlaybooksList.innerHTML = '';
        if (currentPlan.playbookIds.length === 0) {
            planPlaybooksList.innerHTML = '<li class="plan-editor-empty-list">Ajoutez des exercices depuis la bibliothèque de droite.</li>';
            return;
        }

        currentPlan.playbookIds.forEach(playbookId => {
            const playbook = fullPlaybookData.get(playbookId);
            const li = document.createElement('li');
            li.className = 'plan-playbook-item';
            li.dataset.id = playbookId;

            if (!playbook) {
                li.classList.add('deleted');
                 li.innerHTML = `
                    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23D32F2F' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E" alt="Supprimé">
                    <span>(Exercice supprimé : ${playbookId})</span>
                    <button class="btn-remove-from-plan danger" title="Retirer du plan">
                        <svg viewBox="0 0 24 24"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>
                    </button>
                `;
            } else {
                const previewUrl = URL.createObjectURL(playbook.preview);
                li.innerHTML = `
                    <img src="${previewUrl}" alt="Aperçu">
                    <span>${playbook.name}</span>
                    <button class="btn-remove-from-plan danger" title="Retirer du plan">
                        <svg viewBox="0 0 24 24"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>
                    </button>
                `;
                li.querySelector('img').onload = () => {
                    URL.revokeObjectURL(previewUrl);
                };
            }
            planPlaybooksList.appendChild(li);
        });
    }

    function closePlanEditor() {
        planEditorModal.classList.add('hidden');
        currentPlan = { id: null, name: '', notes: '', playbookIds: [] };
        fullPlaybookData.clear();
        plannerAllPlaybooks = [];
        plannerAllTags = [];
        plannerActiveTagId = null;
    }

    async function saveCurrentPlan() {
        currentPlan.name = planEditorName.value || 'Plan sans nom';
        currentPlan.notes = planEditorNotes.value;
        
        try {
            await orbDB.savePlan(currentPlan, currentPlan.id); 
            closePlanEditor();
            await loadPlannerGrid(); 
        } catch (error) {
            console.error("Erreur lors de la sauvegarde du plan:", error);
            alert("La sauvegarde a échoué.");
        }
    }

    // ---
    // --- FONCTION D'EXPORT PDF ENTIÈREMENT RÉÉCRITE ---
    // ---
    async function exportPlanToPDF(plan) {
        if (typeof window.jspdf === 'undefined') {
            alert("Erreur: La bibliothèque PDF (jspdf) n'a pas pu être chargée.");
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF("portrait", "mm", "a4");
        
        // --- Constantes de mise en page ---
        const MARGIN = 15;
        const PAGE_WIDTH = doc.internal.pageSize.getWidth();
        const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
        const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 180mm
        
        // Colonnes pour les exercices
        const LEFT_COL_X = MARGIN;
        const LEFT_COL_WIDTH = 80; // Largeur pour l'image
        const GUTTER = 8;
        const RIGHT_COL_X = LEFT_COL_X + LEFT_COL_WIDTH + GUTTER;
        const RIGHT_COL_WIDTH = CONTENT_WIDTH - LEFT_COL_WIDTH - GUTTER; // 180 - 80 - 8 = 92mm

        const ASPECT_RATIO = 280 / 150;
        const IMG_HEIGHT = LEFT_COL_WIDTH / ASPECT_RATIO; // ~45.7mm
        
        let currentY = MARGIN; // Pointeur pour savoir où on écrit

        // --- Fonctions d'aide internes ---

        // Ajoute le Header de la page
        const addHeader = (title) => {
            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            doc.text(title, PAGE_WIDTH / 2, currentY, { align: "center" });
            currentY += 10;
            doc.setDrawColor(191, 169, 141); // Couleur Or
            doc.setLineWidth(1);
            doc.line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY);
            currentY += 10;
        };

        // Ajoute un titre de section (ex: "Objectifs")
        const addSectionTitle = (title) => {
            if (currentY + 15 > PAGE_HEIGHT - MARGIN) { // Vérifie s'il faut sauter une page
                doc.addPage();
                currentY = MARGIN;
            }
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text(title, MARGIN, currentY);
            currentY += 8;
        };
        
        // Ajoute du texte normal (avec retour à la ligne)
        const addBodyText = (text) => {
            if (!text) return;
            if (currentY + 10 > PAGE_HEIGHT - MARGIN) {
                doc.addPage();
                currentY = MARGIN;
            }
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            const splitText = doc.splitTextToSize(text, CONTENT_WIDTH);
            doc.text(splitText, MARGIN, currentY);
            currentY += (splitText.length * 5) + 5; // Hauteur du texte + marge
        };

        // Fonction pour convertir un Blob en DataURL
        const blobToDataURL = (blob) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e.target.error);
                reader.readAsDataURL(blob);
            });
        };

        // --- NOUVELLE FONCTION : Ajoute un bloc d'exercice (2 colonnes) ---
        const addPlaybookRow = async (playbook, index) => {
            const title = `${index + 1}. ${playbook.name}`;
            const comments = playbook.playbookData.scenes[0].comments || "Aucun commentaire pour cet exercice.";
            const imgBlob = playbook.preview;

            // Calcule la hauteur du texte
            doc.setFontSize(10);
            doc.setFont("helvetica", "italic");
            const splitComments = doc.splitTextToSize(comments, RIGHT_COL_WIDTH);
            const textHeight = (splitComments.length * 5) + 12; // 12 pour le titre + marge

            // Calcule la hauteur totale du bloc
            const blockHeight = Math.max(IMG_HEIGHT, textHeight) + 10; // +10 de marge en bas

            // Vérifie s'il faut sauter une page AVANT de dessiner
            if (currentY + blockHeight > PAGE_HEIGHT - MARGIN) {
                doc.addPage();
                currentY = MARGIN;
            }
            
            const startY = currentY;

            // --- Colonne de Gauche (Image) ---
            try {
                const imgData = await blobToDataURL(imgBlob);
                // Force la conversion en JPEG (plus léger) et compresse
                doc.addImage(imgData, 'JPEG', LEFT_COL_X, startY, LEFT_COL_WIDTH, IMG_HEIGHT, undefined, 'FAST');
            } catch (error) {
                doc.text("Erreur image", LEFT_COL_X, startY);
            }
            
            // --- Colonne de Droite (Texte) ---
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text(title, RIGHT_COL_X, startY + 5); // +5 pour centrer un peu
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(80, 80, 80); // Gris pour les commentaires
            doc.text(splitComments, RIGHT_COL_X, startY + 12);
            doc.setTextColor(0, 0, 0); // Reset couleur

            // --- Bordure et mise à jour de Y ---
            doc.setDrawColor(220, 220, 220); // Gris clair
            doc.setLineWidth(0.5);
            doc.rect(LEFT_COL_X, startY - 2, CONTENT_WIDTH, blockHeight - 5, 'S'); // 'S' = Stroke (contour)

            currentY += blockHeight + 5; // Met à jour le pointeur Y
        };

        // --- EXÉCUTION DE L'EXPORT ---
        
        // 1. En-tête du plan
        addHeader(plan.name);
        addSectionTitle("Objectifs / Notes");
        addBodyText(plan.notes || "Aucune note pour ce plan.");
        currentY += 10;
        
        // 2. Section des exercices
        addSectionTitle("Exercices");

        // 3. Boucle sur les playbooks
        for (let i = 0; i < plan.playbookIds.length; i++) {
            try {
                const playbook = await orbDB.getPlaybook(plan.playbookIds[i]);
                if (playbook) {
                    await addPlaybookRow(playbook, i);
                }
            } catch (error) {
                console.error("Erreur chargement playbook pour PDF:", error);
            }
        }
        
        // 4. Sauvegarde
        doc.save(`${plan.name.trim() || 'plan-entrainement'}.pdf`);
    }

}