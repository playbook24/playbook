/**
 * core/utils.js
 * Utilitaires partagés (Coordonnées, Bézier, Couleurs).
 */
window.ORB_UTILS = {
    getLogicalCoords: (event, rect, viewWidth) => {
        const pixelX = event.clientX - rect.left;
        const pixelY = event.clientY - rect.top;
        return {
            x: (pixelX / rect.width) * viewWidth,
            y: (pixelY / rect.height) * 150 // LOGICAL_HEIGHT
        };
    },
    
    hexToRgba: (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    getPathLength: (points) => {
        let len = 0;
        for (let i = 0; i < points.length - 1; i++) {
            len += Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y);
        }
        return len;
    }
};