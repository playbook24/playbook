/**
 * interaction.js
 * Gère les entrées utilisateurs (Souris, Clavier, Outils).
 */

window.ORB.interactions = {
    
    init: function() {
        const canvas = window.ORB.canvas;
        
        canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
        canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
        window.addEventListener("mouseup", this.handleMouseUp.bind(this)); // Window pour relâcher hors du canvas
        canvas.addEventListener("dblclick", this.handleDoubleClick.bind(this));
        window.addEventListener("keydown", this.handleKeyDown.bind(this));
    },

    // Logique de sélection d'élément
    getElementAtPosition: function(logicalPoint) {
        const elements = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements;
        const CLICK_RADIUS = 12;
        const pathTools = ['arrow', 'pass', 'dribble', 'screen', 'pencil'];

        const selectionOrder = [
            ['text'], ['ball'], ['player', 'defender'], ['cone', 'hoop', 'basket'],
            pathTools, ['zone']
        ];
        
        for (const types of selectionOrder) {
            for (let i = elements.length - 1; i >= 0; i--) {
                const el = elements[i];
                if (!types.includes(el.type)) continue;
                if (el.type === 'ball' && el.linkedTo) continue;
                
                if (el.type === 'zone') {
                    if (logicalPoint.x >= el.x && logicalPoint.x <= el.x + el.width && logicalPoint.y >= el.y && logicalPoint.y <= el.y + el.height) {
                        return el;
                    }
                } else if (pathTools.includes(el.type)) {
                    for (let j = 0; j < el.points.length - 1; j++) {
                        if (window.ORB.utils.getDistanceToSegment(logicalPoint, el.points[j], el.points[j + 1]) < 5) {
                            return el;
                        }
                    }
                } else {
                    if (Math.hypot(logicalPoint.x - el.x, logicalPoint.y - el.y) < CLICK_RADIUS) {
                        return el;
                    }
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

    handleMouseDown: function(e) {
        const appState = window.ORB.appState;
        const logicalPos = window.ORB.utils.getLogicalCoords(e);
        
        appState.isMouseDown = true;
        appState.startDragPos = logicalPos;
        appState.lastMousePos = logicalPos;

        const pathTools = ['arrow', 'pass', 'dribble', 'screen', 'pencil'];
        const dragTools = ['zone'];
        const singleClickTools = ['player', 'defender', 'ball', 'cone', 'hoop', 'basket'];

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
            this.finalizeCurrentPath();
            
            if (appState.currentTool === "select") {
                appState.selectedScene = null;
                appState.selectedElement = this.getElementAtPosition(logicalPos);
                if(appState.selectedElement) {
                    appState.dragStartElementState = JSON.stringify(appState.selectedElement);
                }
            } else {
                appState.selectedElement = null;
                appState.selectedScene = null;
                
                if (singleClickTools.includes(appState.currentTool)) {
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
                        // Orientation automatique vers le joueur le plus proche
                        const players = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.filter(el => el.type === 'player');
                        let closestPlayer = null;
                        let minDistance = Infinity;
                        players.forEach(p => {
                            const dist = Math.hypot(p.x - newElement.x, p.y - newElement.y);
                            if (dist < minDistance) {
                                minDistance = dist;
                                closestPlayer = p;
                            }
                        });
                        if (closestPlayer) {
                            const angle = Math.atan2(closestPlayer.y - newElement.y, closestPlayer.x - newElement.x);
                            newElement.rotation = angle * 180 / Math.PI + 90;
                        }
                    } else if (appState.currentTool === "ball") {
                        newElement.color = "#E65100";
                        // Lier automatiquement au joueur si placé dessus
                        const players = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.filter(el => el.type === 'player');
                        const playerBelow = players.find(p => Math.hypot(p.x - newElement.x, p.y - newElement.y) < 10);
                        if (playerBelow) {
                            newElement.linkedTo = playerBelow.id;
                        }
                    } else if (appState.currentTool === "cone") newElement.color = "#ff7f50";
                    else if (appState.currentTool === "hoop") newElement.color = "#ff0000";
                    else if (appState.currentTool === "basket") newElement.color = "#E65100";

                    window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.push(newElement);
                    window.ORB.commitState();
                } else if (appState.currentTool === "text") {
                    const text = prompt("Entrez votre texte :");
                    if (text) {
                        window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.push({
                            id: Date.now(),
                            type: "text",
                            x: logicalPos.x,
                            y: logicalPos.y,
                            text: text,
                            size: 14,
                            color: "#212121"
                        });
                        window.ORB.commitState();
                    }
                }
            }
        }
        window.ORB.ui.updatePropertiesPanel();
        window.ORB.renderer.redrawCanvas();
    },

    handleMouseMove: function(e) {
        const appState = window.ORB.appState;
        const logicalPos = window.ORB.utils.getLogicalCoords(e);

        if (appState.isMouseDown) {
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
        }

        appState.lastMousePos = logicalPos;

        if (appState.isDrawing || appState.isDragging || appState.tempElement) {
            window.ORB.renderer.redrawCanvas();
        }
    },

    handleMouseUp: function(e) {
        const appState = window.ORB.appState;
        
        if (appState.tempElement && appState.tempElement.type === 'zone') {
            if (appState.tempElement.width < 0) { appState.tempElement.x += appState.tempElement.width; appState.tempElement.width *= -1; }
            if (appState.tempElement.height < 0) { appState.tempElement.y += appState.tempElement.height; appState.tempElement.height *= -1; }
            
            if (appState.tempElement.width > 2 && appState.tempElement.height > 2) {
                window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.push({ id: Date.now(), ...appState.tempElement });
                window.ORB.commitState();
            }
            appState.tempElement = null;
        }

        if (appState.isDragging) {
            if(appState.dragStartElementState && JSON.stringify(appState.selectedElement) !== appState.dragStartElementState) {
                window.ORB.commitState();
            }

            // Suppression si glissé hors du canvas
            const rect = window.ORB.canvas.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                let elements = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements;
                window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements = elements.filter(el => el.id !== appState.selectedElement.id);
                appState.selectedElement = null;
                window.ORB.ui.updatePropertiesPanel();
                window.ORB.commitState();
            } 
            // Gestion du lien Ballon-Joueur
            else if (appState.selectedElement && appState.selectedElement.type === 'ball') {
                const elements = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements;
                const logicalPos = window.ORB.utils.getLogicalCoords(e);
                const playerBelow = elements.find(el => el.type === 'player' && Math.hypot(el.x - logicalPos.x, el.y - logicalPos.y) < 10);
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

    handleDoubleClick: function(e) {
        e.preventDefault();
        const appState = window.ORB.appState;

        if (appState.isDrawing) {
            if (appState.currentPath.length > 1) appState.currentPath.pop();
            this.finalizeCurrentPath();
            window.ORB.renderer.redrawCanvas();
            return; 
        }

        const logicalPos = window.ORB.utils.getLogicalCoords(e);
        const clickedElement = this.getElementAtPosition(logicalPos);

        // Détacher le ballon du joueur sur double clic
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
            const targetTagName = e.target.tagName.toLowerCase();
            if (targetTagName === "input" || targetTagName === "textarea") {
            } else {
                if (e.key === 'z') {
                    e.preventDefault();
                    window.ORB.undo();
                } else if (e.key === 'y') {
                    e.preventDefault();
                    window.ORB.redo();
                }
            }
        }

        const targetTagName = e.target.tagName.toLowerCase();
        if (targetTagName === "input" || targetTagName === "textarea") return;

        if (e.key === "Enter" && appState.isDrawing) {
            this.finalizeCurrentPath();
            window.ORB.renderer.redrawCanvas();
        } else if ((e.key === "Delete" || e.key === "Backspace") && appState.selectedElement) {
            let elements = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements;
            
            // Si on supprime un joueur, on libère le ballon lié
            if (appState.selectedElement.type === 'player') {
                const balls = elements.filter(b => b.type === 'ball' && b.linkedTo === appState.selectedElement.id);
                balls.forEach(ball => ball.linkedTo = null);
            }
            
            window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements = elements.filter(el => el.id !== appState.selectedElement.id);
            appState.selectedElement = null;
            appState.selectedScene = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex];
            window.ORB.commitState();
            window.ORB.ui.updatePropertiesPanel();
            window.ORB.renderer.redrawCanvas();
        }
    }
};