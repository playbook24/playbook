/**
 * interaction.js
 * Gère les entrées utilisateurs (Souris, Clavier, Outils)
 * ET LE SUPPORT TACTILE (Touch Events).
 */

window.ORB.interactions = {
    
    init: function() {
        const canvas = window.ORB.canvas;
        
        // Souris
        canvas.addEventListener("mousedown", this.handleStart.bind(this));
        window.addEventListener("mousemove", this.handleMove.bind(this)); // Window pour suivre hors canvas
        window.addEventListener("mouseup", this.handleEnd.bind(this));

        // Tactile (Mobile/Tablette)
        // { passive: false } est crucial pour empêcher le scroll de la page
        canvas.addEventListener("touchstart", this.handleStart.bind(this), { passive: false });
        window.addEventListener("touchmove", this.handleMove.bind(this), { passive: false });
        window.addEventListener("touchend", this.handleEnd.bind(this));
        
        // Autres
        canvas.addEventListener("dblclick", this.handleDoubleClick.bind(this));
        window.addEventListener("keydown", this.handleKeyDown.bind(this));
    },

    // --- HELPER : Normaliser Souris/Touch ---
    getEventPos: function(e) {
        // Si c'est un événement tactile
        if (e.touches && e.touches.length > 0) {
            return window.ORB.utils.getLogicalCoords({
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY
            });
        }
        // Sinon c'est la souris
        return window.ORB.utils.getLogicalCoords(e);
    },

    // --- LOGIQUE COMMUNE (Souris + Tactile) ---

    handleStart: function(e) {
        // Empêcher le scroll sur mobile
        if (e.type === 'touchstart') e.preventDefault();

        // Clic droit ou touche secondaire ignorés pour le dessin principal
        if (e.button === 2) return;

        const appState = window.ORB.appState;
        const logicalPos = this.getEventPos(e);
        
        appState.isMouseDown = true; // On garde ce nom de variable par habitude
        appState.startDragPos = logicalPos;
        appState.lastMousePos = logicalPos;

        const pathTools = ['arrow', 'pass', 'dribble', 'screen', 'pencil'];
        const dragTools = ['zone'];
        const singleClickTools = ['player', 'defender', 'ball', 'cone', 'hoop', 'basket'];

        this.finalizeCurrentPath(); // Si un chemin était en cours mais non fini

        if (pathTools.includes(appState.currentTool)) {
            if (!appState.isDrawing) {
                appState.isDrawing = true;
                appState.currentPath = [logicalPos];
            } else {
                appState.currentPath.push(logicalPos);
            }
        } else if (dragTools.includes(appState.currentTool)) {
            appState.tempElement = {
                type: appState.currentTool,
                x: logicalPos.x,
                y: logicalPos.y,
                width: 0,
                height: 0,
                color: '#FFEB3B'
            };
        } else {
            // Outils de sélection ou clic simple
            if (appState.currentTool === "select") {
                appState.selectedScene = null;
                appState.selectedElement = this.getElementAtPosition(logicalPos);
                if(appState.selectedElement) {
                    appState.dragStartElementState = JSON.stringify(appState.selectedElement);
                }
            } else if (singleClickTools.includes(appState.currentTool)) {
                this.addSingleElement(logicalPos);
            }
        }
        window.ORB.ui.updatePropertiesPanel();
        window.ORB.renderer.redrawCanvas();
    },

    handleMove: function(e) {
        const appState = window.ORB.appState;
        if (!appState.isMouseDown) return;
        
        if (e.type === 'touchmove') e.preventDefault(); // Stop scroll

        // Pour le tactile, on doit recalculer la pos car 'e' change de structure
        let logicalPos;
        if (e.touches && e.touches.length > 0) {
            logicalPos = window.ORB.utils.getLogicalCoords({
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY
            });
        } else {
            logicalPos = window.ORB.utils.getLogicalCoords(e);
        }

        if (appState.currentTool === 'select' && appState.selectedElement) {
            if (!appState.isDragging) {
                if (Math.hypot(logicalPos.x - appState.startDragPos.x, logicalPos.y - appState.startDragPos.y) > 3) {
                    appState.isDragging = true;
                }
            }

            if (appState.isDragging) {
                const dx = logicalPos.x - appState.lastMousePos.x;
                const dy = logicalPos.y - appState.lastMousePos.y;
                if (appState.selectedElement.points) {
                    appState.selectedElement.points.forEach(p => { p.x += dx; p.y += dy; });
                } else {
                    appState.selectedElement.x += dx;
                    appState.selectedElement.y += dy;
                }
            }
        }
        else if (appState.tempElement && appState.tempElement.type === 'zone') {
            appState.tempElement.width = logicalPos.x - appState.tempElement.x;
            appState.tempElement.height = logicalPos.y - appState.tempElement.y;
        }

        appState.lastMousePos = logicalPos;

        if (appState.isDrawing || appState.isDragging || appState.tempElement) {
            window.ORB.renderer.redrawCanvas();
        }
    },

    handleEnd: function(e) {
        const appState = window.ORB.appState;
        if (!appState.isMouseDown) return;

        // Zone Rectangulaire : Validation
        if (appState.tempElement && appState.tempElement.type === 'zone') {
            if (appState.tempElement.width < 0) { appState.tempElement.x += appState.tempElement.width; appState.tempElement.width *= -1; }
            if (appState.tempElement.height < 0) { appState.tempElement.y += appState.tempElement.height; appState.tempElement.height *= -1; }
            
            if (appState.tempElement.width > 2 && appState.tempElement.height > 2) {
                window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.push({ id: Date.now(), ...appState.tempElement });
                window.ORB.commitState();
            }
            appState.tempElement = null;
        }

        // Fin du Dragging
        if (appState.isDragging) {
            if(appState.dragStartElementState && JSON.stringify(appState.selectedElement) !== appState.dragStartElementState) {
                window.ORB.commitState();
            }
            
            // Note: Sur mobile, "clientX" n'existe pas sur touchend. On utilise lastMousePos.
            // On ne gère pas la suppression par "drag out" sur mobile car c'est risqué, on préfère le bouton Supprimer.
            
            // Gestion du lien Ballon-Joueur
            if (appState.selectedElement && appState.selectedElement.type === 'ball') {
                const elements = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements;
                // On utilise la dernière position connue
                const playerBelow = elements.find(el => el.type === 'player' && Math.hypot(el.x - appState.lastMousePos.x, el.y - appState.lastMousePos.y) < 10);
                const oldLinkedTo = appState.selectedElement.linkedTo;
                
                if (playerBelow) {
                    appState.selectedElement.linkedTo = playerBelow.id;
                } else {
                    appState.selectedElement.linkedTo = null;
                }
                
                if(oldLinkedTo !== appState.selectedElement.linkedTo) {
                    window.ORB.commitState();
                }
            }
        }

        appState.isMouseDown = false;
        appState.isDragging = false;
        appState.dragStartElementState = null;
        
        window.ORB.renderer.redrawCanvas();
    },

    // --- FONCTIONS INTERNES ---

    addSingleElement: function(logicalPos) {
        const appState = window.ORB.appState;
        const newElement = { id: Date.now(), type: appState.currentTool, x: logicalPos.x, y: logicalPos.y };
        
        if (appState.currentTool === "player") {
            newElement.label = appState.playerCounter.toString();
            newElement.color = "#007BFF";
            appState.playerCounter++;
        } else if (appState.currentTool === "defender") {
            newElement.label = appState.defenderCounter.toString();
            newElement.color = "#D32F2F";
            newElement.rotation = 0;
            appState.defenderCounter++;
            // Orientation auto
            const players = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.filter(el => el.type === 'player');
            let closestPlayer = null;
            let minDistance = Infinity;
            players.forEach(p => {
                const dist = Math.hypot(p.x - newElement.x, p.y - newElement.y);
                if (dist < minDistance) { minDistance = dist; closestPlayer = p; }
            });
            if (closestPlayer) {
                const angle = Math.atan2(closestPlayer.y - newElement.y, closestPlayer.x - newElement.x);
                newElement.rotation = angle * 180 / Math.PI + 90;
            }
        } else if (appState.currentTool === "ball") {
            newElement.color = "#E65100";
            const players = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.filter(el => el.type === 'player');
            const playerBelow = players.find(p => Math.hypot(p.x - newElement.x, p.y - newElement.y) < 10);
            if (playerBelow) newElement.linkedTo = playerBelow.id;
        } else if (appState.currentTool === "cone") newElement.color = "#ff7f50";
        else if (appState.currentTool === "hoop") newElement.color = "#ff0000";
        else if (appState.currentTool === "basket") newElement.color = "#E65100";

        window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.push(newElement);
        window.ORB.commitState();
    },

    getElementAtPosition: function(logicalPoint) {
        const elements = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements;
        const CLICK_RADIUS = 15; // Un peu plus large pour le tactile
        const pathTools = ['arrow', 'pass', 'dribble', 'screen', 'pencil'];

        const selectionOrder = [['text'], ['ball'], ['player', 'defender'], ['cone', 'hoop', 'basket'], pathTools, ['zone']];
        
        for (const types of selectionOrder) {
            for (let i = elements.length - 1; i >= 0; i--) {
                const el = elements[i];
                if (!types.includes(el.type)) continue;
                if (el.type === 'ball' && el.linkedTo) continue;
                
                if (el.type === 'zone') {
                    if (logicalPoint.x >= el.x && logicalPoint.x <= el.x + el.width && logicalPoint.y >= el.y && logicalPoint.y <= el.y + el.height) return el;
                } else if (pathTools.includes(el.type)) {
                    for (let j = 0; j < el.points.length - 1; j++) {
                        if (window.ORB.utils.getDistanceToSegment(logicalPoint, el.points[j], el.points[j + 1]) < 8) return el; // Tolérance augmentée
                    }
                } else {
                    if (Math.hypot(logicalPoint.x - el.x, logicalPoint.y - el.y) < CLICK_RADIUS) return el;
                }
            }
        }
        return null;
    },

    finalizeCurrentPath: function() {
        const appState = window.ORB.appState;
        if (appState.isDrawing && appState.currentPath.length > 1) {
            window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.push({
                id: Date.now(),
                type: appState.currentTool,
                points: appState.currentPath,
                width: 2.5,
                color: '#212121'
            });
            window.ORB.commitState(); 
        }
        appState.isDrawing = false;
        appState.currentPath = [];
    },

    handleDoubleClick: function(e) {
        e.preventDefault();
        const appState = window.ORB.appState;

        if (appState.isDrawing) {
            if (appState.currentPath.length > 1) appState.currentPath.pop();
            this.finalizeCurrentPath();
            window.ORB.renderer.redrawCanvas();
            return; 
        }
        // Double clic sur joueur pour lâcher la balle
        const logicalPos = window.ORB.utils.getLogicalCoords(e);
        const clickedElement = this.getElementAtPosition(logicalPos);
        if (clickedElement && clickedElement.type === 'player') {
            const elements = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements;
            const linkedBall = elements.find(b => b.type === 'ball' && b.linkedTo === clickedElement.id);
            if (linkedBall) {
                linkedBall.linkedTo = null;
                linkedBall.x = clickedElement.x + 15;
                linkedBall.y = clickedElement.y;
                window.ORB.commitState();
                window.ORB.renderer.redrawCanvas();
            }
        }
    },

    handleKeyDown: function(e) {
        const appState = window.ORB.appState;
        if (e.ctrlKey || e.metaKey) {
            const tag = e.target.tagName.toLowerCase();
            if (tag === "input" || tag === "textarea") return;
            if (e.key === 'z') { e.preventDefault(); window.ORB.undo(); }
            else if (e.key === 'y') { e.preventDefault(); window.ORB.redo(); }
        }

        const tag = e.target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea") return;

        if (e.key === "Enter" && appState.isDrawing) {
            this.finalizeCurrentPath();
            window.ORB.renderer.redrawCanvas();
        } else if ((e.key === "Delete" || e.key === "Backspace") && appState.selectedElement) {
            let elements = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements;
            if (appState.selectedElement.type === 'player') {
                const balls = elements.filter(b => b.type === 'ball' && b.linkedTo === appState.selectedElement.id);
                balls.forEach(ball => ball.linkedTo = null);
            }
            window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements = elements.filter(el => el.id !== appState.selectedElement.id);
            appState.selectedElement = null;
            window.ORB.commitState();
            window.ORB.ui.updatePropertiesPanel();
            window.ORB.renderer.redrawCanvas();
        }
    }
};