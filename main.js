/**
 * main.js
 * Point d'entrée de l'application.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("ORB Tactical Board : Démarrage...");

    // 1. Canvas
    window.ORB.canvas = document.getElementById('basketball-court');
    window.ORB.ctx = window.ORB.canvas.getContext('2d');
    window.ORB.animCanvas = document.getElementById('animation-canvas');
    window.ORB.animCtx = window.ORB.animCanvas.getContext('2d');

    // Retina
    const dpr = window.devicePixelRatio || 1;
    const rect = window.ORB.canvas.getBoundingClientRect();
    window.ORB.canvas.width = rect.width * dpr;
    window.ORB.canvas.height = rect.height * dpr;
    window.ORB.ctx.scale(dpr, dpr);

    // 2. DB
    if (typeof orbDB !== 'undefined') {
        try {
            await orbDB.open();
            console.log("ORB DB connectée.");
        } catch (e) { console.error("Erreur DB:", e); }
    }

    // 3. Modules de base
    window.ORB.ui.init();
    window.ORB.interactions.init();
    window.ORB.commitState();
    document.getElementById("tool-select").click();
    
    // 4. Gestionnaires externes (Manager, Planner, Calendar)
    if (typeof initManager === 'function') initManager();
    if (typeof initPlanner === 'function') initPlanner();
    
    // AJOUT : Initialisation du calendrier
    if (window.ORB.calendar && typeof window.ORB.calendar.init === 'function') {
        window.ORB.calendar.init();
    } else {
        console.warn("Module Calendrier non trouvé ou incomplet.");
    }

    // Event de chargement depuis bibliothèque
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