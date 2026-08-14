// content/chart-overlay.js

/**
 * Chart Overlay
 * مسئول رسم سیگنالها (فلشها و هایلایتها) روی چارت مرورگر.
 */

class ChartOverlay {
    constructor() {
        this.container = null;
        this.initContainer();
    }

    initContainer() {
        this.container = document.createElement('div');
        this.container.id = 'stp-overlay-container';
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.pointerEvents = 'none'; // تا مانع کلیکهای کاربر نشود
        this.container.style.zIndex = '9999';
        document.body.appendChild(this.container);
    }

    /**
     * @param {Object} signal {direction, score, text}
     * @param {Object} position {x, y}
     */
    drawSignal(signal, position) {
        const marker = document.createElement('div');
        marker.className = `stp-signal-marker stp-${signal.direction.toLowerCase()}`;

        // تبدیل موقعیت (نیاز به محاسبه دقیق مختصات پیکسل از روی نمودار دارد)
        // فعلا به صورت دمو مقادیر ثابت میدهیم
        marker.style.left = `${position.x}px`;
        marker.style.top = `${position.y}px`;

        const arrow = signal.direction === 'CALL' ? '▲' : '▼';
        marker.innerHTML = `
            <div class="stp-arrow">${arrow}</div>
            <div class="stp-score">${signal.score}</div>
        `;

        this.container.appendChild(marker);

        // پاک کردن بعد از 8 ساعت
        setTimeout(() => {
            if (this.container.contains(marker)) {
                this.container.removeChild(marker);
            }
        }, 8 * 60 * 60 * 1000);
    }
}

window.STP_ChartOverlay = new ChartOverlay();
