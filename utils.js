/**
 * utils.js
 * Fonctions utilitaires (Maths, Coordonnées, Couleurs).
 */

window.ORB.utils = {
    
    // Convertit les coordonnées logiques (280x150) en pixels écran
    getPixelCoords: function(logicalPos) {
        const canvas = window.ORB.canvas;
        const CONSTANTS = window.ORB.CONSTANTS;
        const rect = canvas.getBoundingClientRect();
        
        // Vérifie si on est en mode demi-terrain via la classe CSS du body
        const isHalfCourt = document.body.classList.contains('view-half-court');
        const viewWidth = isHalfCourt ? CONSTANTS.LOGICAL_WIDTH / 2 : CONSTANTS.LOGICAL_WIDTH;
        
        return {
            x: (logicalPos.x / viewWidth) * rect.width,
            y: (logicalPos.y / CONSTANTS.LOGICAL_HEIGHT) * rect.height
        };
    },

    // Convertit les pixels écran (click souris) en coordonnées logiques
    getLogicalCoords: function(event) {
        const canvas = window.ORB.canvas;
        const CONSTANTS = window.ORB.CONSTANTS;
        const rect = canvas.getBoundingClientRect();
        
        const pixelX = event.clientX - rect.left;
        const pixelY = event.clientY - rect.top;
        
        const isHalfCourt = document.body.classList.contains('view-half-court');
        const viewWidth = isHalfCourt ? CONSTANTS.LOGICAL_WIDTH / 2 : CONSTANTS.LOGICAL_WIDTH;
        
        return {
            x: (pixelX / rect.width) * viewWidth,
            y: (pixelY / rect.height) * CONSTANTS.LOGICAL_HEIGHT
        };
    },

    // Version spécifique pour l'animation (gère le demi-terrain actif gauche/droite)
    getAnimPixelCoords: function(logicalPos, customRect = null, p_animationState) {
        const animCanvas = window.ORB.animCanvas;
        const CONSTANTS = window.ORB.CONSTANTS;
        const state = p_animationState || window.ORB.animationState;
        
        const rect = customRect || animCanvas.getBoundingClientRect();
        const viewWidth = (state.view === 'half') ? CONSTANTS.LOGICAL_WIDTH / 2 : CONSTANTS.LOGICAL_WIDTH;
        
        let transformedX = logicalPos.x;
        // Si on anime un demi-terrain et que l'action se passe à droite
        if (state.view === 'half' && state.activeHalf === 'right') {
            transformedX -= CONSTANTS.LOGICAL_WIDTH / 2;
        }

        return {
            x: (transformedX / viewWidth) * rect.width,
            y: (logicalPos.y / CONSTANTS.LOGICAL_HEIGHT) * rect.height
        };
    },

    // --- FONCTIONS GÉOMÉTRIQUES ---

    // Calcul de distance point à segment
    getDistanceToSegment: function(p, v, w) {
        const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projection = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
        return Math.hypot(p.x - projection.x, p.y - projection.y);
    },

    // Bézier Quadratique (pour les courbes)
    getQuadraticBezierPoint: function(t, p0, p1, p2) {
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const x = uu * p0.x + 2 * u * t * p1.x + tt * p2.x;
        const y = uu * p0.y + 2 * u * t * p1.y + tt * p2.y;
        return { x, y };
    },

    // Subdivise un chemin pour l'animation (lisse les courbes)
    subdividePath: function(points) {
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
                subdividedPoints.push(this.getQuadraticBezierPoint(t, p0, p1, p2));
            }
            p0 = p2;
        }
        subdividedPoints.push(points[points.length - 1]);
        return subdividedPoints;
    },
    
    // Longueur totale d'un chemin
    getPathLength: function(pathPoints) {
        if (!pathPoints || pathPoints.length < 2) return 0;
        let totalLength = 0;
        for (let i = 0; i < pathPoints.length - 1; i++) {
            totalLength += Math.hypot(pathPoints[i+1].x - pathPoints[i].x, pathPoints[i+1].y - pathPoints[i].y);
        }
        return totalLength;
    },

    // Récupère une portion du chemin (pour l'effet de dessin progressif)
    getPathSlice: function(points, progress) {
        if (!points || points.length < 2) return [];
        if (progress <= 0) return [points[0]];
        if (progress >= 1) return points;

        const totalLen = this.getPathLength(points);
        const targetLen = totalLen * progress;
        
        const slice = [points[0]];
        let currentLen = 0;

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i+1];
            const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);

            if (currentLen + segLen >= targetLen) {
                const remaining = targetLen - currentLen;
                const ratio = remaining / segLen;
                slice.push({
                    x: p1.x + (p2.x - p1.x) * ratio,
                    y: p1.y + (p2.y - p1.y) * ratio
                });
                break;
            } else {
                slice.push(p2);
                currentLen += segLen;
            }
        }
        return slice;
    },

    // Récupère un point précis sur un chemin (pour déplacer un joueur)
    getPointOnPath: function(points, progress) {
        const slice = this.getPathSlice(points, progress);
        return slice[slice.length - 1];
    },

    // Utilitaire Couleur Hex -> RGBA
    hexToRgba: function(hex, alpha) {
        if (!hex || !hex.startsWith('#')) return `rgba(0,0,0,${alpha})`;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
};