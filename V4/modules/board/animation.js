/**
 * animation.js
 * Logique d'animation (Storyboard, Tweening) et Export Vidéo.
 */

window.ORB.animation = {
    
    prepareStoryboard: function(courtView) {
        const state = window.ORB.animationState;
        const pbState = window.ORB.playbookState;
        const CONSTANTS = window.ORB.CONSTANTS;
        const utils = window.ORB.utils;

        state.storyboard = [];
        state.totalDuration = 0;
        const MOVEMENT_TOOLS = ['arrow', 'dribble', 'screen'];

        if (courtView === 'half') {
            const firstSceneElements = pbState.scenes[0].elements.filter(e => e.type === 'player' || e.type === 'defender');
            if (firstSceneElements.length > 0) {
                const avgX = firstSceneElements.reduce((sum, el) => sum + el.x, 0) / firstSceneElements.length;
                state.activeHalf = (avgX > CONSTANTS.LOGICAL_WIDTH / 2) ? 'right' : 'left';
            } else {
                state.activeHalf = 'left'; 
            }
        }

        for (let i = 0; i < pbState.scenes.length - 1; i++) {
            const startScene = pbState.scenes[i];
            const endScene = pbState.scenes[i + 1];
            const transition = {
                duration: CONSTANTS.MIN_SCENE_DURATION,
                passData: [], 
                passPathData: [],
                tweens: []
            };

            const startElementsMap = new Map(startScene.elements.map(e => [e.id, e]));
            const endElementsMap = new Map(endScene.elements.map(e => [e.id, e]));
            
            // Gestion des passes
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
                        Math.hypot(el.points[0].x - startElementsMap.get(startBall.linkedTo)?.x, el.points[0].y - startElementsMap.get(startBall.linkedTo)?.y) < CONSTANTS.PROXIMITY_THRESHOLD
                    );

                    if (passPath) {
                        transition.passPathData.push({
                            points: utils.subdividePath(passPath.points),
                            color: passPath.color,
                            width: passPath.width,
                            type: 'pass'
                        });
                    }
                }
            });

            // Gestion des mouvements
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
                    const linkedPath = movementPaths.find(path => Math.hypot(path.points[0].x - startEl.x, path.points[0].y - startEl.y) < CONSTANTS.PROXIMITY_THRESHOLD);

                    if (linkedPath) {
                        const pathEnd = linkedPath.points[linkedPath.points.length - 1];
                        if (Math.hypot(pathEnd.x - endEl.x, pathEnd.y - endEl.y) < 5) {
                            const fullPath = utils.subdividePath(linkedPath.points);
                            tween.movementPath = fullPath;
                            tween.pathType = linkedPath.type;
                            tween.pathColor = linkedPath.color;
                            tween.pathWidth = linkedPath.width;
                            const pathLength = utils.getPathLength(fullPath);
                            if (pathLength > maxMovementLength) {
                                maxMovementLength = pathLength;
                            }
                            consumedPathIds.add(linkedPath.id);
                        }
                    }
                }
                transition.tweens.push(tween);
            });
            
            // Calcul de la durée
            if (startScene.durationOverride > 0) {
                transition.duration = startScene.durationOverride;
            } else {
                const movementDuration = (maxMovementLength / (pbState.animationSettings.speed || CONSTANTS.DEFAULT_ANIMATION_SPEED)) * 1000;
                const finalDuration = Math.max(CONSTANTS.MIN_SCENE_DURATION, movementDuration);
                transition.duration = transition.passData.length > 0 ? Math.max(finalDuration, CONSTANTS.PASS_DURATION) : finalDuration;
            }

            state.storyboard.push(transition);
            state.totalDuration += transition.duration;
        }
    },

    easeInOutQuad: function(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },

    renderAnimationFrameToContext: function(p_ctx, p_rect, p_elapsed, p_animState) {
        const CONSTANTS = window.ORB.CONSTANTS;
        const utils = window.ORB.utils;
        const renderer = window.ORB.renderer;
        const pbState = window.ORB.playbookState;

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
        const anticipationRatio = pbState.animationSettings.ratio || CONSTANTS.DEFAULT_ANTICIPATION_RATIO;

        if (rawProgress < anticipationRatio) {
            pathProgress = rawProgress / anticipationRatio;
            movementProgress = 0;
        } else {
            pathProgress = 1;
            movementProgress = (rawProgress - anticipationRatio) / (1 - anticipationRatio);
        }
        const easedMovementProgress = this.easeInOutQuad(movementProgress);
        const getCoordsWithRect = (pos) => utils.getAnimPixelCoords(pos, p_rect, p_animState);
        
        p_ctx.save();
        
        // Dessin des chemins animés
        const drawAnimatedPath = (pathData) => {
            if (!pathData || !pathData.points) return;
            const alpha = movementProgress > 0 ? 0.8 * (1 - easedMovementProgress) : 0.8;
            const pathSlice = utils.getPathSlice(pathData.points, pathProgress);
            const pathOptions = {
                type: pathData.type,
                color: utils.hexToRgba(pathData.color || '#212121', alpha),
                width: (pathData.width || 2.5),
                noHead: pathProgress < 1,
            };
            renderer.drawPath(pathSlice, false, pathOptions, p_ctx, getCoordsWithRect);
        };

        transition.tweens.forEach(tween => drawAnimatedPath({points: tween.movementPath, type: tween.pathType, color: tween.pathColor, width: tween.pathWidth}));
        transition.passPathData.forEach(drawAnimatedPath);

        p_ctx.restore();
        
        const { passData, tweens } = transition;
        tweens.forEach(tween => {
            let currentPos;
            if (tween.movementPath) {
                currentPos = utils.getPointOnPath(tween.movementPath, easedMovementProgress);
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

            if (p_ctx === window.ORB.animCtx) {
                p_animState.lastPositions.set(tween.id, currentPos);
            }
            
            const drawFnName = 'draw' + tween.type.charAt(0).toUpperCase() + tween.type.slice(1);
            if (renderer[drawFnName] && !(tween.type === 'ball' && tween.linkedTo)) {
                const options = { ...tween, rotation };
                renderer[drawFnName](currentPos.x, currentPos.y, false, options, p_ctx, getCoordsWithRect, { isAnimating: true, rawProgress, sceneIndex: currentSceneIndex, passData: transition.passData });
            }
        });

        // Dessin du ballon en mouvement lors d'une passe
        if (passData && passData.length > 0) {
            const passProgress = Math.min(easedMovementProgress / CONSTANTS.PASS_RATIO, 1.0);

            passData.forEach(pass => {
                const passerTween = tweens.find(t => t.id === pass.passerId);
                const receiverTween = tweens.find(t => t.id === pass.receiverId);
                
                if (passerTween && receiverTween) {
                    const passerPos = utils.getPointOnPath(passerTween.movementPath, easedMovementProgress) || { x: passerTween.startX + (passerTween.endX - passerTween.startX) * easedMovementProgress, y: passerTween.startY + (passerTween.endY - passerTween.startY) * easedMovementProgress };
                    const receiverPos = utils.getPointOnPath(receiverTween.movementPath, easedMovementProgress) || { x: receiverTween.startX + (receiverTween.endX - receiverTween.startX) * easedMovementProgress, y: receiverTween.startY + (receiverTween.endY - receiverTween.startY) * easedMovementProgress };

                    if (easedMovementProgress < CONSTANTS.PASS_RATIO) {
                        const ballX = passerPos.x + (receiverPos.x - passerPos.x) * passProgress;
                        const ballY = passerPos.y + (receiverPos.y - passerPos.y) * passProgress;
                        renderer.drawBall(ballX, ballY, false, pass.ball, p_ctx, getCoordsWithRect);
                    }
                }
            });
        }
    },

    startLoop: function() {
        const state = window.ORB.animationState;
        const animIconPlay = document.getElementById('anim-icon-play');
        const animIconPause = document.getElementById('anim-icon-pause');

        if (state.isPlaying) return;
        state.isPlaying = true;
        state.isFinished = false;
        animIconPlay.classList.add('hidden');
        animIconPause.classList.remove('hidden');
        state.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    },

    loop: function(timestamp) {
        const state = window.ORB.animationState;
        const animTimeDisplay = document.getElementById('anim-time-display');
        const animCtx = window.ORB.animCtx;
        const animCanvas = window.ORB.animCanvas;

        if (!state.isPlaying) return;

        if (state.startTime === 0) {
            state.startTime = timestamp - state.elapsedOffset;
            state.lastPositions.clear();
        }

        const elapsed = timestamp - state.startTime;
        const rect = animCanvas.getBoundingClientRect();
        
        animCtx.clearRect(0, 0, rect.width, rect.height);
        this.renderAnimationFrameToContext(animCtx, rect, elapsed, state);

        animTimeDisplay.textContent = `${(Math.min(elapsed, state.totalDuration) / 1000).toFixed(1)}s / ${(state.totalDuration / 1000).toFixed(1)}s`;
        
        if (elapsed >= state.totalDuration && state.totalDuration > 0) {
            this.stopLoop(true);
        } else {
            state.animationFrameId = requestAnimationFrame(this.loop.bind(this));
        }
    },

    stopLoop: function(isFinished = false) {
        const state = window.ORB.animationState;
        const animIconPlay = document.getElementById('anim-icon-play');
        const animIconPause = document.getElementById('anim-icon-pause');

        state.isPlaying = false;
        state.isFinished = isFinished;
        
        if (isFinished) {
            state.elapsedOffset = state.totalDuration;
            state.startTime = 0;
             // Dessiner la dernière frame
             const rect = window.ORB.animCanvas.getBoundingClientRect();
             window.ORB.animCtx.clearRect(0, 0, rect.width, rect.height);
             if (state.totalDuration > 0) {
                this.renderAnimationFrameToContext(window.ORB.animCtx, rect, state.totalDuration, state);
             }
        } else if (state.startTime > 0) {
            state.elapsedOffset = performance.now() - state.startTime;
        }
        
        animIconPlay.classList.remove('hidden');
        animIconPause.classList.add('hidden');
        
        if (state.animationFrameId) {
            cancelAnimationFrame(state.animationFrameId);
            state.animationFrameId = null;
        }
    },

    // --- EXPORT VIDÉO ---
    exportVideo: async function() {
        if (window.ORB.playbookState.scenes.length < 2) {
            return alert("Veuillez créer au moins deux scènes pour une animation.");
        }
        
        if (typeof window.CCapture === 'undefined') {
            alert("Erreur: La bibliothèque d'export vidéo (CCapture.js) n'a pas pu être chargée.");
            return;
        }

        const exportVideoBtn = document.getElementById('export-video-btn');
        const allExportButtons = [exportVideoBtn, document.getElementById('export-pdf-btn')];
        allExportButtons.forEach(btn => btn.disabled = true);
        exportVideoBtn.textContent = 'Préparation...';

        try {
            const courtView = document.body.classList.contains('view-half-court') ? 'half' : 'full';
            const FRAMERATE = 30;
            
            this.prepareStoryboard(courtView);
            const totalDuration = window.ORB.animationState.totalDuration;
            
            const capturer = new CCapture({
                format: 'webm',
                framerate: FRAMERATE,
                quality: 95,
                display: false,
            });

            const offscreenCanvas = document.createElement('canvas');
            const viewWidth = courtView === 'half' ? 140 : 280;
            const aspectRatio = viewWidth / window.ORB.CONSTANTS.LOGICAL_HEIGHT;
            
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
            
            // Préparation du fond SVG
            const courtSvg = document.getElementById('court-svg').cloneNode(true);
            courtSvg.setAttribute('width', offscreenCanvas.width);
            courtSvg.setAttribute('height', offscreenCanvas.height);
            courtSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            courtSvg.setAttribute('viewBox', courtView === 'half' ? (window.ORB.animationState.activeHalf === 'right' ? '140 0 140 150' : '0 0 140 150') : '0 0 280 150');
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

            const isCrab = document.body.classList.contains('crab-mode');
            const bgFill = isCrab ? window.ORB.CONSTANTS.COLORS.crabPrimary : window.ORB.CONSTANTS.COLORS.primary;

            const renderFrame = () => {
                if (elapsed > totalDuration) {
                    exportVideoBtn.textContent = 'Encodage...';
                    capturer.stop();
                    capturer.save(blob => {
                        const downloadUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = `${window.ORB.playbookState.name.trim() || 'playbook'}.webm`;
                        a.click();
                        URL.revokeObjectURL(downloadUrl);
                        
                        allExportButtons.forEach(btn => btn.disabled = false);
                        exportVideoBtn.textContent = "Exporter (Vidéo)";
                    });
                    return;
                }
                const progress = Math.min(elapsed / totalDuration, 1);
                exportVideoBtn.textContent = `Capture: ${Math.round(progress * 100)}%`;
                
                offscreenCtx.fillStyle = bgFill;
                offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

                offscreenCtx.drawImage(courtImage, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
                this.renderAnimationFrameToContext(offscreenCtx, offscreenRect, elapsed, window.ORB.animationState);
                capturer.capture(offscreenCanvas);
                elapsed += timeStep;
                setTimeout(renderFrame, 0); 
            };
            renderFrame();
        } catch (error) {
            console.error(`Erreur lors de l'exportation vidéo:`, error);
            alert(`Une erreur est survenue. Consultez la console.`);
            allExportButtons.forEach(btn => btn.disabled = false);
            exportVideoBtn.textContent = "Exporter (Vidéo)";
        }
    }
};