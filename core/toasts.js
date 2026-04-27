/**
 * @module toasts.js
 * @description Sistema de notificaciones tipo Toast para errores críticos.
 */

/**
 * Muestra un pop-up persistente en la parte superior indicando un error de base de datos.
 * @param {string} [message="Servidor de base de datos no disponible"] Mensaje a mostrar.
 * @param {number} [duration=7500] Duración en milisegundos antes de desaparecer.
 */
export function showDBErrorToast(message = "Servidor de base de datos no disponible", duration = 7500) {
    // Evitar que se acumulen múltiples pop-ups idénticos
    if (document.querySelector('.db-toast-container')) return;

    const container = document.createElement('div');
    container.className = 'db-toast-container';
    container.setAttribute('role', 'alert');
    container.innerHTML = `
        <div class="db-toast-icon" aria-hidden="true">!</div>
        <div class="db-toast-content">
            <div class="db-toast-title">Error de Sistema</div>
            <div class="db-toast-message">${message}</div>
        </div>
    `;

    document.body.appendChild(container);

    // Pequeño retardo para asegurar que la transición de entrada se dispare
    requestAnimationFrame(() => {
        container.classList.add('show');
    });

    // Auto-eliminación tras el tiempo indicado
    setTimeout(() => {
        container.classList.remove('show');
        // Esperamos a que termine la animación de salida para limpiar el DOM
        container.addEventListener('transitionend', () => {
            container.remove();
        }, { once: true });
    }, duration);
}
