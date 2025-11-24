/**
 * state.js
 * État global.
 */

window.ORB = {
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

    playbookState: {
        name: "Playbook",
        scenes: [{
            name: "Scène 1",
            elements: [],
            comments: '',
            durationOverride: null 
        }],
        activeSceneIndex: 0,
        animationSettings: { speed: 50, ratio: 0.3 }
    },

    appState: {
        currentLoadedPlaybookId: null,
        currentTool: 'select',
        
        // 'mouse' (Point à point) ou 'stylus' (Tracé libre)
        inputMode: 'mouse', 
        smoothingDistance: 5, // Distance min entre 2 points pour le mode stylet (lissage)

        selectedElement: null,
        selectedScene: null,
        dragStartElementState: null,
        isDragging: false,
        isDrawing: false,
        isMouseDown: false,
        
        currentPath: [],
        startDragPos: { x: 0, y: 0 },
        lastMousePos: { x: 0, y: 0 },
        tempElement: null,
        
        playerCounter: 1,
        defenderCounter: 1,
        draggedSceneIndex: null
    },

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

    history: [],
    redoStack: [],
    isRestoringState: false,

    canvas: null, ctx: null, animCanvas: null, animCtx: null,
    
    commitState: function() {
        if (this.isRestoringState) return;
        const stateCopy = JSON.parse(JSON.stringify(this.playbookState));
        this.history.push(stateCopy);
        this.redoStack = [];
        if (this.history.length > 50) this.history.shift();
        if (this.ui && this.ui.updateUndoRedoButtons) this.ui.updateUndoRedoButtons();
    },

    undo: function() {
        if (this.history.length <= 1) return;
        this.isRestoringState = true;
        const currentState = this.history.pop();
        this.redoStack.push(currentState);
        const prevState = this.history[this.history.length - 1];
        this.playbookState = JSON.parse(JSON.stringify(prevState));
        if (this.ui) {
            const nameInput = document.getElementById('play-name-input');
            if (nameInput) nameInput.value = this.playbookState.name;
            this.ui.switchToScene(this.playbookState.activeSceneIndex, true);
            this.ui.updateUndoRedoButtons();
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
            const nameInput = document.getElementById('play-name-input');
            if (nameInput) nameInput.value = this.playbookState.name;
            this.ui.switchToScene(this.playbookState.activeSceneIndex, true);
            this.ui.updateUndoRedoButtons();
        }
        this.isRestoringState = false;
    }
};