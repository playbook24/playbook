/**
 * state.js
 * État global et historique. Indispensable pour le fonctionnement des outils.
 */
window.ORB = {
    CONSTANTS: {
        LOGICAL_WIDTH: 280,
        LOGICAL_HEIGHT: 150,
        PROXIMITY_THRESHOLD: 20,
        DEFAULT_ANIMATION_SPEED: 50,
        DEFAULT_ANTICIPATION_RATIO: 0.3,
        MIN_SCENE_DURATION: 1000,
        COLORS: { primary: '#BFA98D', secondary: '#212121', crabPrimary: '#72243D', crabSecondary: '#F9AB00' }
    },

    playbookState: {
        name: "Nouveau Playbook",
        scenes: [{ name: "Scène 1", elements: [], comments: '', durationOverride: null }],
        activeSceneIndex: 0,
        animationSettings: { speed: 50, ratio: 0.3 }
    },

    appState: {
        currentLoadedPlaybookId: null,
        currentTool: 'select',
        inputMode: 'mouse', 
        selectedElement: null,
        selectedScene: null,
        isDrawing: false,
        isMouseDown: false,
        currentPath: [],
        playerCounter: 1,
        defenderCounter: 1
    },

    animationState: { isPlaying: false, isFinished: false, startTime: 0, elapsedOffset: 0, storyboard: [], view: 'full', activeHalf: 'left' },

    history: [], redoStack: [], isRestoringState: false,
    canvas: null, ctx: null, animCanvas: null, animCtx: null,
    
    // LA FONCTION QUI EMPÊCHAIT TOUT DE MARCHER :
    commitState: function() {
        if (this.isRestoringState) return;
        const stateCopy = JSON.parse(JSON.stringify(this.playbookState));
        this.history.push(stateCopy);
        this.redoStack = [];
        if (this.history.length > 50) this.history.shift();
        if (this.ui && typeof this.ui.updateUndoRedoButtons === 'function') {
            this.ui.updateUndoRedoButtons();
        }
    },

    undo: function() {
        if (this.history.length <= 1) return;
        this.isRestoringState = true;
        const currentState = this.history.pop();
        this.redoStack.push(currentState);
        const prevState = this.history[this.history.length - 1];
        this.playbookState = JSON.parse(JSON.stringify(prevState));
        if (this.ui) {
            if (typeof this.ui.switchToScene === 'function') this.ui.switchToScene(this.playbookState.activeSceneIndex, true);
        }
        this.isRestoringState = false;
    },

    redo: function() {
        if (this.redoStack.length === 0) return;
        this.isRestoringState = true;
        const nextState = this.redoStack.pop();
        this.history.push(nextState);
        this.playbookState = JSON.parse(JSON.stringify(nextState));
        if (this.ui) {
            if (typeof this.ui.switchToScene === 'function') this.ui.switchToScene(this.playbookState.activeSceneIndex, true);
        }
        this.isRestoringState = false;
    }
};