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

    // 5. Initialisation des Modules UI & Interactions
    window.ORB.ui.init();
    window.ORB.interactions.init();

    // 6. Configuration initiale
    window.ORB.commitState();
    document.getElementById("tool-select").click();
    
    // 7. Lancement des gestionnaires externes
    if (typeof initManager === 'function') initManager();
    if (typeof initPlanner === 'function') initPlanner();
    
    // 8. Lancement du Calendrier (Si présent)
    if (window.ORB.calendar && typeof window.ORB.calendar.init === 'function') {
        window.ORB.calendar.init();
    }
    
    // 9. Lancement du Roster (Si présent) - Auto-init via DOMContentLoaded dans roster.js, mais on peut forcer ici si besoin
    // (roster.js gère son propre init, donc pas besoin d'ajouter ici)

    // 10. Écouteur pour charger un playbook depuis la bibliothèque
    window.addEventListener('loadPlaybook', (event) => {
        const record = event.detail;
        if (record && record.playbookData) {
            window.ORB.playbookState = JSON.parse(JSON.stringify(record.playbookData));
            window.ORB.appState.currentLoadedPlaybookId = record.id;
            
            window.ORB.history = [];
            window.ORB.redoStack = [];
            
            window.ORB.commitState();
            document.getElementById('play-name-input').value = window.ORB.playbookState.name;
            window.ORB.ui.switchToScene(0);
            window.ORB.ui.updatePropertiesPanel();
            
            document.getElementById('play-manager-container').classList.add('hidden');
            document.getElementById('toggle-playbook-manager-btn').classList.remove('active');
        }
    });

    console.log("ORB Tactical Board : Prêt.");
});