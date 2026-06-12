(function initializeAbyssalUi() {
    'use strict';

    const depthElement = document.getElementById('abyssalDepth');
    const currentDateElement = document.getElementById('abyssalDate');
    const currentStatusElement = document.getElementById('abyssalStatus');
    const viewportElement = document.querySelector('.abyssal-viewport');

    let animationFrameId;
    let lastDateText = '';

    function pad(value) {
        return String(value).padStart(2, '0');
    }

    function updateDate() {
        if (!currentDateElement) {
            return;
        }

        const now = new Date();
        const dateText = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
        if (dateText === lastDateText) {
            return;
        }

        currentDateElement.textContent = dateText;
        lastDateText = dateText;
    }

    function updateAmbientTelemetry(timestamp) {
        const seconds = timestamp / 1000;
        const depth = Math.round(2800 + Math.sin(seconds * 0.08) * 18 + Math.sin(seconds * 0.031) * 7);
        const drift = Math.sin(seconds * 0.018).toFixed(2);

        if (depthElement) {
            depthElement.textContent = `深度 ${depth} m`;
        }

        if (currentStatusElement) {
            currentStatusElement.textContent = `DRIFT ${drift}`;
        }

        if (viewportElement) {
            viewportElement.style.setProperty('--abyssal-drift-x', `${Math.sin(seconds * 0.017) * 10}px`);
            viewportElement.style.setProperty('--abyssal-drift-y', `${Math.cos(seconds * 0.013) * 8}px`);
        }
    }

    function tick(timestamp) {
        updateDate();
        updateAmbientTelemetry(timestamp);
        animationFrameId = window.requestAnimationFrame(tick);
    }

    function start() {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = window.requestAnimationFrame(tick);
    }

    function stop() {
        window.cancelAnimationFrame(animationFrameId);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stop();
            return;
        }
        start();
    });

    start();
}());
