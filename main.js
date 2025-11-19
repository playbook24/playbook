/**
 * main.js
 * Point d'entrée de l'application.
 * Initialise le canvas, la DB et lance les modules.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("ORB Tactical Board : Démarrage...");

    // 1. Initialisation Canvas Principal
    window.ORB.canvas = document.getElementById('basketball-court');
    window.ORB.ctx = window.ORB.canvas.getContext('2d');

    // 2. Initialisation Canvas Animation
    window.ORB.animCanvas = document.getElementById('animation-canvas');
    window.ORB.animCtx = window.ORB.animCanvas.getContext('2d');

    // 3. Gestion Retina (High DPI)
    const dpr = window.devicePixelRatio || 1;
    const rect = window.ORB.canvas.getBoundingClientRect();
    
    window.ORB.canvas.width = rect.width * dpr;
    window.ORB.canvas.height = rect.height * dpr;
    window.ORB.ctx.scale(dpr, dpr);

    // 4. Initialisation Base de Données
    if (typeof orbDB !== 'undefined') {
        try {
            await orbDB.open();
            console.log("ORB DB connectée.");
        } catch (e) {
            console.error("Erreur DB:", e);
        }
    }

    // 5. Initialisation des Modules
    window.ORB.ui.init();
    window.ORB.interactions.init();

    // 6. Configuration initiale
    // Création d'un état initial propre dans l'historique
    window.ORB.commitState();
    
    // Sélection outil par défaut
    document.getElementById("tool-select").click();
    
    // Lancement des gestionnaires externes (Manager/Planner)
    if (typeof initManager === 'function') initManager();
    if (typeof initPlanner === 'function') initPlanner();

    // Écouteur d'événement global pour le chargement depuis la bibliothèque
    // (Déclenche la logique de restauration d'état)
    window.addEventListener('loadPlaybook', (event) => {
        const record = event.detail;
        if (record && record.playbookData) {
            window.ORB.playbookState = JSON.parse(JSON.stringify(record.playbookData));
            window.ORB.appState.currentLoadedPlaybookId = record.id;
            
            // Reset historique
            window.ORB.history = [];
            window.ORB.redoStack = [];
            
            // Mise à jour UI
            window.ORB.commitState();
            document.getElementById('play-name-input').value = window.ORB.playbookState.name;
            window.ORB.ui.switchToScene(0);
            window.ORB.ui.updatePropertiesPanel();
            
            // Fermer le manager
            document.getElementById('play-manager-container').classList.add('hidden');
            document.getElementById('toggle-playbook-manager-btn').classList.remove('active');
        }
    });

    console.log("ORB Tactical Board : Prêt.");
});