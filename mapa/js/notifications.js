/**
 * Módulo: notifications.js
 * Gestiona el sistema de colas y el renderizado de notificaciones de fallo.
 */
import { appState } from './state.js';

/**
 * Procesa la cola de alertas acumuladas y las muestra gradualmente en el feed.
 * Implementa una lógica de limitación para no saturar la pantalla (máximo 6 visibles).
 * @returns {void}
 */
export function procesarColaAlertas() {
  if (appState.isProcessingQueue) return;
  appState.isProcessingQueue = true;

  const process = setInterval(() => {
    const feed = document.getElementById("failure-feed");
    const activeNotes = feed.querySelectorAll('.fail-note:not(.leaving)');

    if (appState.alertQueue.length > 0 && activeNotes.length < 6) {
      const alerta = appState.alertQueue.shift();
      ejecutarNotificacion(alerta);
    }

    if (appState.alertQueue.length === 0) {
      clearInterval(process);
      appState.isProcessingQueue = false;
    }

    const queueStatus = document.getElementById("queue-status");
    if (appState.alertQueue.length > 0) {
      queueStatus.textContent = `${appState.alertQueue.length} notificaciones en cola`;
      queueStatus.style.opacity = "1";
    } else {
      queueStatus.style.opacity = "0";
    }
  }, 1000);
}

/**
 * Crea y añade un elemento de notificación al DOM con tiempo de vida dinámico.
 * @param {Object} alerta - Datos del fallo (nombre, provincia, status).
 * @returns {void}
 */
function ejecutarNotificacion(alerta) {
  const feed = document.getElementById("failure-feed");
  
  // El tiempo en pantalla disminuye cuantas más alertas hay en espera (Min 7s, Max 14s)
  const displayTime = Math.max(7000, 14000 - (appState.alertQueue.length * 1000));
  
  const note = document.createElement("div");
  note.className = `fail-note status-${alerta.status}`;
  note.innerHTML = `<strong>${alerta.status === "rojo" ? "SIN RESPUESTA" : "NUEVO ERROR"}:</strong> ${alerta.nombre}<br><small>${alerta.provincia.toUpperCase()}</small>`;

  feed.appendChild(note);

  /**
   * Orquesta la salida suave de la notificación aplicando la clase de colapso.
   */
  const removerNotificacion = () => {
    if (note.classList.contains('leaving')) return;
    note.classList.add('leaving');
    note.addEventListener("transitionend", () => note.remove(), { once: true });
  };

  setTimeout(() => {
    if (note.parentNode === feed) {
      removerNotificacion();
    }
  }, displayTime);
}