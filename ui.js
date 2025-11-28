/**
 * ui.js
 * Gestion de l'interface utilisateur.
 * VERSION FINALE : Backup incluant Playbooks, Plans, Calendrier, Joueurs et Équipes.
 */

window.ORB.ui = {

    init: function() {
        this.bindMainButtons();
        this.bindToolButtons();
        this.bindSceneControls();
        this.bindPropertiesPanel();
        this.bindExports();
        this.bindTheme();
        this.initColorPalettes();
        this.bindInputMode();
    },

    // --- GESTION DU BOUTON SOURIS / STYLET ---
    bindInputMode: function() {
        const btn = document.getElementById('input-mode-btn');
        const iconMouse = document.getElementById('icon-mode-mouse');
        const iconStylus = document.getElementById('icon-mode-stylus');
        
        const updateModeUI = () => {
            const mode = window.ORB.appState.inputMode;
            const isStylus = mode === 'stylus';
            
            iconMouse.classList.toggle('hidden', isStylus);
            iconStylus.classList.toggle('hidden', !isStylus);
            
            btn.classList.toggle('active', isStylus);
            btn.title = isStylus ? "Mode Stylet : Dessin libre" : "Mode Souris : Point à point";
        };

        const savedMode = localStorage.getItem('inputMode');
        if (savedMode) {
            window.ORB.appState.inputMode = savedMode;
        }
        updateModeUI();

        btn.addEventListener('click', () => {
            const current = window.ORB.appState.inputMode;
            const newMode = current === 'mouse' ? 'stylus' : 'mouse';
            window.ORB.appState.inputMode = newMode;
            localStorage.setItem('inputMode', newMode);
            updateModeUI();
        });
    },

    toggleFloatingPanel: function(panel, button) {
        const isOpening = panel.classList.contains('hidden');
        document.querySelectorAll('.floating-panel').forEach(p => p.classList.add('hidden'));
        document.querySelectorAll('.header-left button, .header-right .btn-icon').forEach(b => b.classList.remove('active'));
        if (isOpening) {
            panel.classList.remove('hidden');
            button.classList.add('active');
        }
    },

    bindMainButtons: function() {
        const togglePlaybookManagerBtn = document.getElementById('toggle-playbook-manager-btn');
        const playbookManagerContainer = document.getElementById('play-manager-container');
        const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
        const settingsPanel = document.getElementById('settings-panel');

        togglePlaybookManagerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFloatingPanel(playbookManagerContainer, togglePlaybookManagerBtn);
        });

        toggleSettingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFloatingPanel(settingsPanel, toggleSettingsBtn);
        });

        window.addEventListener('click', (e) => {
            const activeFloatingPanel = document.querySelector('.floating-panel:not(.hidden)');
            if (activeFloatingPanel) {
                const button = activeFloatingPanel.id.includes('play-manager') ? togglePlaybookManagerBtn : toggleSettingsBtn;
                if (!activeFloatingPanel.contains(e.target) && !button.contains(e.target)) {
                    if (!e.target.closest('.fullscreen-view') && !e.target.closest('.hidden')) {
                         activeFloatingPanel.classList.add('hidden');
                         button.classList.remove('active');
                    }
                }
            }
        });

        document.getElementById('action-undo').addEventListener('click', () => window.ORB.undo());
        document.getElementById('action-redo').addEventListener('click', () => window.ORB.redo());
        
        document.getElementById('action-mirror').addEventListener('click', () => {
            const pbState = window.ORB.playbookState;
            const isHalf = document.body.classList.contains('view-half-court');
            const viewWidth = isHalf ? window.ORB.CONSTANTS.LOGICAL_WIDTH / 2 : window.ORB.CONSTANTS.LOGICAL_WIDTH;
            
            const currentScene = pbState.scenes[pbState.activeSceneIndex];
            currentScene.elements.forEach(el => {
                if (typeof el.x !== 'undefined') el.x = viewWidth - el.x;
                if (el.points) el.points.forEach(p => p.x = viewWidth - p.x);
                if (el.type === 'zone') el.x -= el.width;
                if (el.type === 'defender') el.rotation = (180 - el.rotation + 360) % 360;
            });
            window.ORB.commitState();
            window.ORB.renderer.redrawCanvas();
        });

        document.getElementById("tool-clear").addEventListener("click", () => {
            if (confirm("Voulez-vous vraiment effacer tous les éléments de CETTE SCÈNE ?")) {
                window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements = [];
                window.ORB.appState.playerCounter = 1;
                window.ORB.appState.defenderCounter = 1;
                window.ORB.appState.selectedElement = null;
                window.ORB.appState.currentLoadedPlaybookId = null;
                window.ORB.commitState();
                this.updatePropertiesPanel();
                window.ORB.renderer.redrawCanvas();
            }
        });
        
        document.getElementById('play-name-input').addEventListener('change', e => {
            window.ORB.playbookState.name = e.target.value;
            window.ORB.commitState();
        });
        
        document.getElementById('show-help-btn').addEventListener('click', () => {
            document.getElementById('help-view').classList.remove('hidden');
            document.getElementById('settings-panel').classList.add('hidden');
            document.getElementById('toggle-settings-btn').classList.remove('active');
        });
        
        document.getElementById('help-close-btn').addEventListener('click', () => document.getElementById('help-view').classList.add('hidden'));
    },

    bindToolButtons: function() {
        document.querySelectorAll(".tool-btn").forEach(button => {
            button.addEventListener("click", () => {
                if(!button.classList.contains('view-btn')) {
                    window.ORB.interactions.finalizeCurrentPath();
                    document.querySelectorAll(".tool-btn:not(.view-btn)").forEach(btn => btn.classList.remove("active"));
                    button.classList.add("active");
                    window.ORB.appState.currentTool = button.id.split("-")[1];
                    window.ORB.appState.selectedElement = null;
                    window.ORB.appState.selectedScene = null;
                    window.ORB.appState.tempElement = null;
                    this.updatePropertiesPanel();
                    window.ORB.renderer.redrawCanvas();
                }
            })
        });

        const viewFullBtn = document.getElementById('view-full-court-btn');
        const viewHalfBtn = document.getElementById('view-half-court-btn');
        
        const setView = (view) => {
            document.body.classList.remove("view-full-court", "view-half-court");
            document.body.classList.add(`view-${view}-court`);
            viewFullBtn.classList.toggle("active", view === "full");
            viewHalfBtn.classList.toggle("active", view === "half");
            
            const courtSvg = document.getElementById('court-svg');
            if (view === 'half') {
                courtSvg.setAttribute('viewBox', '0 0 140 150');
            } else {
                courtSvg.setAttribute('viewBox', '0 0 280 150');
            }
            window.ORB.renderer.resizeCanvas();
        };

        viewFullBtn.addEventListener("click", () => setView("full"));
        viewHalfBtn.addEventListener("click", () => setView("half"));
    },

    updateSceneListUI: function() {
        const sceneList = document.getElementById('scene-list');
        const pbState = window.ORB.playbookState;
        const appState = window.ORB.appState;

        sceneList.innerHTML = "";
        pbState.scenes.forEach((scene, index) => {
            const li = document.createElement("li");
            li.dataset.index = index;
            li.draggable = true;
            li.textContent = scene.name || `Scène ${index + 1}`;
    
            if (index === pbState.activeSceneIndex) {
                li.classList.add("active");
            }
            
            li.addEventListener("click", () => this.switchToScene(index));

            li.addEventListener("dragstart", e => {
                appState.draggedSceneIndex = index;
                e.target.classList.add("dragging");
            });
            li.addEventListener("dragend", e => {
                e.target.classList.remove("dragging");
                appState.draggedSceneIndex = null;
            });
            li.addEventListener("dragover", e => e.preventDefault());
            li.addEventListener("drop", e => {
                e.preventDefault();
                const liTarget = e.target.closest("li");
                if (appState.draggedSceneIndex === null || !liTarget) return;
                const droppedOnIndex = parseInt(liTarget.dataset.index, 10);
                if (appState.draggedSceneIndex !== droppedOnIndex) {
                    const [movedScene] = pbState.scenes.splice(appState.draggedSceneIndex, 1);
                    pbState.scenes.splice(droppedOnIndex, 0, movedScene);
                    pbState.activeSceneIndex = droppedOnIndex;
                    window.ORB.commitState();
                    this.switchToScene(droppedOnIndex);
                }
            });
            sceneList.appendChild(li);
        });
    },

    switchToScene: function(index, isUndoRedo = false) {
        const pbState = window.ORB.playbookState;
        const appState = window.ORB.appState;

        if (index < 0 || index >= pbState.scenes.length) return;
        if (!isUndoRedo) {
            window.ORB.interactions.finalizeCurrentPath();
        }
        pbState.activeSceneIndex = index;
        appState.selectedElement = null;
        appState.selectedScene = pbState.scenes[index];
        
        if (pbState.scenes[index]) {
            document.getElementById('comments-textarea').value = pbState.scenes[index].comments || "";
        }
        
        this.updateSceneListUI();
        this.updatePropertiesPanel();
        window.ORB.renderer.redrawCanvas();
    },

    bindSceneControls: function() {
        document.getElementById("add-scene-btn").addEventListener("click", () => {
            const pbState = window.ORB.playbookState;
            const currentScene = pbState.scenes[pbState.activeSceneIndex];
            const newScene = JSON.parse(JSON.stringify(currentScene));
            newScene.comments = "";
            newScene.durationOverride = null;
            const newIndex = pbState.activeSceneIndex + 1;
            newScene.name = `Scène ${pbState.scenes.length + 1}`;
            pbState.scenes.splice(newIndex, 0, newScene);
            window.ORB.appState.currentLoadedPlaybookId = null;
            window.ORB.commitState();
            this.switchToScene(newIndex);
        });

        document.getElementById("delete-scene-btn").addEventListener("click", () => {
            const pbState = window.ORB.playbookState;
            if (pbState.scenes.length <= 1) return alert("Impossible de supprimer la dernière scène.");
            if (confirm("Supprimer cette scène ?")) {
                pbState.scenes.splice(pbState.activeSceneIndex, 1);
                const newIndex = Math.min(pbState.activeSceneIndex, pbState.scenes.length - 1);
                window.ORB.appState.currentLoadedPlaybookId = null;
                window.ORB.commitState();
                this.switchToScene(newIndex);
            }
        });

        document.getElementById('comments-textarea').addEventListener("change", e => {
            const pbState = window.ORB.playbookState;
            if (pbState.scenes[pbState.activeSceneIndex]) {
                pbState.scenes[pbState.activeSceneIndex].comments = e.target.value;
                window.ORB.commitState();
            }
        });
        
        document.getElementById("animate-scene-btn").addEventListener("click", () => {
            const pbState = window.ORB.playbookState;
            const currentScene = pbState.scenes[pbState.activeSceneIndex];
            const newScene = JSON.parse(JSON.stringify(currentScene));
            newScene.comments = "";
            newScene.durationOverride = null;
            const consumedPathIds = new Set();
            const originalPlayers = currentScene.elements.filter(el => el.type === "player");
            
            currentScene.elements.filter(el => ["arrow", "dribble", "screen"].includes(el.type)).forEach(path => {
                let closestPlayer = null;
                let minDistance = window.ORB.CONSTANTS.PROXIMITY_THRESHOLD;
                originalPlayers.forEach(player => {
                    const dist = Math.hypot(player.x - path.points[0].x, player.y - path.points[0].y);
                    if (dist < minDistance) { minDistance = dist; closestPlayer = player; }
                });
                if (closestPlayer) {
                    const playerToMove = newScene.elements.find(p => p.id === closestPlayer.id);
                    if (playerToMove) {
                        const pathEnd = path.points[path.points.length - 1];
                        playerToMove.x = pathEnd.x; playerToMove.y = pathEnd.y;
                    }
                    consumedPathIds.add(path.id);
                }
            });

            const passPaths = currentScene.elements.filter(el => el.type === 'pass');
            const originalBalls = currentScene.elements.filter(el => el.type === 'ball');
            originalBalls.forEach(originalBall => {
                if (!originalBall.linkedTo) return; 
                const passer = originalPlayers.find(p => p.id === originalBall.linkedTo);
                if (!passer) return;
                const associatedPath = passPaths.find(path => !consumedPathIds.has(path.id) && Math.hypot(passer.x - path.points[0].x, passer.y - path.points[0].y) < window.ORB.CONSTANTS.PROXIMITY_THRESHOLD);
                if (associatedPath) {
                    const pathEnd = associatedPath.points[associatedPath.points.length - 1];
                    const receiver = originalPlayers.find(p => p.id !== passer.id && Math.hypot(p.x - pathEnd.x, p.y - pathEnd.y) < window.ORB.CONSTANTS.PROXIMITY_THRESHOLD);
                    if (receiver) {
                        const ballInNewScene = newScene.elements.find(b => b.id === originalBall.id);
                        if (ballInNewScene) ballInNewScene.linkedTo = receiver.id;
                        consumedPathIds.add(associatedPath.id);
                    }
                }
            });

            newScene.elements = newScene.elements.filter(el => !consumedPathIds.has(el.id));
            const newIndex = pbState.activeSceneIndex + 1;
            newScene.name = `Scène ${pbState.scenes.length + 1}`;
            pbState.scenes.splice(newIndex, 0, newScene);
            window.ORB.appState.currentLoadedPlaybookId = null;
            window.ORB.commitState();
            this.switchToScene(newIndex);
        });

        document.getElementById('play-animation-btn').addEventListener('click', () => {
            const courtView = document.body.classList.contains('view-half-court') ? 'half' : 'full';
            window.ORB.animationState.view = courtView;
            
            const player = document.getElementById('animation-player');
            player.classList.remove('hidden');
            
            const animContainer = document.getElementById('animation-container');
            animContainer.style.aspectRatio = (courtView === 'half') ? '140 / 150' : '280 / 150';
            
            const courtSvg = document.getElementById('court-svg').cloneNode(true);
            if (courtView === 'half') {
                courtSvg.setAttribute('viewBox', '0 0 140 150');
                const logo = courtSvg.querySelector('.center-court-logo');
                if (logo) logo.style.display = 'none';
            } else {
                courtSvg.setAttribute('viewBox', '0 0 280 150');
            }
            document.getElementById('animation-court-background').innerHTML = courtSvg.outerHTML;

            requestAnimationFrame(() => {
                const animRect = animContainer.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                window.ORB.animCanvas.width = animRect.width * dpr;
                window.ORB.animCanvas.height = animRect.height * dpr;
                window.ORB.animCtx.scale(dpr, dpr);

                window.ORB.animation.prepareStoryboard(courtView);
                window.ORB.animationState.startTime = 0;
                window.ORB.animationState.elapsedOffset = 0;
                window.ORB.animation.startLoop();
            });
        });

        document.getElementById('anim-play-pause-btn').addEventListener('click', () => {
             if (window.ORB.animationState.isFinished) {
                window.ORB.animationState.startTime = 0;
                window.ORB.animationState.elapsedOffset = 0;
                window.ORB.animation.startLoop();
            } else if (window.ORB.animationState.isPlaying) {
                window.ORB.animation.stopLoop();
            } else {
                window.ORB.animation.startLoop();
            }
        });

        document.getElementById('anim-close-btn').addEventListener('click', () => {
            window.ORB.animation.stopLoop();
            document.getElementById('animation-player').classList.add('hidden');
        });
    },

    updatePropertiesPanel: function() {
        const appState = window.ORB.appState;
        const pbState = window.ORB.playbookState;

        document.querySelectorAll('.prop-group').forEach(g => g.classList.add('hidden'));
        
        const propertiesPanel = document.getElementById('properties-panel');
        const noPropsMessage = document.getElementById('no-props-message');
        
        const hasSelection = appState.selectedElement || appState.selectedScene;
        
        if (!hasSelection) {
            propertiesPanel.classList.add('hidden');
        } else {
            propertiesPanel.classList.remove('hidden');
        }
        
        noPropsMessage.style.display = hasSelection ? 'none' : 'block';

        if (appState.selectedElement) {
            const el = appState.selectedElement;
            const type = el.type;
            const map = {
                'player': 'player-props', 'defender': 'defender-props', 'ball': 'ball-props',
                'cone': 'cone-props', 'hoop': 'hoop-props', 'basket': 'basket-props',
                'zone': 'zone-props', 'text': 'text-props'
            };
            
            let groupId = map[type];
            if (['arrow', 'pass', 'dribble', 'screen', 'pencil'].includes(type)) groupId = 'path-props';

            if (groupId) {
                const group = document.getElementById(groupId);
                group.classList.remove('hidden');
                
                if (el.label && group.querySelector('input[id*="label"]')) group.querySelector('input[id*="label"]').value = el.label;
                if (el.color && group.querySelector('input[type="color"]')) group.querySelector('input[type="color"]').value = el.color;
                if (typeof el.rotation !== 'undefined' && group.querySelector('input[id*="rotation"]')) group.querySelector('input[id*="rotation"]').value = el.rotation;
                if (el.text && document.getElementById('text-content-input')) document.getElementById('text-content-input').value = el.text;
                if (el.size && document.getElementById('text-size-input')) document.getElementById('text-size-input').value = el.size;
                if (el.width && document.getElementById('path-width-input')) document.getElementById('path-width-input').value = el.width;
            }
        } else if (appState.selectedScene) {
            const group = document.getElementById('scene-props');
            group.classList.remove('hidden');
            document.getElementById('scene-name-prop').value = appState.selectedScene.name || '';
            
            const durationInput = document.getElementById('scene-duration-prop');
            durationInput.value = appState.selectedScene.durationOverride ? appState.selectedScene.durationOverride / 1000 : '';
            
            const isLast = pbState.scenes.indexOf(appState.selectedScene) === pbState.scenes.length - 1;
            durationInput.disabled = isLast;
        }
    },

    bindPropertiesPanel: function() {
        const panel = document.getElementById('properties-panel');
        
        panel.addEventListener('click', (e) => {
            if (e.target === panel && window.innerWidth <= 1024) {
                window.ORB.appState.selectedElement = null;
                window.ORB.appState.selectedScene = null;
                this.updatePropertiesPanel();
                window.ORB.renderer.redrawCanvas();
            }
        });

        panel.addEventListener('change', e => {
            const appState = window.ORB.appState;
            if (appState.selectedElement) {
                const val = e.target.value;
                const id = e.target.id;
                
                if (id.startsWith('text-content')) appState.selectedElement.text = val;
                else if (id.includes('color')) appState.selectedElement.color = val;
                else if (id.includes('label')) appState.selectedElement.label = val;
                else if (id.includes('size') || id.includes('width') || id.includes('rotation')) {
                    const parts = id.split('-');
                    const key = parts[1]; 
                    appState.selectedElement[key] = parseFloat(val);
                }
                window.ORB.commitState();
                window.ORB.renderer.redrawCanvas();
            } else if (appState.selectedScene) {
                if (e.target.id === 'scene-name-prop') {
                    appState.selectedScene.name = e.target.value;
                    this.updateSceneListUI();
                } else if (e.target.id === 'scene-duration-prop') {
                    const d = parseFloat(e.target.value);
                    appState.selectedScene.durationOverride = (d && d > 0) ? d * 1000 : null;
                }
                window.ORB.commitState();
            }
        });

        panel.addEventListener('input', e => {
             if (window.ORB.appState.selectedElement && (e.target.type === 'range' || e.target.type === 'color')) {
                 const parts = e.target.id.split('-');
                 const key = parts[1] === 'color' ? 'color' : parts[1];
                 if (key === 'color') window.ORB.appState.selectedElement.color = e.target.value;
                 else window.ORB.appState.selectedElement[key] = parseFloat(e.target.value);
                 window.ORB.renderer.redrawCanvas();
             }
        });
        
        panel.addEventListener('click', e => {
            if (e.target.classList.contains('color-swatch') && window.ORB.appState.selectedElement) {
                const color = e.target.dataset.color;
                window.ORB.appState.selectedElement.color = color;
                const input = e.target.closest('.prop-group').querySelector('input[type="color"]');
                if (input) input.value = color;
                window.ORB.commitState();
                window.ORB.renderer.redrawCanvas();
            }
        });
    },
    
    initColorPalettes: function() {
        const createPalette = (id, colors) => {
            const container = document.querySelector(`#${id} .color-palette`);
            if (!container) return;
            container.innerHTML = '';
            colors.forEach(c => {
                const d = document.createElement('div');
                d.className = 'color-swatch'; d.style.backgroundColor = c; d.dataset.color = c;
                container.appendChild(d);
            });
        };
        createPalette('player-props', ['#d32f2f', '#007bff', '#28a745', '#ffc107', '#343a40', '#f8f9fa']);
        createPalette('defender-props', ['#d32f2f', '#007bff', '#28a745', '#ffc107', '#343a40', '#f8f9fa']);
        createPalette('path-props', ['#d32f2f', '#007bff', '#28a745', '#ffc107', '#343a40', '#f8f9fa']);
        createPalette('text-props', ['#d32f2f', '#007bff', '#28a745', '#ffc107', '#343a40', '#f8f9fa']);
        createPalette('zone-props', ['#ffeb3b', '#8bc34a', '#2196f3', '#e91e63']);
        createPalette('cone-props', ['#ff7f50', '#ff4500', '#fca503', '#4682b4', '#333333']);
        createPalette('hoop-props', ['#ff0000', '#0000ff', '#00ff00', '#ffff00', '#ff69b4']);
        createPalette('basket-props', ['#E65100', '#696969', '#000000']);
    },

    updateUndoRedoButtons: function() {
        document.getElementById('action-undo').disabled = window.ORB.history.length <= 1;
        document.getElementById('action-redo').disabled = window.ORB.redoStack.length === 0;
    },

    bindExports: function() {
        document.getElementById('save-file-btn').addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(window.ORB.playbookState, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${window.ORB.playbookState.name.trim() || 'playbook'}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        });
        
        const fileInput = document.getElementById('import-file-input');
        document.getElementById('load-file-btn').addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (data.scenes) {
                        window.ORB.playbookState = data;
                        window.ORB.appState.currentLoadedPlaybookId = null;
                        window.ORB.history = []; window.ORB.redoStack = [];
                        window.ORB.commitState();
                        document.getElementById('play-name-input').value = window.ORB.playbookState.name;
                        this.switchToScene(0);
                        document.getElementById('play-manager-container').classList.add('hidden');
                        alert("Playbook importé !");
                    } else if (data.version === "orb_backup_v1") {
                        if (confirm("Importer ce backup remplacera TOUTES vos données. Continuer ?")) {
                            orbDB.importBackupData(data.data).then(() => {
                                alert("Backup restauré. Rechargement...");
                                window.location.reload();
                            }).catch(err => alert("Erreur import backup: " + err));
                        }
                    }
                } catch(err) { alert("Fichier invalide."); }
            };
            reader.readAsText(file);
            e.target.value = '';
        });

        document.getElementById('save-to-library-btn').addEventListener('click', async () => {
            const btn = document.getElementById('save-to-library-btn');
            btn.disabled = true; btn.textContent = "Sauvegarde...";
            try {
                const blob = await new Promise(resolve => {
                    html2canvas(document.getElementById('court-container'), { scale: 0.4, useCORS: true, logging: false })
                        .then(c => c.toBlob(b => resolve(b), 'image/jpeg', 0.7));
                });
                const id = await orbDB.savePlaybook(window.ORB.playbookState, blob, window.ORB.appState.currentLoadedPlaybookId);
                window.ORB.appState.currentLoadedPlaybookId = id;
                alert(`Playbook "${window.ORB.playbookState.name}" sauvegardé !`);
                if (!document.getElementById('library-view').classList.contains('hidden')) {
                    document.getElementById('show-library-btn').click();
                }
            } catch(e) { console.error(e); alert("Erreur sauvegarde."); }
            finally { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M17 3H7C5.9 3 5 3.9 5 5V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V5C19 3.9 18.1 3 17 3M17 19H7V5H17V19M12 9L10 11H13V15H11V13L9 15L11 17V15H15V11H13L15 9H12Z"/></svg> Sauvegarder'; }
        });

        // --- EXPORT COMPLET (BACKUP) ---
        document.getElementById('export-all-data-btn').addEventListener('click', async () => {
            const button = document.getElementById('export-all-data-btn');
            const originalHtml = button.innerHTML;
            button.disabled = true;
            button.textContent = 'Préparation...';
            
            const blobToDataURL = (blob) => {
                return new Promise((resolve) => {
                    if (!blob || !(blob instanceof Blob)) { resolve(null); return; }
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(blob);
                });
            };
            
            try {
                const playbooks = await orbDB.getAllPlaybooks();
                const tags = await orbDB.getAllTags();
                const plans = await orbDB.getAllPlans();
                
                // AJOUT DES NOUVEAUX STORES
                const calendarEvents = await orbDB.getAllCalendarEvents();
                const players = await orbDB.getAllPlayers();
                const teams = await orbDB.getAllTeams();

                const serializablePlaybooks = await Promise.all(
                    playbooks.map(async (pb) => {
                        const previewDataUrl = await blobToDataURL(pb.preview);
                        return { ...pb, preview: previewDataUrl };
                    })
                );
                
                const allData = {
                    version: "orb_backup_v1",
                    createdAt: new Date().toISOString(),
                    data: { 
                        playbooks: serializablePlaybooks, 
                        tags, 
                        trainingPlans: plans,
                        calendarEvents, 
                        players, 
                        teams 
                    }
                };
                
                const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `orb_backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            } catch (error) { console.error("Erreur Backup:", error); alert("Erreur lors du backup."); } 
            finally { button.disabled = false; button.innerHTML = originalHtml; }
        });

        document.getElementById('export-pdf-btn').addEventListener("click", async () => {
             if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') return alert("Erreur lib PDF.");
             const { jsPDF } = window.jspdf;
             const pbState = window.ORB.playbookState; 
             const originalIndex = pbState.activeSceneIndex;
             const doc = new jsPDF("portrait", "mm", "a4");
             const MARGIN = 15;
             const PAGE_WIDTH = doc.internal.pageSize.getWidth();
             const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
             const isCrab = document.body.classList.contains('crab-mode');
             const COLORS = window.ORB.CONSTANTS.COLORS;
             const PRIMARY = isCrab ? COLORS.crabPrimary : COLORS.primary;
             const TEXT = isCrab ? COLORS.crabPrimary : '#212121';
             const SEC = isCrab ? COLORS.crabSecondary : '#212121';
             const playName = pbState.name || "Playbook";
             let scenesPerPage = parseInt(document.getElementById('pdf-scenes-per-page').value, 10) || 1;
             if (scenesPerPage < 1 || scenesPerPage > 6) scenesPerPage = 1;
             const addHeader = (doc, title) => {
                doc.setFillColor(PRIMARY);
                doc.rect(0, 0, PAGE_WIDTH, MARGIN + 5, 'F');
                doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.setTextColor('#FFFFFF');
                doc.text(title, PAGE_WIDTH / 2, MARGIN, { align: "center" });
             };
             const addFooter = (doc, pageNum, totalPages) => {
                doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(150);
                doc.text(`Page ${pageNum} / ${totalPages}`, PAGE_WIDTH / 2, PAGE_HEIGHT - (MARGIN / 2), { align: "center" });
             };
             const layoutConfig = { 1: {rows:1,cols:1}, 2:{rows:2,cols:1}, 3:{rows:3,cols:1}, 4:{rows:2,cols:2}, 5:{rows:3,cols:2}, 6:{rows:3,cols:2} }[scenesPerPage > 4 ? 6 : scenesPerPage];
             const totalScenePages = Math.ceil(pbState.scenes.length / scenesPerPage);
             if (pbState.scenes.length === 0) return alert("Aucune scène.");
             for (let i = 0; i < pbState.scenes.length; i++) {
                const pageIndex = Math.floor(i / scenesPerPage);
                const sceneIndexOnPage = i % scenesPerPage;
                if (sceneIndexOnPage === 0) {
                    if (i > 0) doc.addPage();
                    addHeader(doc, playName);
                    addFooter(doc, pageIndex + 1, totalScenePages);
                }
                await this.switchToScene(i, true);
                await new Promise(r => setTimeout(r, 50));
                const courtImage = await html2canvas(document.getElementById('court-container'), { scale: 1.5, backgroundColor: null });
                const cellWidth = (PAGE_WIDTH - MARGIN * (layoutConfig.cols + 1)) / layoutConfig.cols;
                const cellHeight = (PAGE_HEIGHT - MARGIN * 4) / layoutConfig.rows;
                const colIndex = sceneIndexOnPage % layoutConfig.cols;
                const rowIndex = Math.floor(sceneIndexOnPage / layoutConfig.cols);
                const cellX = MARGIN + colIndex * (cellWidth + MARGIN);
                const cellY = MARGIN * 2.5 + rowIndex * (cellHeight + MARGIN);
                doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(TEXT);
                const sceneTitle = pbState.scenes[i].name || `Scène ${i + 1}`;
                doc.text(sceneTitle, cellX, cellY);
                doc.setDrawColor(isCrab ? SEC : PRIMARY); doc.setLineWidth(0.5);
                doc.line(cellX, cellY + 1, cellX + 30, cellY + 1);
                const diagramHeightRatio = 0.6;
                const diagramContainerHeight = cellHeight * diagramHeightRatio;
                const imgData = courtImage.toDataURL("image/jpeg", 0.8);
                const imgHeight = Math.min(diagramContainerHeight - 5, courtImage.height * cellWidth / courtImage.width);
                const imgWidth = courtImage.width * imgHeight / courtImage.height;
                doc.addImage(imgData, "JPEG", cellX, cellY + 5, imgWidth, imgHeight, undefined, 'FAST');
                const commentsY = cellY + diagramContainerHeight + 3;
                const comments = pbState.scenes[i].comments;
                if (comments) {
                    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(TEXT);
                    doc.text(doc.splitTextToSize(comments, cellWidth - 4), cellX + 2, commentsY + 4);
                }
             }
             doc.save(`${playName}.pdf`);
             await this.switchToScene(originalIndex);
        });
        document.getElementById('export-video-btn').addEventListener('click', () => window.ORB.animation.exportVideo());
    },

    bindTheme: function() {
        const updateTheme = (theme) => {
            const isDark = theme === 'dark';
            document.body.classList.toggle('dark-mode', isDark);
            document.getElementById('theme-icon-sun').classList.toggle('hidden', isDark);
            document.getElementById('theme-icon-moon').classList.toggle('hidden', !isDark);
        };
        const saved = localStorage.getItem('theme') || 'light';
        updateTheme(saved);
        document.getElementById('theme-toggle-btn').addEventListener('click', () => {
            const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            updateTheme(newTheme);
        });
        const teamBtn = document.getElementById('team-theme-btn');
        const updateTeamUI = (isCrab) => {
            if (isCrab) {
                document.body.classList.add('crab-mode');
                teamBtn.classList.add('active');
                const svg = document.getElementById('court-svg');
                svg.querySelector('rect[width="280"]').setAttribute('fill', window.ORB.CONSTANTS.COLORS.crabPrimary);
                svg.querySelector('.center-court-logo circle:first-child').setAttribute('fill', window.ORB.CONSTANTS.COLORS.crabPrimary);
                svg.querySelectorAll('line, path, circle, rect:not([width="280"])').forEach(el => {
                     if(el.getAttribute('stroke')) el.setAttribute('stroke', window.ORB.CONSTANTS.COLORS.crabSecondary);
                });
                const txt = svg.querySelector('.center-court-logo text');
                if(txt) { txt.textContent = "CRAB"; txt.setAttribute('fill', window.ORB.CONSTANTS.COLORS.crabSecondary); }
            } else {
                document.body.classList.remove('crab-mode');
                teamBtn.classList.remove('active');
                 const svg = document.getElementById('court-svg');
                svg.querySelector('rect[width="280"]').setAttribute('fill', window.ORB.CONSTANTS.COLORS.primary);
                svg.querySelector('.center-court-logo circle:first-child').setAttribute('fill', window.ORB.CONSTANTS.COLORS.primary);
                svg.querySelectorAll('line, path, circle, rect:not([width="280"])').forEach(el => {
                     if(el.getAttribute('stroke')) el.setAttribute('stroke', window.ORB.CONSTANTS.COLORS.secondary);
                });
                const txt = svg.querySelector('.center-court-logo text');
                if(txt) { txt.textContent = "ORB"; txt.setAttribute('fill', window.ORB.CONSTANTS.COLORS.secondary); }
            }
            window.ORB.renderer.redrawCanvas();
        };
        if (localStorage.getItem('teamMode') === 'crab') updateTeamUI(true);
        teamBtn.addEventListener('click', () => {
            const isCrab = !document.body.classList.contains('crab-mode');
            localStorage.setItem('teamMode', isCrab ? 'crab' : 'orb');
            updateTeamUI(isCrab);
        });
    }
};