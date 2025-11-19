/**
 * state.js
 * Contient l'état global de l'application et la configuration.
 * Doit être chargé en PREMIER.
 */

window.ORB = {
    // --- CONSTANTES ---
    CONSTANTS: {
        LOGICAL_WIDTH: 280,
        LOGICAL_HEIGHT: 150,
        PROXIMITY_THRESHOLD: 20,
        DEFAULT_ANIMATION_SPEED: 50,
        DEFAULT_ANTICIPATION_RATIO: 0.3,
        MIN_SCENE_DURATION: 1000,
        PASS_DURATION: 800,
        PASS_RATIO: 0.5,
        COLORS: {
            primary: '#BFA98D',
            secondary: '#212121',
            crabPrimary: '#72243D',
            crabSecondary: '#F9AB00'
        }
    },

    // --- ÉTAT DU PLAYBOOK (Données sauvegardées) ---
    playbookState: {
        name: "Playbook",
        scenes: [{
            name: "Scène 1",
            elements: [],
            comments: '',
            durationOverride: null 
        }],
        activeSceneIndex: 0,
        animationSettings: {
            speed: 50, // Valeur par défaut
            ratio: 0.3, // Valeur par défaut
        }
    },

    // --- ÉTAT DE L'APPLICATION (Volatile) ---
    appState: {
        currentLoadedPlaybookId: null, // ID pour la base de données
        currentTool: 'select',
        
        // Sélection & Interaction
        selectedElement: null,
        selectedScene: null,
        dragStartElementState: null,
        isDragging: false,
        isDrawing: false,
        isMouseDown: false,
        
        // Dessin temporaire
        currentPath: [],
        startDragPos: { x: 0, y: 0 },
        lastMousePos: { x: 0, y: 0 },
        tempElement: null, // Pour la zone rectangulaire lors du tracé
        
        // Gestion des IDs
        playerCounter: 1,
        defenderCounter: 1,

        // Drag & Drop des scènes
        draggedSceneIndex: null
    },

    // --- ÉTAT DE L'ANIMATION ---
    animationState: {
        isPlaying: false,
        isFinished: false,
        startTime: 0,
        elapsedOffset: 0,
        animationFrameId: null,
        storyboard: [],
        totalDuration: 0,
        lastPositions: new Map(),
        view: 'full',
        activeHalf: 'left'
    },

    // --- HISTORIQUE (Undo/Redo) ---
    history: [],
    redoStack: [],
    isRestoringState: false,

    // --- RÉFÉRENCES GLOBALES (Remplies par main.js) ---
    canvas: null,
    ctx: null,
    animCanvas: null,
    animCtx: null,
    
    // --- FONCTIONS DE GESTION D'ÉTAT ---
    
    // Sauvegarde l'état actuel dans l'historique
    commitState: function() {
        if (this.isRestoringState) return;
        // Copie profonde de l'état du playbook
        const stateCopy = JSON.parse(JSON.stringify(this.playbookState));
        this.history.push(stateCopy);
        this.redoStack = [];
        
        // Limite la taille de l'historique
        if (this.history.length > 50) {
            this.history.shift();
        }
        
        // Met à jour les boutons UI (Fonction définie dans ui.js)
        if (this.ui && this.ui.updateUndoRedoButtons) {
            this.ui.updateUndoRedoButtons();
        }
    },

    // Annuler
    undo: function() {
        if (this.history.length <= 1) return;
        this.isRestoringState = true;
        
        const currentState = this.history.pop();
        this.redoStack.push(currentState);
        
        const prevState = this.history[this.history.length - 1];
        this.playbookState = JSON.parse(JSON.stringify(prevState));
        
        // Mise à jour de l'interface
        if (this.ui) {
            const nameInput = document.getElementById('play-name-input');
            if (nameInput) nameInput.value = this.playbookState.name;
            this.ui.switchToScene(this.playbookState.activeSceneIndex, true);
            this.ui.updateUndoRedoButtons();
        }
        
        this.isRestoringState = false;
    },

    // Rétablir
    redo: function() {
        if (this.redoStack.length === 0) return;
        this.isRestoringState = true;
        
        const nextState = this.redoStack.pop();
        this.history.push(nextState);
        this.playbookState = JSON.parse(JSON.stringify(nextState));
        
        // Mise à jour de l'interface
        if (this.ui) {
            const nameInput = document.getElementById('play-name-input');
            if (nameInput) nameInput.value = this.playbookState.name;
            this.ui.switchToScene(this.playbookState.activeSceneIndex, true);
            this.ui.updateUndoRedoButtons();
        }
        
        this.isRestoringState = false;
    }
};