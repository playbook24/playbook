// NOTE : 'window.onload' est remplacé par 'DOMContentLoaded' pour plus de rapidité
// et pour éviter les conflits si 'window.onload' est déjà utilisé.
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Initialisation ---
    const canvas = document.getElementById('basketball-court');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // --- Constantes et État Global ---
    const LOGICAL_WIDTH = 280;
    const LOGICAL_HEIGHT = 150;
    const PROXIMITY_THRESHOLD = 20;
    
    const DEFAULT_ANIMATION_SPEED = 50;
    const DEFAULT_ANTICIPATION_RATIO = 0.3;
    const MIN_SCENE_DURATION = 1000;
    const PASS_DURATION = 800; 

    let playbookState = {
        name: "Playbook",
        scenes: [{
            name: "Scène 1",
            elements: [],
            comments: '',
            durationOverride: null 
        }],
        activeSceneIndex: 0,
        animationSettings: {
            speed: DEFAULT_ANIMATION_SPEED,
            ratio: DEFAULT_ANTICIPATION_RATIO,
        }
    };
    
    // --- CORRECTION v4.5 ---
    // Ajout d'une variable pour suivre l'ID du playbook chargé
    let currentLoadedPlaybookId = null; 
    // --- FIN CORRECTION ---
    
    let history = [];
    let redoStack = [];
    let isRestoringState = false;

    let currentTool = 'select';
    let selectedElement = null;
    let selectedScene = null;
    let dragStartElementState = null; 
    let isDragging = false;
    let isDrawing = false;
    let currentPath = [];
    let isMouseDown = false;
    let startDragPos = { x: 0, y: 0 };
    let lastMousePos = { x: 0, y: 0 };
    let draggedSceneIndex = null;
    let tempElement = null;

    const pathTools = ['arrow', 'pass', 'dribble', 'screen', 'pencil'];
    const singleClickTools = ['player', 'defender', 'ball', 'cone', 'hoop', 'basket'];
    const dragTools = ['zone'];

    let playerCounter = 1;
    let defenderCounter = 1;

    // --- Références au DOM ---
    const body = document.body;
    
    const togglePlaybookManagerBtn = document.getElementById('toggle-playbook-manager-btn');
    const playbookManagerContainer = document.getElementById('play-manager-container');
    
    const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    
    const showHelpBtn = document.getElementById('show-help-btn');
    const helpView = document.getElementById('help-view');
    const helpCloseBtn = document.getElementById('help-close-btn');

    const viewFullCourtBtn = document.getElementById('view-full-court-btn');
    const viewHalfCourtBtn = document.getElementById('view-half-court-btn');
    
    const propertiesPanel = document.getElementById('properties-panel');
    const noPropsMessage = document.getElementById('no-props-message');
    const allPropGroups = {
        scene: { group: document.getElementById('scene-props'), name: document.getElementById('scene-name-prop'), duration: document.getElementById('scene-duration-prop') },
        player: { group: document.getElementById('player-props'), label: document.getElementById('player-label-input'), color: document.getElementById('player-color-input') },
        defender: { group: document.getElementById('defender-props'), label: document.getElementById('defender-label-input'), color: document.getElementById('defender-color-input'), rotation: document.getElementById('defender-rotation-input') },
        ball: { group: document.getElementById('ball-props'), color: document.getElementById('ball-color-input') },
        cone: { group: document.getElementById('cone-props'), color: document.getElementById('cone-color-input') },
        hoop: { group: document.getElementById('hoop-props'), color: document.getElementById('hoop-color-input') },
        basket: { group: document.getElementById('basket-props'), color: document.getElementById('basket-color-input') },
        zone: { group: document.getElementById('zone-props'), color: document.getElementById('zone-color-input') },
        text: { group: document.getElementById('text-props'), content: document.getElementById('text-content-input'), color: document.getElementById('text-color-input'), size: document.getElementById('text-size-input') },
        path: { group: document.getElementById('path-props'), color: document.getElementById('path-color-input'), width: document.getElementById('path-width-input') }
    };
    
    const addSceneBtn = document.getElementById('add-scene-btn'),
        animateSceneBtn = document.getElementById('animate-scene-btn'),
        deleteSceneBtn = document.getElementById('delete-scene-btn'),
        sceneList = document.getElementById('scene-list'),
        commentsTextarea = document.getElementById('comments-textarea');
    
    const playNameInput = document.getElementById('play-name-input'),
        saveFileBtn = document.getElementById('save-file-btn'),
        loadFileBtn = document.getElementById('load-file-btn'),
        importFileInput = document.getElementById('import-file-input'),
        saveToLibraryBtn = document.getElementById('save-to-library-btn'), 
        exportPdfBtn = document.getElementById('export-pdf-btn'),
        exportVideoBtn = document.getElementById('export-video-btn'),
        exportAllDataBtn = document.getElementById('export-all-data-btn');
    
    const undoBtn = document.getElementById('action-undo');
    const redoBtn = document.getElementById('action-redo');
    
    const playAnimationBtn = document.getElementById('play-animation-btn');
    const animationPlayer = document.getElementById('animation-player');
    const animCanvas = document.getElementById('animation-canvas');
    const animCtx = animCanvas.getContext('2d');
    const animCourtBackground = document.getElementById('animation-court-background');
    const animPlayPauseBtn = document.getElementById('anim-play-pause-btn');
    const animIconPlay = document.getElementById('anim-icon-play');
    const animIconPause = document.getElementById('anim-icon-pause');
    const animCloseBtn = document.getElementById('anim-close-btn');
    const animTimeDisplay = document.getElementById('anim-time-display');
    
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIconSun = document.getElementById('theme-icon-sun');
    const themeIconMoon = document.getElementById('theme-icon-moon');

    // NOUVEAU : Bouton Thème Équipe
    const teamThemeBtn = document.getElementById('team-theme-btn');


    let animationState = {
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
    };
    const PASS_RATIO = 0.5;

    // --- GESTION DES PANNEAUX FLOTTANTS (Playbook & Settings) ---
    
    function toggleFloatingPanel(panel, button) {
        const isOpening = panel.classList.contains('hidden');
        document.querySelectorAll('.floating-panel').forEach(p => p.classList.add('hidden'));
        document.querySelectorAll('.header-left button, .header-right .btn-icon').forEach(b => b.classList.remove('active'));
        if (isOpening) {
            panel.classList.remove('hidden');
            button.classList.add('active');
        }
    }

    togglePlaybookManagerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFloatingPanel(playbookManagerContainer, togglePlaybookManagerBtn);
    });

    toggleSettingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFloatingPanel(settingsPanel, toggleSettingsBtn);
    });

    window.addEventListener('click', (e) => {
        const activeFloatingPanel = document.querySelector('.floating-panel:not(.hidden)');
        if (activeFloatingPanel) {
            const button = activeFloatingPanel.id.includes('play-manager') ? togglePlaybookManagerBtn : toggleSettingsBtn;
            if (!activeFloatingPanel.contains(e.target) && !button.contains(e.target)) {
                activeFloatingPanel.classList.add('hidden');
                button.classList.remove('active');
            }
        }
    });
    // --- FIN GESTION PANNEAUX FLOTTANTS ---
    
    
    // --- GESTION VUE AIDE ---
    showHelpBtn.addEventListener('click', () => {
        helpView.classList.remove('hidden');
    });
    helpCloseBtn.addEventListener('click', () => {
        helpView.classList.add('hidden');
    });
    // --- FIN GESTION VUE AIDE ---


    function commitState() {
        if (isRestoringState) return;
        const stateCopy = JSON.parse(JSON.stringify(playbookState));
        history.push(stateCopy);
        redoStack = [];
        if (history.length > 50) {
            history.shift();
        }
        updateUndoRedoButtons();
    }
    
    function undo() {
        if (history.length <= 1) return;
        isRestoringState = true;
        const currentState = history.pop();
        redoStack.push(currentState);
        const prevState = history[history.length - 1];
        playbookState = JSON.parse(JSON.stringify(prevState));
        playNameInput.value = playbookState.name;
        switchToScene(playbookState.activeSceneIndex, true);
        isRestoringState = false;
        updateUndoRedoButtons();
    }
    
    function redo() {
        if (redoStack.length === 0) return;
        isRestoringState = true;
        const nextState = redoStack.pop();
        history.push(nextState);
        playbookState = JSON.parse(JSON.stringify(nextState));
        playNameInput.value = playbookState.name;
        switchToScene(playbookState.activeSceneIndex, true);
        isRestoringState = false;
        updateUndoRedoButtons();
    }
    
    function updateUndoRedoButtons() {
        undoBtn.disabled = history.length <= 1;
        redoBtn.disabled = redoStack.length === 0;
    }

    function getPixelCoords(logicalPos) {
        const rect = canvas.getBoundingClientRect();
        const viewWidth = body.classList.contains('view-half-court') ? LOGICAL_WIDTH / 2 : LOGICAL_WIDTH;
        return {
            x: (logicalPos.x / viewWidth) * rect.width,
            y: (logicalPos.y / LOGICAL_HEIGHT) * rect.height
        };
    }
    
    function getAnimPixelCoords(logicalPos, customRect = null, p_animationState = animationState) {
        const rect = customRect || animCanvas.getBoundingClientRect();
        const viewWidth = (p_animationState.view === 'half') ? LOGICAL_WIDTH / 2 : LOGICAL_WIDTH;
        
        let transformedX = logicalPos.x;
        if (p_animationState.view === 'half' && p_animationState.activeHalf === 'right') {
            transformedX -= LOGICAL_WIDTH / 2;
        }

        return {
            x: (transformedX / viewWidth) * rect.width,
            y: (logicalPos.y / LOGICAL_HEIGHT) * rect.height
        };
    }

    function resizeCanvas() {
        return new Promise(resolve => {
            setTimeout(() => {
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                ctx.scale(dpr, dpr);
                redrawCanvas();
                resolve();
            }, 450);
        });
    }
    window.addEventListener('resize', resizeCanvas);

    function drawPlayer(logicalX, logicalY, isSelected, options = {}, p_ctx = ctx, p_getCoordsFn = getPixelCoords, animParams = {}) {
        const { x, y } = p_getCoordsFn({ x: logicalX, y: logicalY });
        const radius = 10;
        
        let hasBall = false;
        if (animParams.isAnimating) {
            if(animParams.passData && animParams.passData.length > 0) {
                hasBall = animParams.passData.some(pass => 
                    (pass.passerId === options.id && animParams.rawProgress < PASS_RATIO) ||
                    (pass.receiverId === options.id && animParams.rawProgress >= PASS_RATIO)
                );
            } else {
                 const currentScene = playbookState.scenes[animParams.sceneIndex];
                 if(currentScene) hasBall = currentScene.elements.some(el => el.type === 'ball' && el.linkedTo === options.id);
            }
        } else {
            const currentScene = playbookState.scenes[playbookState.activeSceneIndex];
            if(currentScene) hasBall = currentScene.elements.some(el => el.type === 'ball' && el.linkedTo === options.id);
        }
        
        p_ctx.save();
        p_ctx.translate(x, y);
        if (options.rotation) {
             p_ctx.rotate(options.rotation);
        }
        p_ctx.beginPath();
        p_ctx.arc(0, 0, radius, 0, Math.PI * 2);
        p_ctx.fillStyle = options.color || '#007BFF';
        p_ctx.fill();
        
        if (animParams.isAnimating) {
            p_ctx.beginPath();
            p_ctx.moveTo(radius * 0.3, 0);
            p_ctx.lineTo(radius, 0);
            p_ctx.strokeStyle = '#FFFFFF';
            p_ctx.lineWidth = 2;
            p_ctx.stroke();
        }
        
        p_ctx.rotate(-(options.rotation || 0));

        p_ctx.strokeStyle = isSelected ? '#FFD700' : (hasBall ? '#FFA500' : '#FFFFFF');
        p_ctx.lineWidth = hasBall ? 2.5 : 2;
        p_ctx.beginPath();
        p_ctx.arc(0, 0, radius, 0, Math.PI * 2);
        p_ctx.stroke();
        
        if (options.label) {
            p_ctx.fillStyle = '#FFFFFF';
            p_ctx.font = `bold ${radius + 2}px Roboto`;
            p_ctx.textAlign = 'center';
            p_ctx.textBaseline = 'middle';
            p_ctx.fillText(options.label, 0, 0);
        }
        p_ctx.restore();
    }

    function drawDefender(logicalX, logicalY, isSelected, options = {}, p_ctx = ctx, p_getCoordsFn = getPixelCoords) {
        const { x, y } = p_getCoordsFn({ x: logicalX, y: logicalY });
        const radius = 10;
        const angle = (options.rotation || 0);
        p_ctx.save();
        p_ctx.translate(x, y);
        p_ctx.rotate(angle);
        p_ctx.beginPath();
        p_ctx.arc(0, 0, radius, -Math.PI / 2.5, Math.PI / 2.5);
        p_ctx.strokeStyle = isSelected ? '#FFD700' : (options.color || '#D32F2F');
        p_ctx.lineWidth = 3;
        p_ctx.stroke();
        p_ctx.restore();
        if (options.label) {
            p_ctx.fillStyle = isSelected ? '#FFD700' : (options.color || '#D32F2F');
            p_ctx.font = `bold ${radius}px Roboto`;
            p_ctx.textAlign = 'center';
            p_ctx.textBaseline = 'bottom';
            p_ctx.fillText(options.label, x, y - radius - 5);
        }
    }

    function drawBall(logicalX, logicalY, isSelected, options = {}, p_ctx = ctx, p_getCoordsFn = getPixelCoords) {
        const { x, y } = p_getCoordsFn({ x: logicalX, y: logicalY });
        const radius = 6;
        p_ctx.beginPath();
        p_ctx.arc(x, y, radius, 0, Math.PI * 2);
        p_ctx.fillStyle = options.color || '#E65100';
        p_ctx.fill();
        if (isSelected) {
            p_ctx.strokeStyle = '#FFD700';
            p_ctx.lineWidth = 2;
            p_ctx.stroke();
        }
    }

    function drawCone(logicalX, logicalY, isSelected, options = {}, p_ctx = ctx, p_getCoordsFn = getPixelCoords) {
        const { x, y } = p_getCoordsFn({ x: logicalX, y: logicalY });
        const size = 8;
        p_ctx.beginPath();
        p_ctx.moveTo(x - size, y + size);
        p_ctx.lineTo(x + size, y + size);
        p_ctx.lineTo(x, y - size);
        p_ctx.closePath();
        p_ctx.fillStyle = options.color || '#FFA500';
        p_ctx.fill();
        if (isSelected) {
            p_ctx.strokeStyle = '#FFD700';
            p_ctx.lineWidth = 2;
            p_ctx.stroke();
        }
    }

    function drawHoop(logicalX, logicalY, isSelected, options = {}, p_ctx = ctx, p_getCoordsFn = getPixelCoords) {
        const { x, y } = p_getCoordsFn({ x: logicalX, y: logicalY });
        const radius = 8;
        p_ctx.beginPath();
        p_ctx.arc(x, y, radius, 0, Math.PI * 2);
        p_ctx.strokeStyle = isSelected ? '#FFD700' : (options.color || '#FF0000');
        p_ctx.lineWidth = 3;
        p_ctx.stroke();
    }

    function drawBasket(logicalX, logicalY, isSelected, options = {}, p_ctx = ctx, p_getCoordsFn = getPixelCoords) {
        const { x, y } = p_getCoordsFn({ x: logicalX, y: logicalY });
        const backboardWidth = 18;
        const backboardHeight = 12;
        const hoopRadius = 6;
        p_ctx.save();
        p_ctx.fillStyle = '#6C757D';
        p_ctx.fillRect(x - backboardWidth / 2, y - backboardHeight / 2, backboardWidth, backboardHeight);
        p_ctx.strokeStyle = isSelected ? '#FFD700' : (options.color || '#E65100');
        p_ctx.lineWidth = 2;
        p_ctx.beginPath();
        p_ctx.arc(x, y + backboardHeight / 2, hoopRadius, 0, Math.PI);
        p_ctx.stroke();
        p_ctx.restore();
    }

    function drawZone(logicalX, logicalY, width, height, isSelected, options = {}, p_ctx = ctx, p_getCoordsFn = getPixelCoords) {
        const p1 = p_getCoordsFn({ x: logicalX, y: logicalY });
        const p2 = p_getCoordsFn({ x: logicalX + width, y: logicalY + height });
        p_ctx.save();
        p_ctx.fillStyle = options.color || '#FFEB3B';
        p_ctx.globalAlpha = 0.4;
        p_ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        if (isSelected) {
            p_ctx.globalAlpha = 1;
            p_ctx.strokeStyle = '#FFD700';
            p_ctx.lineWidth = 2;
            p_ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        }
        p_ctx.restore();
    }

    function drawText(logicalX, logicalY, isSelected, options = {}, p_ctx = ctx, p_getCoordsFn = getPixelCoords) {
        const { x, y } = p_getCoordsFn({ x: logicalX, y: logicalY });
        const size = options.size || 14;
        p_ctx.font = `bold ${size}px Roboto`;
        p_ctx.fillStyle = isSelected ? '#FFD700' : (options.color || '#212121');
        p_ctx.textAlign = 'center';
        p_ctx.textBaseline = 'middle';
        p_ctx.fillText(options.text, x, y);
    }
    
    function drawPath(logicalPoints, isSelected, options = {}, p_ctx = ctx, p_getCoordsFn = getPixelCoords) {
        if (!logicalPoints || logicalPoints.length < 2) return;
        const pixelPoints = logicalPoints.map(p => p_getCoordsFn(p));
        p_ctx.save();
        p_ctx.strokeStyle = isSelected ? '#FFD700' : (options.color || '#212121');
        p_ctx.lineWidth = options.width || 2.5;
        p_ctx.lineCap = 'round';
        p_ctx.lineJoin = 'round';
        if (options.type === 'pass') p_ctx.setLineDash([5, 5]);
        p_ctx.beginPath();
        p_ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
        if (options.type === 'pencil') {
            for (let i = 1; i < pixelPoints.length - 1; i++) {
                const xc = (pixelPoints[i].x + pixelPoints[i + 1].x) / 2;
                const yc = (pixelPoints[i].y + pixelPoints[i + 1].y) / 2;
                p_ctx.quadraticCurveTo(pixelPoints[i].x, pixelPoints[i].y, xc, yc);
            }
            if (pixelPoints.length > 1) {
                p_ctx.lineTo(pixelPoints[pixelPoints.length - 1].x, pixelPoints[pixelPoints.length - 1].y);
            }
        } else if (options.type === 'dribble') {
            for (let i = 1; i < pixelPoints.length; i++) {
                drawZigZagSegment(pixelPoints[i - 1], pixelPoints[i], p_ctx);
            }
        } else {
            for (let i = 1; i < pixelPoints.length - 1; i++) {
                const xc = (pixelPoints[i].x + pixelPoints[i + 1].x) / 2;
                const yc = (pixelPoints[i].y + pixelPoints[i + 1].y) / 2;
                p_ctx.quadraticCurveTo(pixelPoints[i].x, pixelPoints[i].y, xc, yc);
            }
             if (pixelPoints.length > 1) {
                p_ctx.lineTo(pixelPoints[pixelPoints.length - 1].x, pixelPoints[pixelPoints.length - 1].y);
            }
        }
        p_ctx.stroke();
        p_ctx.restore();
        if (options.type === 'pencil' || options.noHead) return;
        
        p_ctx.save();
        const endPoint = pixelPoints[pixelPoints.length - 1];
        let nearEndPoint = pixelPoints[pixelPoints.length - 2] || pixelPoints[0];
        if (pixelPoints.length > 2 && endPoint.x === nearEndPoint.x && endPoint.y === nearEndPoint.y) {
            nearEndPoint = pixelPoints[pixelPoints.length - 3] || pixelPoints[0];
        }
        const angle = Math.atan2(endPoint.y - nearEndPoint.y, endPoint.x - nearEndPoint.x);
        p_ctx.fillStyle = isSelected ? '#FFD700' : (options.color || '#212121');
        p_ctx.strokeStyle = p_ctx.fillStyle;
        p_ctx.lineWidth = 2;
        if (options.type === 'screen') {
            const barLength = 10;
            const p1x = endPoint.x + barLength * Math.cos(angle + Math.PI / 2);
            const p1y = endPoint.y + barLength * Math.sin(angle + Math.PI / 2);
            const p2x = endPoint.x + barLength * Math.cos(angle - Math.PI / 2);
            const p2y = endPoint.y + barLength * Math.sin(angle - Math.PI / 2);
            p_ctx.beginPath();
            p_ctx.moveTo(p1x, p1y);
            p_ctx.lineTo(p2x, p2y);
            p_ctx.stroke();
        } else {
            const headlen = 10;
            p_ctx.beginPath();
            p_ctx.moveTo(endPoint.x, endPoint.y);
            p_ctx.lineTo(endPoint.x - headlen * Math.cos(angle - Math.PI / 6), endPoint.y - headlen * Math.sin(angle - Math.PI / 6));
            p_ctx.lineTo(endPoint.x - headlen * Math.cos(angle + Math.PI / 6), endPoint.y - headlen * Math.sin(angle + Math.PI / 6));
            p_ctx.closePath();
            p_ctx.fill();
        }
        p_ctx.restore();
    }

    function drawZigZagSegment(start, end, p_ctx = ctx) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 2) {
            p_ctx.lineTo(end.x, end.y);
            return;
        };
        const angle = Math.atan2(dy, dx);
        const perpAngle = angle + Math.PI / 2;
        const segmentCount = Math.ceil(dist / 15);
        const amplitude = 4;
        for (let j = 1; j <= segmentCount; j++) {
            const p = (j - 0.5) / segmentCount;
            const mX = start.x + p * dx;
            const mY = start.y + p * dy;
            const side = (j % 2 === 0) ? -1 : 1;
            const zX = mX - (side * amplitude * Math.cos(perpAngle));
            const zY = mY - (side * amplitude * Math.sin(perpAngle));
            p_ctx.lineTo(zX, zY);
        }
        p_ctx.lineTo(end.x, end.y);
    }
    function redrawCanvas() {
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        if (!playbookState.scenes[playbookState.activeSceneIndex]) return;
        const elements = playbookState.scenes[playbookState.activeSceneIndex].elements;

        const drawOrder = [
            ['zone'], ['arrow', 'pass', 'dribble', 'screen', 'pencil'],
            ['cone', 'hoop', 'basket'], ['defender', 'player'],
            ['ball'], ['text']
        ];

        drawOrder.forEach(types => {
            elements.filter(el => types.includes(el.type)).forEach(el => {
                if (el.type === 'ball' && el.linkedTo) return;
                
                const isSelected = selectedElement && selectedElement.id === el.id;
                const drawFn = {
                    player: drawPlayer, defender: drawDefender, ball: drawBall, cone: drawCone,
                    hoop: drawHoop, basket: drawBasket, text: drawText, zone: drawZone,
                    arrow: drawPath, pass: drawPath, dribble: drawPath, screen: drawPath, pencil: drawPath
                }[el.type];
                
                if (drawFn) {
                    if (pathTools.includes(el.type)) {
                        drawFn(el.points, isSelected, el);
                    } else if (el.type === 'zone') {
                        drawFn(el.x, el.y, el.width, el.height, isSelected, el);
                    } else {
                        drawFn(el.x, el.y, isSelected, el);
                    }
                }
            });
        });

        if (isDrawing && currentPath.length > 0 && lastMousePos) {
            drawPath([...currentPath, lastMousePos], true, { type: currentTool, color: '#FFD700' });
        }
        if (tempElement && tempElement.type === 'zone') {
            drawZone(tempElement.x, tempElement.y, tempElement.width, tempElement.height, true, { color: '#FFD700' });
        }
    }

    function getLogicalCoords(event) {
        const rect = canvas.getBoundingClientRect();
        const pixelX = event.clientX - rect.left;
        const pixelY = event.clientY - rect.top;
        const viewWidth = body.classList.contains('view-half-court') ? LOGICAL_WIDTH / 2 : LOGICAL_WIDTH;
        return {
            x: (pixelX / rect.width) * viewWidth,
            y: (pixelY / rect.height) * LOGICAL_HEIGHT
        };
    }
    
    function getElementAtPosition(logicalPoint) {
        const elements = playbookState.scenes[playbookState.activeSceneIndex].elements;
        const CLICK_RADIUS = 12;

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
                        if (getDistanceToSegment(logicalPoint, el.points[j], el.points[j + 1]) < 5) {
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
    }

    function finalizeCurrentPath() {
        if (isDrawing && currentPath.length > 1) {
            playbookState.scenes[playbookState.activeSceneIndex].elements.push({
                id: Date.now(),
                type: currentTool,
                points: currentPath,
                width: 2.5,
                color: '#212121'
            });
            commitState(); 
        }
        isDrawing = false;
        currentPath = [];
    }

    canvas.addEventListener("mousedown", e => {
        isMouseDown = true;
        const logicalPos = getLogicalCoords(e);
        startDragPos = logicalPos;
        lastMousePos = logicalPos;

        if (pathTools.includes(currentTool)) {
            if (!isDrawing) {
                isDrawing = true;
                currentPath = [logicalPos];
            } else {
                currentPath.push(logicalPos);
            }
        } else if (dragTools.includes(currentTool)) {
            tempElement = {
                type: currentTool,
                x: logicalPos.x,
                y: logicalPos.y,
                width: 0,
                height: 0,
                color: '#FFEB3B'
            };
        } else {
            finalizeCurrentPath();
            if (currentTool === "select") {
                selectedScene = null;
                selectedElement = getElementAtPosition(logicalPos);
                if(selectedElement) {
                    dragStartElementState = JSON.stringify(selectedElement);
                }
            } else {
                selectedElement = null;
                selectedScene = null;
                if (singleClickTools.includes(currentTool)) {
                    const newElement = { id: Date.now(), type: currentTool, x: logicalPos.x, y: logicalPos.y };
                    if (currentTool === "player") {
                        newElement.label = playerCounter.toString();
                        newElement.color = "#007BFF";
                        playerCounter++;
                    } else if (currentTool === "defender") {
                        newElement.label = defenderCounter.toString();
                        newElement.color = "#D32F2F";
                        newElement.rotation = 0;
                        defenderCounter++;
                        const players = playbookState.scenes[playbookState.activeSceneIndex].elements.filter(el => el.type === 'player');
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
                    } else if (currentTool === "ball") {
                        newElement.color = "#E65100";
                        const players = playbookState.scenes[playbookState.activeSceneIndex].elements.filter(el => el.type === 'player');
                        const playerBelow = players.find(p => Math.hypot(p.x - newElement.x, p.y - newElement.y) < 10);
                        if (playerBelow) {
                            newElement.linkedTo = playerBelow.id;
                        }
                    } else if (currentTool === "cone") {
                        newElement.color = "#ff7f50";
                    } else if (currentTool === "hoop") {
                        newElement.color = "#ff0000";
                    } else if (currentTool === "basket") {
                        newElement.color = "#E65100";
                    }
                    playbookState.scenes[playbookState.activeSceneIndex].elements.push(newElement);
                    commitState();
                } else if (currentTool === "text") {
                    const text = prompt("Entrez votre texte :");
                    if (text) {
                        playbookState.scenes[playbookState.activeSceneIndex].elements.push({
                            id: Date.now(),
                            type: "text",
                            x: logicalPos.x,
                            y: logicalPos.y,
                            text: text,
                            size: 14,
                            color: "#212121"
                        });
                        commitState();
                    }
                }
            }
        }
        updatePropertiesPanel();
        redrawCanvas();
    });

    canvas.addEventListener("mousemove", e => {
        const logicalPos = getLogicalCoords(e);

        if (isMouseDown) {
            if (currentTool === 'select' && selectedElement) {
                if (!isDragging) {
                    if (Math.hypot(logicalPos.x - startDragPos.x, logicalPos.y - startDragPos.y) > 3) {
                        isDragging = true;
                    }
                }

                if (isDragging) {
                    const dx = logicalPos.x - lastMousePos.x;
                    const dy = logicalPos.y - lastMousePos.y;
                    if (selectedElement.points) {
                        selectedElement.points.forEach(p => { p.x += dx; p.y += dy; });
                    } else {
                        selectedElement.x += dx;
                        selectedElement.y += dy;
                    }
                }
            }
            else if (tempElement && tempElement.type === 'zone') {
                tempElement.width = logicalPos.x - tempElement.x;
                tempElement.height = logicalPos.y - tempElement.y;
            }
        }

        lastMousePos = logicalPos;

        if (isDrawing || isDragging || tempElement) {
            redrawCanvas();
        }
    });

    window.addEventListener("mouseup", e => {
        if (tempElement && tempElement.type === 'zone') {
            if (tempElement.width < 0) { tempElement.x += tempElement.width; tempElement.width *= -1; }
            if (tempElement.height < 0) { tempElement.y += tempElement.height; tempElement.height *= -1; }
            
            if (tempElement.width > 2 && tempElement.height > 2) {
                playbookState.scenes[playbookState.activeSceneIndex].elements.push({ id: Date.now(), ...tempElement });
                commitState();
            }
            tempElement = null;
        }

        if (isDragging) {
            if(dragStartElementState && JSON.stringify(selectedElement) !== dragStartElementState) {
                commitState();
            }

            const rect = canvas.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                let elements = playbookState.scenes[playbookState.activeSceneIndex].elements;
                playbookState.scenes[playbookState.activeSceneIndex].elements = elements.filter(el => el.id !== selectedElement.id);
                selectedElement = null;
                updatePropertiesPanel();
                commitState();
            } 
            else if (selectedElement && selectedElement.type === 'ball') {
                const elements = playbookState.scenes[playbookState.activeSceneIndex].elements;
                const logicalPos = getLogicalCoords(e);
                const playerBelow = elements.find(el => el.type === 'player' && Math.hypot(el.x - logicalPos.x, el.y - logicalPos.y) < 10);
                const oldLinkedTo = selectedElement.linkedTo;
                
                if (playerBelow) {
                    selectedElement.linkedTo = playerBelow.id;
                } else {
                    selectedElement.linkedTo = null;
                }
                
                if(oldLinkedTo !== selectedElement.linkedTo) {
                    commitState();
                }
            }
        }

        isMouseDown = false;
        isDragging = false;
        dragStartElementState = null;
        
        redrawCanvas();
    });

    canvas.addEventListener("dblclick", e => {
        e.preventDefault();

        if (isDrawing) {
            if (currentPath.length > 1) currentPath.pop();
            finalizeCurrentPath();
            redrawCanvas();
            return; 
        }

        const logicalPos = getLogicalCoords(e);
        const clickedElement = getElementAtPosition(logicalPos);

        if (clickedElement && clickedElement.type === 'player') {
            const elements = playbookState.scenes[playbookState.activeSceneIndex].elements;
            const linkedBall = elements.find(b => b.type === 'ball' && b.linkedTo === clickedElement.id);
            
            if (linkedBall) {
                linkedBall.linkedTo = null;
                linkedBall.x = clickedElement.x + 15;
                linkedBall.y = clickedElement.y;
                commitState();
                redrawCanvas();
            }
        }
    });

    window.addEventListener("keydown", e => {
        if (e.ctrlKey || e.metaKey) {
            const targetTagName = e.target.tagName.toLowerCase();
            if (targetTagName === "input" || targetTagName === "textarea") {
            } else {
                if (e.key === 'z') {
                    e.preventDefault();
                    undo();
                } else if (e.key === 'y') {
                    e.preventDefault();
                    redo();
                }
            }
        }

        const targetTagName = e.target.tagName.toLowerCase();
        if (targetTagName === "input" || targetTagName === "textarea") return;

        if (e.key === "Enter" && isDrawing) {
            finalizeCurrentPath();
            redrawCanvas();
        } else if ((e.key === "Delete" || e.key === "Backspace") && selectedElement) {
            let elements = playbookState.scenes[playbookState.activeSceneIndex].elements;
            if (selectedElement.type === 'player') {
                const balls = elements.filter(b => b.type === 'ball' && b.linkedTo === selectedElement.id);
                balls.forEach(ball => ball.linkedTo = null);
            }
            playbookState.scenes[playbookState.activeSceneIndex].elements = elements.filter(el => el.id !== selectedElement.id);
            selectedElement = null;
            selectedScene = playbookState.scenes[playbookState.activeSceneIndex];
            commitState();
            updatePropertiesPanel();
            redrawCanvas();
        }
    });
    document.getElementById('action-mirror').addEventListener('click', () => {
        const viewWidth = body.classList.contains('view-half-court') ? LOGICAL_WIDTH / 2 : LOGICAL_WIDTH;
        const currentScene = playbookState.scenes[playbookState.activeSceneIndex];
        currentScene.elements.forEach(el => {
            if (typeof el.x !== 'undefined') el.x = viewWidth - el.x;
            if (el.points) el.points.forEach(p => p.x = viewWidth - p.x);
            if (el.type === 'zone') el.x -= el.width;
            if (el.type === 'defender') el.rotation = (180 - el.rotation + 360) % 360;
        });
        commitState();
        redrawCanvas();
    });

    document.querySelectorAll(".tool-btn").forEach(button => {
        button.addEventListener("click", () => {
            if(!button.classList.contains('view-btn')) {
                finalizeCurrentPath();
                document.querySelectorAll(".tool-btn:not(.view-btn)").forEach(btn => btn.classList.remove("active"));
                button.classList.add("active");
                currentTool = button.id.split("-")[1];
                selectedElement = null;
                selectedScene = null;
                tempElement = null;
                updatePropertiesPanel();
                redrawCanvas();
            }
        })
    });

    document.getElementById("tool-clear").addEventListener("click", () => {
        if (confirm("Voulez-vous vraiment effacer tous les éléments de CETTE SCÈNE ?")) {
            playbookState.scenes[playbookState.activeSceneIndex].elements = [];
            playerCounter = 1;
            defenderCounter = 1;
            selectedElement = null;
            
            // --- CORRECTION v4.5 ---
            currentLoadedPlaybookId = null; // Effacer réinitialise le playbook
            // --- FIN CORRECTION ---
            
            commitState();
            updatePropertiesPanel();
            redrawCanvas();
        }
    });
    
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);

    function hideAllPropGroups() {
        document.querySelectorAll('.prop-group').forEach(g => g.classList.add('hidden'));
    }

    function updatePropertiesPanel() {
        hideAllPropGroups();
        const hasSelection = selectedElement || selectedScene;
        propertiesPanel.classList.toggle('hidden', !hasSelection);
        noPropsMessage.style.display = hasSelection ? 'none' : 'block';

        if (selectedElement) {
            const el = selectedElement;
            const propMap = {
                'player': allPropGroups.player, 'defender': allPropGroups.defender,
                'ball': allPropGroups.ball, 'cone': allPropGroups.cone,
                'hoop': allPropGroups.hoop, 'basket': allPropGroups.basket,
                'zone': allPropGroups.zone, 'text': allPropGroups.text
            };
            
            if (propMap[el.type]) {
                const props = propMap[el.type];
                props.group.classList.remove('hidden');
                if (props.label) props.label.value = el.label || '';
                if (props.color) props.color.value = el.color || '#000000';
                if (props.rotation) props.rotation.value = el.rotation || 0;
                if (props.content) props.content.value = el.text || '';
                if (props.size) props.size.value = el.size || 14;
            } else if (pathTools.includes(el.type)) {
                allPropGroups.path.group.classList.remove('hidden');
                allPropGroups.path.color.value = el.color || '#212121';
                allPropGroups.path.width.value = el.width || 2.5;
            }
        } else if (selectedScene) {
            const props = allPropGroups.scene;
            props.group.classList.remove('hidden');
            props.name.value = selectedScene.name || '';
            props.duration.value = selectedScene.durationOverride ? selectedScene.durationOverride / 1000 : '';

            const isLastScene = playbookState.scenes.indexOf(selectedScene) === playbookState.scenes.length - 1;
            props.duration.disabled = isLastScene;
            props.duration.title = isLastScene ? "La dernière scène n'a pas de durée de transition." : "Durée de la transition (en s)";
        }
    }

    propertiesPanel.addEventListener('change', e => {
        if (selectedElement) {
            const id = e.target.id;
            const value = e.target.value;
            const propKey = id.split('-')[1];

            if (id.startsWith('text-content')) {
                selectedElement.text = value;
            } else if (id.includes('color')) {
                 selectedElement.color = value;
            } else if (id.includes('label') || id.includes('size') || id.includes('width') || id.includes('rotation')) {
                 selectedElement[propKey] = (e.target.type === 'range' || e.target.type === 'number') ? parseFloat(value) : value;
            }
            commitState();
            redrawCanvas();
        } else if (selectedScene) {
            const id = e.target.id;
            const value = e.target.value;
            if (id === 'scene-name-prop') {
                selectedScene.name = value;
                updateSceneListUI();
            } else if (id === 'scene-duration-prop') {
                const duration = parseFloat(value);
                selectedScene.durationOverride = (duration && duration > 0) ? duration * 1000 : null;
            }
            commitState();
        }
    });
    
    propertiesPanel.addEventListener('input', e => {
        if (selectedElement) {
            if(e.target.type !== 'range' && e.target.type !== 'color') return;
            const id = e.target.id;
            const value = e.target.value;
            const propKey = id.split('-')[1];

            if (id.includes('color')) {
                 selectedElement.color = value;
            } else if (id.includes('size') || id.includes('width') || id.includes('rotation')) {
                 selectedElement[propKey] = parseFloat(value);
            }
            redrawCanvas();
        }
    });

    propertiesPanel.addEventListener('click', e => {
        if (!e.target.classList.contains('color-swatch')) return;
        const color = e.target.dataset.color;
        if (selectedElement && color) {
            selectedElement.color = color;
            const propGroup = e.target.closest('.prop-group');
            if (propGroup) {
                const colorInput = propGroup.querySelector('input[type=color]');
                if (colorInput) colorInput.value = color;
            }
            commitState();
            redrawCanvas();
        }
    });

    function createColorPalette(parent, colors) {
        if (!parent) return;
        const paletteContainer = parent.querySelector('.color-palette');
        if (!paletteContainer) return;
        paletteContainer.innerHTML = '';
        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            paletteContainer.appendChild(swatch);
        });
    }
    
    playNameInput.addEventListener('change', e => {
        playbookState.name = e.target.value;
        commitState();
    });
    
    saveFileBtn.addEventListener('click', () => {
        const dataToSave = playbookState;
        const jsonString = JSON.stringify(dataToSave, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${playbookState.name.trim() || 'playbook'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    loadFileBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    // --- MODIFIÉ POUR GÉRER L'IMPORT DE BACKUP ---
    importFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (importedData && importedData.scenes) {
                    // --- C'est un playbook simple (Ancienne logique) ---
                    
                    playbookState = importedData;
                    if (!playbookState.name) playbookState.name = 'Playbook importé';
                    if (!playbookState.animationSettings) {
                        playbookState.animationSettings = { speed: DEFAULT_ANIMATION_SPEED, ratio: DEFAULT_ANTICIPATION_RATIO };
                    }
                    playbookState.scenes.forEach((scene, index) => {
                        if (!scene.name) scene.name = `Scène ${index + 1}`;
                        if (typeof scene.durationOverride === 'undefined') {
                            scene.durationOverride = null; 
                        }
                    });
                    
                    history = [];
                    redoStack = [];
                    commitState();
                    
                    playNameInput.value = playbookState.name;
                    updateCountersFromPlaybook();
                    
                    // --- CORRECTION v4.5 ---
                    currentLoadedPlaybookId = null; // Un fichier importé est un nouveau playbook
                    // --- FIN CORRECTION ---
                    
                    switchToScene(0);
                    playbookManagerContainer.classList.add('hidden');
                    alert('Playbook importé avec succès !');

                } else if (importedData && importedData.version === "orb_backup_v1") {
                    // --- NOUVEAU : C'est un fichier de backup ---
                    if (confirm("ATTENTION !\n\nVous êtes sur le point de charger un fichier de backup. Cela effacera TOUTES les données actuelles (playbooks, tags, plans) et les remplacera par le contenu de ce fichier.\n\nÊtes-vous sûr de vouloir continuer ?")) {
                        
                        // On utilise une fonction async auto-appelante pour utiliser await
                        (async () => {
                            try {
                                await orbDB.importBackupData(importedData.data);
                                alert("Backup importé avec succès ! L'application va se recharger.");
                                // Forcer un rechargement complet pour que tout soit propre
                                window.location.reload(); 
                            } catch (importError) {
                                console.error("Erreur lors de l'importation du backup:", importError);
                                alert("Erreur critique : L'importation du backup a échoué. Vos données n'ont pas été modifiées.");
                            }
                        })(); // Exécute la fonction async
                    }
                
                } else {
                    alert('Erreur : Fichier JSON non valide ou format incorrect.');
                }

            } catch (error) {
                console.error("Erreur d'importation:", error);
                alert("Erreur : Le fichier est invalide.");
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Permet de re-uploader le même fichier
    });
    
    // ---
    // --- FONCTION D'EXPORT TOTAL (CORRIGÉE POUR LES BLOBS) ---
    // ---
    exportAllDataBtn.addEventListener('click', async () => {
        const button = exportAllDataBtn;
        button.disabled = true;
        button.textContent = 'Préparation...';

        // Fonction d'aide pour convertir un Blob en DataURL (base64)
        const blobToDataURL = (blob) => {
            return new Promise((resolve, reject) => {
                // Vérifie si c'est bien un Blob
                if (!(blob instanceof Blob)) {
                    resolve(null); // Si ce n'est pas un blob (ex: null ou déjà corrompu), on renvoie null
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e.target.error);
                reader.readAsDataURL(blob);
            });
        };

        try {
            // 1. Récupérer toutes les données
            const playbooks = await orbDB.getAllPlaybooks();
            const tags = await orbDB.getAllTags();
            const plans = await orbDB.getAllPlans();

            // 2. Convertir les aperçus (Blob) des playbooks en base64
            const serializablePlaybooks = await Promise.all(
                playbooks.map(async (pb) => {
                    const previewDataUrl = await blobToDataURL(pb.preview);
                    // Remplace le Blob par la chaîne de caractères base64
                    return { ...pb, preview: previewDataUrl }; 
                })
            );

            // 3. Créer un objet "backup" avec les playbooks sérialisables
            const allData = {
                version: "orb_backup_v1",
                createdAt: new Date().toISOString(),
                data: {
                    playbooks: serializablePlaybooks, // Utilise les playbooks corrigés
                    tags: tags,
                    trainingPlans: plans
                }
            };

            // 4. Convertir en JSON
            const jsonString = JSON.stringify(allData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // 5. Créer un nom de fichier avec la date
            const date = new Date().toISOString().split('T')[0]; // Format AAAA-MM-JJ
            const fileName = `orb_backup_${date}.json`;

            // 6. Créer le lien de téléchargement
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Erreur lors de l'export total:", error);
            alert("Erreur : Impossible de générer le fichier de backup.");
        } finally {
            button.disabled = false;
            // Rétablit le contenu original du bouton
            button.innerHTML = `
                <svg viewBox="0 0 24 24"><path d="M21.5,13.3L20.8,15.9C20.6,16.8 19.8,17.5 18.9,17.5H5.1C4.2,17.5 3.4,16.8 3.2,15.9L2.5,13.3C2.2,12.3 2.8,11.2 3.8,10.9C4.8,10.6 5.9,11.2 6.2,12.2L6.9,14.8C7.1,15.3 7.5,15.5 8,15.5H16C16.5,15.5 16.9,15.3 17.1,14.8L17.8,12.2C18.1,11.2 19.2,10.6 20.2,10.9C21.2,11.2 21.8,12.3 21.5,13.3M19,2H5C3.9,2 3,2.9 3,4V9H5V4H19V9H21V4C21,2.9 20.1,2 19,2Z"/></svg>
                <span>Sauvegarder TOUT (Backup)</span>
            `;
        }
    });

    // --- EXPORT PDF AVEC COULEURS DYNAMIQUES ---
    exportPdfBtn.addEventListener("click", async () => {
        if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
            alert("Erreur: Les bibliothèques PDF n'ont pas pu être chargées.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const originalSceneIndex = playbookState.activeSceneIndex;
        const courtContainer = document.getElementById("court-container");
        const playName = playNameInput.value.trim() || "Playbook Sans Nom";
        let scenesPerPage = parseInt(document.getElementById('pdf-scenes-per-page').value, 10) || 1;
        if (scenesPerPage < 1 || scenesPerPage > 6) scenesPerPage = 1;

        const doc = new jsPDF("portrait", "mm", "a4");
        const MARGIN = 15;
        const PAGE_WIDTH = doc.internal.pageSize.getWidth();
        const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
        
        // --- DÉTECTION DU MODE CRAB ---
        const isCrab = document.body.classList.contains('crab-mode');
        
        // Couleurs dynamiques pour le PDF
        const PDF_PRIMARY_COLOR = isCrab ? '#72243D' : '#BFA98D'; // Fond du header (Bordeaux ou Or)
        const PDF_SECONDARY_COLOR = isCrab ? '#F9AB00' : '#212121'; // Lignes décoratives (Jaune ou Noir/Or)
        // Le jaune sur papier blanc est très peu lisible, on garde le bordeaux pour le texte en mode Crab
        const PDF_TEXT_COLOR = isCrab ? '#72243D' : '#212121'; 

        const COLOR_LIGHT_GREY = '#E0E0E0';
        
        const addHeader = (doc, title) => {
            doc.setFillColor(PDF_PRIMARY_COLOR);
            doc.rect(0, 0, PAGE_WIDTH, MARGIN + 5, 'F');
            doc.setFontSize(20);
            doc.setFont("helvetica", "bold");
            doc.setTextColor('#FFFFFF'); // Texte toujours blanc sur le bandeau de couleur
            doc.text(title, PAGE_WIDTH / 2, MARGIN, { align: "center" });
        };

        const addFooter = (doc, pageNum, totalPages) => {
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(150);
            doc.text(`Page ${pageNum} / ${totalPages}`, PAGE_WIDTH / 2, PAGE_HEIGHT - (MARGIN / 2), { align: "center" });
        };
        
        const layoutConfig = {
            1: { rows: 1, cols: 1 }, 2: { rows: 2, cols: 1 },
            3: { rows: 3, cols: 1 }, 4: { rows: 2, cols: 2 },
            5: { rows: 3, cols: 2 }, 6: { rows: 3, cols: 2 }
        }[scenesPerPage > 4 ? 6 : scenesPerPage];

        const totalScenePages = Math.ceil(playbookState.scenes.length / scenesPerPage);
        
        if (playbookState.scenes.length === 0) {
            return alert("Il n'y a aucune scène à exporter.");
        }
        
        for (let i = 0; i < playbookState.scenes.length; i++) {
            const pageIndex = Math.floor(i / scenesPerPage);
            const sceneIndexOnPage = i % scenesPerPage;

            if (sceneIndexOnPage === 0) {
                if (i > 0) doc.addPage();
                addHeader(doc, playName);
                addFooter(doc, pageIndex + 1, totalScenePages);
            }
            
            await switchToScene(i, true); 
            await new Promise(resolve => setTimeout(resolve, 50));

            const courtImage = await html2canvas(courtContainer, { scale: 1.5, backgroundColor: null });

            const cellWidth = (PAGE_WIDTH - MARGIN * (layoutConfig.cols + 1)) / layoutConfig.cols;
            const cellHeight = (PAGE_HEIGHT - MARGIN * 4) / layoutConfig.rows;
            const colIndex = sceneIndexOnPage % layoutConfig.cols;
            const rowIndex = Math.floor(sceneIndexOnPage / layoutConfig.cols);
            const cellX = MARGIN + colIndex * (cellWidth + MARGIN);
            const cellY = MARGIN * 2.5 + rowIndex * (cellHeight + MARGIN);

            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(PDF_TEXT_COLOR); // Utilisation de la couleur dynamique
            const sceneTitle = playbookState.scenes[i].name || `Scène ${i + 1}`;
            doc.text(sceneTitle, cellX, cellY);
            
            doc.setDrawColor(isCrab ? PDF_SECONDARY_COLOR : PDF_PRIMARY_COLOR); // Ligne sous le titre
            doc.setLineWidth(0.5);
            doc.line(cellX, cellY + 1, cellX + 30, cellY + 1);

            const diagramHeightRatio = 0.6;
            const diagramContainerHeight = cellHeight * diagramHeightRatio;

            const imgData = courtImage.toDataURL("image/jpeg", 0.8); 
            const imgHeight = Math.min(diagramContainerHeight - 5, courtImage.height * cellWidth / courtImage.width);
            const imgWidth = courtImage.width * imgHeight / courtImage.height;
            doc.addImage(imgData, "JPEG", cellX, cellY + 5, imgWidth, imgHeight, undefined, 'FAST');

            const commentsY = cellY + diagramContainerHeight + 3;
            const commentsHeight = cellHeight * (1 - diagramHeightRatio) - 5;
            const comments = playbookState.scenes[i].comments;

            if (comments) {
                doc.setFontSize(9);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(PDF_TEXT_COLOR); // Utilisation de la couleur dynamique
                const splitComments = doc.splitTextToSize(comments, cellWidth - 4);
                doc.text(splitComments, cellX + 2, commentsY + 4);
            } else {
                doc.setDrawColor(COLOR_LIGHT_GREY);
                doc.setLineDashPattern([1, 1], 0);
                const lineHeight = 5;
                const lineCount = Math.floor((commentsHeight - 2) / lineHeight);
                for(let j = 1; j < lineCount; j++) {
                    const lineY = commentsY + (j * lineHeight);
                    doc.line(cellX, lineY, cellX + cellWidth, lineY);
                }
                doc.setLineDashPattern([], 0);
            }
        }

        doc.save(`${playName}.pdf`);
        await switchToScene(originalSceneIndex);
    });
    
    function updateSceneListUI() {
        sceneList.innerHTML = "";
        playbookState.scenes.forEach((scene, index) => {
            const li = document.createElement("li");
            li.dataset.index = index;
            li.draggable = true;
            li.textContent = scene.name || `Scène ${index + 1}`;
    
            if (index === playbookState.activeSceneIndex) {
                li.classList.add("active");
            }
            
            li.addEventListener("click", () => switchToScene(index));

            li.addEventListener("dragstart", e => {
                draggedSceneIndex = index;
                e.target.classList.add("dragging");
            });
            li.addEventListener("dragend", e => {
                e.target.classList.remove("dragging");
                draggedSceneIndex = null;
            });
            li.addEventListener("dragover", e => e.preventDefault());
            li.addEventListener("drop", e => {
                e.preventDefault();
                const liTarget = e.target.closest("li");
                if (draggedSceneIndex === null || !liTarget) return;
                const droppedOnIndex = parseInt(liTarget.dataset.index, 10);
                if (draggedSceneIndex !== droppedOnIndex) {
                    const [movedScene] = playbookState.scenes.splice(draggedSceneIndex, 1);
                    playbookState.scenes.splice(droppedOnIndex, 0, movedScene);
                    playbookState.activeSceneIndex = droppedOnIndex;
                    commitState();
                    switchToScene(droppedOnIndex);
                }
            });
            sceneList.appendChild(li);
        });
    }

    async function switchToScene(index, isUndoRedo = false) {
        if (index < 0 || index >= playbookState.scenes.length) return;
        if (!isUndoRedo) {
            finalizeCurrentPath();
        }
        playbookState.activeSceneIndex = index;
        selectedElement = null;
        selectedScene = playbookState.scenes[index];
        
        if (playbookState.scenes[index]) {
            commentsTextarea.value = playbookState.scenes[index].comments || "";
        }
        
        updateSceneListUI();
        updatePropertiesPanel();
        redrawCanvas();
    }

    addSceneBtn.addEventListener("click", () => {
        const currentScene = playbookState.scenes[playbookState.activeSceneIndex];
        const newScene = JSON.parse(JSON.stringify(currentScene));
        newScene.comments = "";
        newScene.durationOverride = null;
        const newIndex = playbookState.activeSceneIndex + 1;
        newScene.name = `Scène ${playbookState.scenes.length + 1}`;
        playbookState.scenes.splice(newIndex, 0, newScene);
        
        // --- CORRECTION v4.5 ---
        currentLoadedPlaybookId = null; // Modifier un playbook le "détache" de son original
        // --- FIN CORRECTION ---
        
        commitState();
        switchToScene(newIndex);
    });

    deleteSceneBtn.addEventListener("click", () => {
        if (playbookState.scenes.length <= 1) {
            return alert("Vous ne pouvez pas supprimer la dernière scène.");
        }
        if (confirm(`Voulez-vous vraiment supprimer la scène "${playbookState.scenes[playbookState.activeSceneIndex].name}" ?`)) {
            playbookState.scenes.splice(playbookState.activeSceneIndex, 1);
            const newIndex = Math.min(playbookState.activeSceneIndex, playbookState.scenes.length - 1);
            
            // --- CORRECTION v4.5 ---
            currentLoadedPlaybookId = null; // Modifier un playbook le "détache" de son original
            // --- FIN CORRECTION ---
            
            commitState();
            switchToScene(newIndex);
        }
    });

    commentsTextarea.addEventListener("change", e => {
        if (selectedScene) {
            selectedScene.comments = e.target.value;
            commitState();
        }
    });

    animateSceneBtn.addEventListener("click", () => {
        const currentScene = playbookState.scenes[playbookState.activeSceneIndex];
        const newScene = JSON.parse(JSON.stringify(currentScene));
        newScene.comments = "";
        newScene.durationOverride = null;
        const consumedPathIds = new Set();
        const originalPlayers = currentScene.elements.filter(el => el.type === "player");
        const movementPaths = currentScene.elements.filter(el => ["arrow", "dribble", "screen"].includes(el.type));
        
        movementPaths.forEach(path => {
            let closestPlayer = null;
            let minDistance = PROXIMITY_THRESHOLD;
            originalPlayers.forEach(player => {
                const dist = Math.hypot(player.x - path.points[0].x, player.y - path.points[0].y);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestPlayer = player;
                }
            });
            if (closestPlayer) {
                const playerToMove = newScene.elements.find(p => p.id === closestPlayer.id);
                if (playerToMove) {
                    const pathEnd = path.points[path.points.length - 1];
                    playerToMove.x = pathEnd.x;
                    playerToMove.y = pathEnd.y;
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

            const associatedPath = passPaths.find(path => 
                !consumedPathIds.has(path.id) && 
                Math.hypot(passer.x - path.points[0].x, passer.y - path.points[0].y) < PROXIMITY_THRESHOLD
            );

            if (associatedPath) {
                const pathEnd = associatedPath.points[associatedPath.points.length - 1];
                const receiver = originalPlayers.find(p => 
                    p.id !== passer.id && 
                    Math.hypot(p.x - pathEnd.x, p.y - pathEnd.y) < PROXIMITY_THRESHOLD
                );

                if (receiver) {
                    const ballInNewScene = newScene.elements.find(b => b.id === originalBall.id);
                    if (ballInNewScene) {
                        ballInNewScene.linkedTo = receiver.id;
                    }
                    consumedPathIds.add(associatedPath.id);
                }
            }
        });

        newScene.elements = newScene.elements.filter(el => !consumedPathIds.has(el.id));
        const newIndex = playbookState.activeSceneIndex + 1;
        newScene.name = `Scène ${playbookState.scenes.length + 1}`;
        playbookState.scenes.splice(newIndex, 0, newScene);
        
        // --- CORRECTION v4.5 ---
        currentLoadedPlaybookId = null; // Modifier un playbook le "détache" de son original
        // --- FIN CORRECTION ---
        
        commitState();
        switchToScene(newIndex);
    });
    
    function getQuadraticBezierPoint(t, p0, p1, p2) {
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const x = uu * p0.x + 2 * u * t * p1.x + tt * p2.x;
        const y = uu * p0.y + 2 * u * t * p1.y + tt * p2.y;
        return { x, y };
    }

    function subdividePath(points) {
        if (!points || points.length < 2) return points;
        const subdividedPoints = [];
        const numSteps = 20;
        subdividedPoints.push(points[0]);
        let p0 = points[0];
        for (let i = 1; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = { x: (points[i].x + points[i+1].x) / 2, y: (points[i].y + points[i+1].y) / 2 };
            for (let j = 1; j <= numSteps; j++) {
                const t = j / numSteps;
                subdividedPoints.push(getQuadraticBezierPoint(t, p0, p1, p2));
            }
            p0 = p2;
        }
        subdividedPoints.push(points[points.length - 1]);
        return subdividedPoints;
    }
    
    function getPathLength(pathPoints) {
        if (!pathPoints || pathPoints.length < 2) return 0;
        let totalLength = 0;
        for (let i = 0; i < pathPoints.length - 1; i++) {
            totalLength += Math.hypot(pathPoints[i+1].x - pathPoints[i].x, pathPoints[i+1].y - pathPoints[i].y);
        }
        return totalLength;
    }

    function prepareStoryboard(courtView) {
        animationState.storyboard = [];
        animationState.totalDuration = 0;
        const MOVEMENT_TOOLS = ['arrow', 'dribble', 'screen'];

        if (courtView === 'half') {
            const firstSceneElements = playbookState.scenes[0].elements.filter(e => e.type === 'player' || e.type === 'defender');
            if (firstSceneElements.length > 0) {
                const avgX = firstSceneElements.reduce((sum, el) => sum + el.x, 0) / firstSceneElements.length;
                animationState.activeHalf = (avgX > LOGICAL_WIDTH / 2) ? 'right' : 'left';
            } else {
                animationState.activeHalf = 'left'; 
            }
        }

        for (let i = 0; i < playbookState.scenes.length - 1; i++) {
            const startScene = playbookState.scenes[i];
            const endScene = playbookState.scenes[i + 1];
            const transition = {
                duration: MIN_SCENE_DURATION,
                passData: [], 
                passPathData: [],
                tweens: []
            };

            const startElementsMap = new Map(startScene.elements.map(e => [e.id, e]));
            const endElementsMap = new Map(endScene.elements.map(e => [e.id, e]));
            
            const startBalls = startScene.elements.filter(e => e.type === 'ball');
            
            startBalls.forEach(startBall => {
                const endBall = endElementsMap.get(startBall.id);
                if (endBall && startBall.linkedTo && endBall.linkedTo && startBall.linkedTo !== endBall.linkedTo) {
                    const passInfo = {
                        passerId: startBall.linkedTo,
                        receiverId: endBall.linkedTo,
                        ball: endBall
                    };
                    transition.passData.push(passInfo);
                    
                    const passPath = startScene.elements.find(el => 
                        el.type === 'pass' &&
                        Math.hypot(el.points[0].x - startElementsMap.get(startBall.linkedTo)?.x, el.points[0].y - startElementsMap.get(startBall.linkedTo)?.y) < PROXIMITY_THRESHOLD
                    );

                    if (passPath) {
                        transition.passPathData.push({
                            points: subdividePath(passPath.points),
                            color: passPath.color,
                            width: passPath.width,
                            type: 'pass'
                        });
                    }
                }
            });

            const consumedPathIds = new Set();
            const allIds = new Set([...startElementsMap.keys(), ...endElementsMap.keys()]);
            let maxMovementLength = 0;

            allIds.forEach(id => {
                const startEl = startElementsMap.get(id);
                const endEl = endElementsMap.get(id);

                if (!startEl || !endEl) return;

                const tween = {
                    ...endEl,
                    startX: startEl.x, startY: startEl.y,
                    endX: endEl.x, endY: endEl.y,
                    startRotation: (startEl.rotation || 0) * Math.PI / 180,
                    endRotation: (endEl.rotation || 0) * Math.PI / 180,
                    movementPath: null
                };

                if (startEl.type === 'player' || startEl.type === 'defender') {
                    const movementPaths = startScene.elements.filter(el => MOVEMENT_TOOLS.includes(el.type) && !consumedPathIds.has(el.id));
                    const linkedPath = movementPaths.find(path => Math.hypot(path.points[0].x - startEl.x, path.points[0].y - startEl.y) < PROXIMITY_THRESHOLD);

                    if (linkedPath) {
                        const pathEnd = linkedPath.points[linkedPath.points.length - 1];
                        if (Math.hypot(pathEnd.x - endEl.x, pathEnd.y - endEl.y) < 5) {
                            const fullPath = subdividePath(linkedPath.points);
                            tween.movementPath = fullPath;
                            tween.pathType = linkedPath.type;
                            tween.pathColor = linkedPath.color;
                            tween.pathWidth = linkedPath.width;
                            const pathLength = getPathLength(fullPath);
                            if (pathLength > maxMovementLength) {
                                maxMovementLength = pathLength;
                            }
                            consumedPathIds.add(linkedPath.id);
                        }
                    }
                }
                transition.tweens.push(tween);
            });
            
            if (startScene.durationOverride > 0) {
                transition.duration = startScene.durationOverride;
            } else {
                const movementDuration = (maxMovementLength / (playbookState.animationSettings.speed || DEFAULT_ANIMATION_SPEED)) * 1000;
                const finalDuration = Math.max(MIN_SCENE_DURATION, movementDuration);
                transition.duration = transition.passData.length > 0 ? Math.max(finalDuration, PASS_DURATION) : finalDuration;
            }

            animationState.storyboard.push(transition);
            animationState.totalDuration += transition.duration;
        }
    }
    
    function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    
    function animationLoop(timestamp) {
        if (!animationState.isPlaying) return;

        if (animationState.startTime === 0) {
            animationState.startTime = timestamp - animationState.elapsedOffset;
            animationState.lastPositions.clear();
        }

        const elapsed = timestamp - animationState.startTime;
        const rect = animCanvas.getBoundingClientRect();
        
        animCtx.clearRect(0, 0, rect.width, rect.height);
        renderAnimationFrameToContext(animCtx, rect, elapsed, animationState);

        animTimeDisplay.textContent = `${(Math.min(elapsed, animationState.totalDuration) / 1000).toFixed(1)}s / ${(animationState.totalDuration / 1000).toFixed(1)}s`;
        
        if (elapsed >= animationState.totalDuration && animationState.totalDuration > 0) {
            stopAnimationLoop(true);
        } else {
            animationState.animationFrameId = requestAnimationFrame(animationLoop);
        }
    }

    function startAnimationLoop() {
        if (animationState.isPlaying) return;
        animationState.isPlaying = true;
        animationState.isFinished = false;
        animIconPlay.classList.add('hidden');
        animIconPause.classList.remove('hidden');
        animationState.animationFrameId = requestAnimationFrame(animationLoop);
    }
    
    function stopAnimationLoop(isFinished = false) {
        animationState.isPlaying = false;
        animationState.isFinished = isFinished;
        if (isFinished) {
            animationState.elapsedOffset = animationState.totalDuration;
            animationState.startTime = 0;
             redrawFinalFrameOfAnimation();
        } else if (animationState.startTime > 0) {
            animationState.elapsedOffset = performance.now() - animationState.startTime;
        }
        animIconPlay.classList.remove('hidden');
        animIconPause.classList.add('hidden');
        if (animationState.animationFrameId) {
            cancelAnimationFrame(animationState.animationFrameId);
            animationState.animationFrameId = null;
        }
    }

    function redrawFinalFrameOfAnimation() {
         const rect = animCanvas.getBoundingClientRect();
         animCtx.clearRect(0, 0, rect.width, rect.height);
         if (animationState.totalDuration > 0) {
            renderAnimationFrameToContext(animCtx, rect, animationState.totalDuration, animationState);
         }
    }

    function hexToRgba(hex, alpha) {
        if (!hex || !hex.startsWith('#')) return `rgba(0,0,0,${alpha})`;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function renderAnimationFrameToContext(p_ctx, p_rect, p_elapsed, p_animState) {
        let cumulativeTime = 0;
        let currentSceneIndex = -1;
        let timeInCurrentScene = 0;

        for (let i = 0; i < p_animState.storyboard.length; i++) {
            const sceneDuration = p_animState.storyboard[i].duration;
            if (p_elapsed < cumulativeTime + sceneDuration) {
                currentSceneIndex = i;
                timeInCurrentScene = p_elapsed - cumulativeTime;
                break;
            }
            cumulativeTime += sceneDuration;
        }

        if (currentSceneIndex === -1 && p_animState.storyboard.length > 0) {
            currentSceneIndex = p_animState.storyboard.length - 1;
            timeInCurrentScene = p_animState.storyboard[currentSceneIndex]?.duration || 0;
        }
        
        const transition = p_animState.storyboard[currentSceneIndex];
        if (!transition) return;

        const currentSceneDuration = transition.duration;
        const rawProgress = currentSceneDuration > 0 ? Math.min(timeInCurrentScene / currentSceneDuration, 1.0) : 1;
        
        let pathProgress = 0;
        let movementProgress = 0;
        const anticipationRatio = playbookState.animationSettings.ratio || DEFAULT_ANTICIPATION_RATIO;

        if (rawProgress < anticipationRatio) {
            pathProgress = rawProgress / anticipationRatio;
            movementProgress = 0;
        } else {
            pathProgress = 1;
            movementProgress = (rawProgress - anticipationRatio) / (1 - anticipationRatio);
        }
        const easedMovementProgress = easeInOutQuad(movementProgress);
        const getCoordsWithRect = (pos) => getAnimPixelCoords(pos, p_rect, p_animState);
        
        p_ctx.save();
        
        const drawAnimatedPath = (pathData) => {
            if (!pathData || !pathData.points) return;
            const alpha = movementProgress > 0 ? 0.8 * (1 - easedMovementProgress) : 0.8;
            const pathSlice = getPathSlice(pathData.points, pathProgress);
            const pathOptions = {
                type: pathData.type,
                color: hexToRgba(pathData.color || '#212121', alpha),
                width: (pathData.width || 2.5),
                noHead: pathProgress < 1,
            };
            drawPath(pathSlice, false, pathOptions, p_ctx, getCoordsWithRect);
        };

        transition.tweens.forEach(tween => drawAnimatedPath({points: tween.movementPath, type: tween.pathType, color: tween.pathColor, width: tween.pathWidth}));
        transition.passPathData.forEach(drawAnimatedPath);

        p_ctx.restore();
        
        const { passData, tweens } = transition;
        tweens.forEach(tween => {
            let currentPos;
            if (tween.movementPath) {
                currentPos = getPointOnPath(tween.movementPath, easedMovementProgress);
            } else {
                currentPos = { 
                    x: tween.startX + (tween.endX - tween.startX) * easedMovementProgress, 
                    y: tween.startY + (tween.endY - tween.startY) * easedMovementProgress 
                };
            }
            if (!currentPos) return;

            let rotation;
            const lastPos = p_animState.lastPositions.get(tween.id);
            if (lastPos && (Math.hypot(currentPos.y - lastPos.y, currentPos.x - lastPos.x) > 0.1) ) {
                rotation = Math.atan2(currentPos.y - lastPos.y, currentPos.x - lastPos.x);
            } else if (tween.type === 'defender' && !tween.movementPath) {
                rotation = tween.startRotation + (tween.endRotation - tween.startRotation) * easedMovementProgress;
            } else {
                rotation = tween.startRotation;
            }

            if (p_ctx === animCtx) {
                p_animState.lastPositions.set(tween.id, currentPos);
            }
            
            const drawFn = { player: drawPlayer, defender: drawDefender, ball: drawBall, cone: drawCone, hoop: drawHoop, basket: drawBasket, text: drawText }[tween.type];
            if (drawFn && !(tween.type === 'ball' && tween.linkedTo)) {
                const options = { ...tween, rotation };
                drawFn(currentPos.x, currentPos.y, false, options, p_ctx, getCoordsWithRect, { isAnimating: true, rawProgress, sceneIndex: currentSceneIndex, passData: transition.passData });
            }
        });

        if (passData && passData.length > 0) {
            const passProgress = Math.min(easedMovementProgress / PASS_RATIO, 1.0);

            passData.forEach(pass => {
                const passerTween = tweens.find(t => t.id === pass.passerId);
                const receiverTween = tweens.find(t => t.id === pass.receiverId);
                
                if (passerTween && receiverTween) {
                    const passerPos = getPointOnPath(passerTween.movementPath, easedMovementProgress) || { x: passerTween.startX + (passerTween.endX - passerTween.startX) * easedMovementProgress, y: passerTween.startY + (passerTween.endY - passerTween.startY) * easedMovementProgress };
                    const receiverPos = getPointOnPath(receiverTween.movementPath, easedMovementProgress) || { x: receiverTween.startX + (receiverTween.endX - receiverTween.startX) * easedMovementProgress, y: receiverTween.startY + (receiverTween.endY - receiverTween.startY) * easedMovementProgress };

                    if (easedMovementProgress < PASS_RATIO) {
                        const ballX = passerPos.x + (receiverPos.x - passerPos.x) * passProgress;
                        const ballY = passerPos.y + (receiverPos.y - passerPos.y) * passProgress;
                        drawBall(ballX, ballY, false, pass.ball, p_ctx, getCoordsWithRect);
                    }
                }
            });
        }
    }

    async function exportVideo() {
        if (playbookState.scenes.length < 2) {
            return alert("Veuillez créer au moins deux scènes pour une animation.");
        }
        
        if (typeof window.CCapture === 'undefined') {
            alert("Erreur: La bibliothèque d'export vidéo (CCapture.js) n'a pas pu être chargée.");
            return;
        }

        const buttonElement = exportVideoBtn;
        const allExportButtons = [exportVideoBtn, exportPdfBtn];
        allExportButtons.forEach(btn => btn.disabled = true);
        buttonElement.textContent = 'Préparation...';

        try {
            const courtView = body.classList.contains('view-half-court') ? 'half' : 'full';
            const FRAMERATE = 30;
            
            prepareStoryboard(courtView);
            const totalDuration = animationState.totalDuration;
            
            const capturer = new CCapture({
                format: 'webm',
                framerate: FRAMERATE,
                quality: 95,
                display: false,
            });

            const offscreenCanvas = document.createElement('canvas');
            const viewWidth = courtView === 'half' ? 140 : 280;
            const aspectRatio = viewWidth / LOGICAL_HEIGHT;
            
            const maxDimension = 1920;
            if (aspectRatio >= 1) { 
                offscreenCanvas.width = maxDimension;
                offscreenCanvas.height = Math.round(maxDimension / aspectRatio);
            } else { 
                offscreenCanvas.height = 1080;
                offscreenCanvas.width = Math.round(1080 * aspectRatio);
            }

            const offscreenCtx = offscreenCanvas.getContext('2d');
            const offscreenRect = { width: offscreenCanvas.width, height: offscreenCanvas.height };
            
            const courtSvg = document.getElementById('court-svg').cloneNode(true);
            courtSvg.setAttribute('width', offscreenCanvas.width);
            courtSvg.setAttribute('height', offscreenCanvas.height);
            courtSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            courtSvg.setAttribute('viewBox', courtView === 'half' ? (animationState.activeHalf === 'right' ? '140 0 140 150' : '0 0 140 150') : '0 0 280 150');
            if (courtView === 'half') courtSvg.querySelector('.center-court-logo')?.remove();
            
            const svgString = new XMLSerializer().serializeToString(courtSvg);
            const imgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const imgUrl = URL.createObjectURL(imgBlob);
            const courtImage = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = imgUrl;
            });
            URL.revokeObjectURL(imgUrl);
            
            let elapsed = 0;
            const timeStep = 1000 / FRAMERATE;

            capturer.start();

            // DÉTECTION COULEUR DE FOND POUR LA VIDÉO
            const isCrab = document.body.classList.contains('crab-mode');
            const bgFill = isCrab ? '#72243D' : '#BFA98D'; 

            function renderFrame() {
                if (elapsed > totalDuration) {
                    buttonElement.textContent = 'Encodage...';
                    capturer.stop();
                    capturer.save(blob => {
                        const downloadUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = `${playbookState.name.trim() || 'playbook'}.webm`;
                        a.click();
                        URL.revokeObjectURL(downloadUrl);
                        
                        allExportButtons.forEach(btn => btn.disabled = false);
                        buttonElement.textContent = "Exporter (Vidéo)";
                    });
                    return;
                }
                const progress = Math.min(elapsed / totalDuration, 1);
                buttonElement.textContent = `Capture: ${Math.round(progress * 100)}%`;
                
                offscreenCtx.fillStyle = bgFill; // Utilise la couleur dynamique
                offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

                offscreenCtx.drawImage(courtImage, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
                renderAnimationFrameToContext(offscreenCtx, offscreenRect, elapsed, animationState);
                capturer.capture(offscreenCanvas);
                elapsed += timeStep;
                setTimeout(renderFrame, 0); 
            }
            renderFrame();
        } catch (error) {
            console.error(`Erreur lors de l'exportation vidéo:`, error);
            alert(`Une erreur est survenue. Consultez la console.`);
            allExportButtons.forEach(btn => btn.disabled = false);
            buttonElement.textContent = "Exporter (Vidéo)";
        }
    }
    
    exportVideoBtn.addEventListener('click', exportVideo);
    
    playAnimationBtn.addEventListener('click', () => {
        if (playbookState.scenes.length < 2) {
            alert("Veuillez créer au moins deux scènes pour lancer une animation.");
            return;
        }
    
        const courtView = body.classList.contains('view-half-court') ? 'half' : 'full';
        animationState.view = courtView; 
    
        animationPlayer.classList.remove('hidden');
    
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
        animCourtBackground.innerHTML = courtSvg.outerHTML;
    
        requestAnimationFrame(() => {
            const animRect = animContainer.getBoundingClientRect();
            animCanvas.width = animRect.width * dpr;
            animCanvas.height = animRect.height * dpr;
            animCtx.scale(dpr, dpr);
    
            prepareStoryboard(courtView);
            
            animationState.startTime = 0;
            animationState.elapsedOffset = 0;
            
            startAnimationLoop();
        });
    });

    animPlayPauseBtn.addEventListener('click', () => {
        if (animationState.isFinished) {
            animationState.startTime = 0;
            animationState.elapsedOffset = 0;
            startAnimationLoop();
        } else if (animationState.isPlaying) {
            stopAnimationLoop();
        } else {
            startAnimationLoop();
        }
    });

    animCloseBtn.addEventListener('click', () => {
        stopAnimationLoop();
        animationPlayer.classList.add('hidden');
    });

    function updateCountersFromPlaybook() {
        let maxPlayer = 0;
        let maxDefender = 0;
        playbookState.scenes.forEach(scene => {
            scene.elements.forEach(el => {
                const labelNum = parseInt(el.label, 10);
                if (!isNaN(labelNum)) {
                    if (el.type === "player") {
                        if (labelNum > maxPlayer) maxPlayer = labelNum;
                    } else if (el.type === "defender") {
                        if (labelNum > maxDefender) maxDefender = labelNum;
                    }
                }
            });
        });
        playerCounter = maxPlayer + 1;
        defenderCounter = maxDefender + 1;
    }

    async function setCourtView(view) {
        body.classList.remove("view-full-court", "view-half-court");
        body.classList.add(`view-${view}-court`);
        
        viewFullCourtBtn.classList.toggle("active", view === "full");
        viewHalfCourtBtn.classList.toggle("active", view === "half");

        const courtSvg = document.getElementById('court-svg');
        if (view === 'half') {
            courtSvg.setAttribute('viewBox', '0 0 140 150');
        } else {
            courtSvg.setAttribute('viewBox', '0 0 280 150');
        }

        await resizeCanvas();
    }
    viewFullCourtBtn.addEventListener("click", () => setCourtView("full"));
    viewHalfCourtBtn.addEventListener("click", () => setCourtView("half"));

    // --- FONCTION CRITIQUE : Mise à jour du Thème (SVG et UI) ---
    function updateTeamThemeUI(isCrabMode) {
        // 1. Classe CSS (pour les boutons, header HTML)
        if (isCrabMode) {
            body.classList.add('crab-mode');
            teamThemeBtn.classList.add('active');
        } else {
            body.classList.remove('crab-mode');
            teamThemeBtn.classList.remove('active');
        }

        // 2. Modification du SVG (Le terrain)
        const courtSvg = document.getElementById('court-svg');
        const courtRect = courtSvg.querySelector('rect[width="280"]'); // Fond
        const centerCircle = courtSvg.querySelector('.center-court-logo circle:first-child'); // Rond central
        const centerText = courtSvg.querySelector('.center-court-logo text'); // Texte

        if (isCrabMode) {
            // COULEURS CRAB EXACTES
            const crabPrimary = '#72243D';   // Bordeaux
            const crabSecondary = '#F9AB00'; // Jaune

            // Fond et cercle central -> Bordeaux
            if(courtRect) courtRect.setAttribute('fill', crabPrimary);
            if(centerCircle) centerCircle.setAttribute('fill', crabPrimary);
            
            // Lignes et marquages -> Jaune
            courtSvg.querySelectorAll('line, path, circle, rect:not([width="280"])').forEach(el => {
                // On touche aux éléments qui dessinent les lignes (stroke)
                if (el.getAttribute('stroke')) el.setAttribute('stroke', crabSecondary);
                // On touche aux cercles vides (fill="none")
                if (el.getAttribute('fill') === 'none' && el.getAttribute('stroke')) el.setAttribute('stroke', crabSecondary);
            });

            // Texte -> CRAB en Jaune
            if (centerText) {
                centerText.textContent = "CRAB";
                centerText.setAttribute('fill', crabSecondary);
            }

        } else {
            // COULEURS ORIGINALES (ORB)
            const orbGold = '#BFA98D';
            const orbBlack = '#212121';

            if(courtRect) courtRect.setAttribute('fill', orbGold);
            if(centerCircle) centerCircle.setAttribute('fill', orbGold);

            courtSvg.querySelectorAll('line, path, circle, rect:not([width="280"])').forEach(el => {
                if (el.getAttribute('stroke')) el.setAttribute('stroke', orbBlack);
            });

            if (centerText) {
                centerText.textContent = "ORB";
                centerText.setAttribute('fill', orbBlack);
            }
        }
        
        redrawCanvas(); // Force le redessin
    }

    // Écouteur Bouton Crab
    if (teamThemeBtn) {
        teamThemeBtn.addEventListener('click', () => {
            const isCurrentlyCrab = body.classList.contains('crab-mode');
            const newMode = !isCurrentlyCrab;
            localStorage.setItem('teamMode', newMode ? 'crab' : 'orb');
            updateTeamThemeUI(newMode);
        });
    }

    function updateThemeUI(theme) {
        const isDarkMode = theme === 'dark';
        body.classList.toggle('dark-mode', isDarkMode);
        themeIconSun.classList.toggle('hidden', isDarkMode);
        themeIconMoon.classList.toggle('hidden', !isDarkMode);
    }

    // --- Initialisation ---
    async function initializeApp() {
        if (typeof orbDB === 'undefined' || !orbDB) {
            console.error("ERREUR DB"); return;
        }
        await orbDB.open();

        // Couleurs par défaut
        createColorPalette(allPropGroups.player.group, ['#d32f2f', '#007bff', '#28a745', '#ffc107', '#343a40', '#f8f9fa']);
        createColorPalette(allPropGroups.defender.group, ['#d32f2f', '#007bff', '#28a745', '#ffc107', '#343a40', '#f8f9fa']);
        createColorPalette(allPropGroups.path.group, ['#d32f2f', '#007bff', '#28a745', '#ffc107', '#343a40', '#f8f9fa']);
        createColorPalette(allPropGroups.text.group, ['#d32f2f', '#007bff', '#28a745', '#ffc107', '#343a40', '#f8f9fa']);
        createColorPalette(allPropGroups.zone.group, ['#ffeb3b', '#8bc34a', '#2196f3', '#e91e63']);
        createColorPalette(allPropGroups.cone.group, ['#ff7f50', '#ff4500', '#fca503', '#4682b4', '#333333']);
        createColorPalette(allPropGroups.hoop.group, ['#ff0000', '#0000ff', '#00ff00', '#ffff00', '#ff69b4']);
        createColorPalette(allPropGroups.basket.group, ['#E65100', '#696969', '#000000']);

        // Thème Clair/Sombre
        const savedTheme = localStorage.getItem('theme') || 'light';
        updateThemeUI(savedTheme);

        // --- RESTAURATION THEME CRAB ---
        const savedTeamMode = localStorage.getItem('teamMode');
        if (savedTeamMode === 'crab') {
            updateTeamThemeUI(true);
        }

        setCourtView("full");
        document.getElementById("tool-select").click();
        switchToScene(0);
        
        if (typeof initManager === 'function') initManager();
        if (typeof initPlanner === 'function') initPlanner();
    }

    themeToggleBtn.addEventListener('click', () => {
        let newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        updateThemeUI(newTheme);
    });

    // ... (Reste des gestionnaires d'événements existants : saveToLibrary, loadPlaybook, etc.) ...
    // CORRECTION v4.5
    saveToLibraryBtn.addEventListener('click', async () => {
        const button = saveToLibraryBtn;
        button.disabled = true;
        button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" /></svg> Sauvegarde...';

        try {
            const previewBlob = await generatePreviewBlob();
            if (!previewBlob) {
                throw new Error("Impossible de générer l'aperçu.");
            }

            playbookState.name = playNameInput.value || 'Playbook sans nom';
            
            // Si "currentLoadedPlaybookId" a un ID, db.js fera une mise à jour.
            // Si c'est "null", db.js créera une nouvelle entrée.
            const idToSave = currentLoadedPlaybookId;
            
            const newId = await orbDB.savePlaybook(playbookState, previewBlob, idToSave);
            
            // On met à jour l'ID actuel avec celui qui vient d'être sauvegardé
            currentLoadedPlaybookId = newId; 
            
            alert(`Playbook "${playbookState.name}" sauvegardé avec succès !`);
            
            // Rafraîchir la bibliothèque si elle est ouverte
            const libraryView = document.getElementById('library-view');
            if (!libraryView.classList.contains('hidden') && typeof initManager === 'function') {
                // On ne peut pas appeler loadLibrary() d'ici, mais on peut re-cliquer sur le bouton
                // C'est un peu un hack, mais ça force le rechargement
                document.getElementById('show-library-btn').click();
            }

        } catch (error) {
            console.error("Erreur lors de la sauvegarde dans la bibliothèque:", error);
            alert("Erreur : Le playbook n'a pas pu être sauvegardé.");
        } finally {
            button.disabled = false;
            button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M17 3H7C5.9 3 5 3.9 5 5V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V5C19 3.9 18.1 3 17 3M17 19H7V5H17V19M12 9L10 11H13V15H11V13L9 15L11 17V15H15V11H13L15 9H12Z"/></svg> Sauvegarder';
        }
    });

    // --- CORRECTION v4.5 ---
    // Réception de l'enregistrement complet (avec ID)
    function loadPlaybookFromEvent(event) {
        const playbookRecord = event.detail; // Reçoit l'enregistrement complet
        try {
            if (playbookRecord && playbookRecord.playbookData && playbookRecord.playbookData.scenes) {
                
                playbookState = JSON.parse(JSON.stringify(playbookRecord.playbookData));
                currentLoadedPlaybookId = playbookRecord.id; // Stocke l'ID
                
                history = [];
                redoStack = [];
                isRestoringState = true; 
                
                commitState(); 
                isRestoringState = false;
                updateUndoRedoButtons(); 

                playNameInput.value = playbookState.name;
                updateCountersFromPlaybook();
                switchToScene(0); 

                playbookManagerContainer.classList.add('hidden');
                togglePlaybookManagerBtn.classList.remove('active');
                
            } else {
                throw new Error('Données de playbook invalides.');
            }
        } catch (error) {
            console.error("Erreur lors du chargement du playbook:", error);
            alert("Erreur : Le playbook n'a pas pu être chargé.");
        }
    };
    
    window.addEventListener('loadPlaybook', loadPlaybookFromEvent);
    // --- FIN GESTION BIBLIOTHÈQUE ---

    initializeApp();
});
