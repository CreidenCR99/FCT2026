/**
 * Módulo: notifications.js
 * Gestiona el sistema de colas y el renderizado de notificaciones de fallo.
 */
import { appState } from './state.js';
import { CONFIG } from '../config.js';
import { getCache } from './db.js';

let animationId = null;
let currentScrollY = 0;
let lastTimestamp = 0;
let isWaitingForRefresh = false;
let isDragging = false;
let startPointerY = 0;
let startScrollY = 0;
let velocityY = 0;
let lastAlertsHash = "";

/** @type {AudioContext|null} Contexto de audio para síntesis de sonidos. */
let audioCtx = null;


/** 
 * Mapa para rastrear cuándo se vio por primera vez una alerta (SN -> timestamp).
 * Permite gestionar efectos visuales de "novedad".
 * @type {Map<string, number>} 
 */
const alertTimestamps = new Map();

/**
 * Inicializa el carrusel de alertas.
 * Intenta recuperar el estado previo de IndexedDB para evitar parpadeos en la carga.
 */
async function initAlertSystem() {
  // 1. Cargar desde caché para saber qué alertas ya existían
  const cached = await getCache('mapa_data').catch(() => null);
  if (cached && cached.alertas) {
    appState.lastAlerts = new Set(cached.alertas.map(a => a.sn));
    appState.activeAlerts = cached.alertas;
    renderCarousel();
  }
}


/**
 * Genera un sonido sintético basado en la configuración.
 * @param {string} status - 'rojo' o 'naranja'
 */
function playNotificationSound(status) {
  try {
    // El contexto de audio debe crearse/reanudarse tras una interacción del usuario
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const cfg = status === 'rojo' ? CONFIG.SOUNDS.TYPES.ROJO : CONFIG.SOUNDS.TYPES.NARANJA;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = cfg.type;
    oscillator.frequency.setValueAtTime(cfg.freq, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(CONFIG.SOUNDS.VOLUME, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + cfg.duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + cfg.duration);
  } catch (e) {
    console.warn("Web Audio API not supported or blocked:", e);
  }
}


/**
 * Genera un hash estable de las alertas ignorando el campo isRecent.
 * Se usa para detectar si el contenido estructural ha cambiado realmente,
 * evitando re-renders innecesarios que pausan el autoplay.
 * @param {Array<Object>} alerts
 * @returns {string}
 */
function getStructuralHash(alerts) {
  return JSON.stringify(alerts.map(a => ({ 
    sn: a.sn, 
    status: a.status, 
    nombre: a.nombre, 
    provincia: a.provincia, 
    codigoError: a.codigoError,
    isRecent: a.isRecent // CRÍTICO: Incluir isRecent para que morphdom detecte cambios de estilo temporal
  })));
}


/**
 * Sincroniza las alertas del servidor con el carrusel local.
 * @param {Array<Object>} serverAlerts - Lista de alertas actuales provenientes del backend.
 */
export function syncAlerts(serverAlerts) {
  // Capturamos las alertas activas del ciclo anterior para detectar las "nuevas"
  const previousActiveSns = new Set(appState.activeAlerts.map(a => a.sn));

  // 1. Agrupamiento y Ordenación: Errores (naranja) por Código -> Alertas (rojo) por Provincia
  const sortedAlerts = serverAlerts.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'naranja' ? -1 : 1; // Primero errores (naranja), luego alertas (rojo)
    }
    if (a.status === 'naranja') {
      return (a.codigoError || '').localeCompare(b.codigoError || '');
    }
    return (a.provincia || '').localeCompare(b.provincia || '');
  });

  const now = Date.now();
  const currentSns = new Set(serverAlerts.map(a => a.sn));

  // 2. Procesar alertas y determinar antigüedad
  const processedAlerts = sortedAlerts.map(alert => {
    // Si es la primera vez que vemos este SN, registramos el timestamp
    if (!alertTimestamps.has(alert.sn)) {
      alertTimestamps.set(alert.sn, now);
    }
    const firstSeen = alertTimestamps.get(alert.sn);
    const isRecent = (now - firstSeen) < CONFIG.NOTIFICATIONS.RECENT_THRESHOLD_MS;
    return { ...alert, isRecent };
  });

  // Reproducir sonidos para alertas que aparecen por primera vez en esta actualización
  processedAlerts.forEach(alert => {
    if (!previousActiveSns.has(alert.sn)) { // Si esta alerta no estaba activa en el ciclo anterior
      playNotificationSound(alert.status);
    }
  });

  // Limpieza del mapa de tiempos para alertas que ya no existen
  for (const sn of alertTimestamps.keys()) {
    if (!currentSns.has(sn)) alertTimestamps.delete(sn);
  }

  // Actualizamos el historial para la próxima vuelta
  appState.lastAlerts = currentSns;
  appState.activeAlerts = processedAlerts;

  renderCarousel();

  if (isWaitingForRefresh) {
    console.log("✅ [syncAlerts] Datos refrescados. Reanudando ticker.");
    isWaitingForRefresh = false;
    lastTimestamp = 0;
    requestAnimationFrame(tick);
  }
}

/**
 * Motor de animación nativo (Ticker).
 * @param {number} timestamp 
 */
function tick(timestamp) {
  if (isWaitingForRefresh || !appState.notificationsVisible || isDragging) {
    animationId = null;
    return;
  }

  if (!lastTimestamp) lastTimestamp = timestamp;
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  const wrapper = document.getElementById("failure-feed-wrapper");
  const viewport = document.getElementById("failure-feed");
  if (!wrapper || !viewport) return;

  // Calculamos la velocidad: a menor valor en config, mayor incremento por frame
  const speedFactor = 200 / (CONFIG.VELOCIDAD_CARRUSEL || 5000);
  
  // Sumamos el avance automático + la inercia (velocityY)
  currentScrollY += (speedFactor * delta) + velocityY;

  // Aplicamos fricción a la inercia (se reduce un 5% cada frame)
  velocityY *= 0.95;
  // Si la inercia es insignificante, la detenemos
  if (Math.abs(velocityY) < 0.1) velocityY = 0;

  // Lógica de bucle
  const separator = wrapper.querySelector('.carrusel-item-separator');
  if (separator && appState.activeAlerts.length > 10) {
    if (currentScrollY >= separator.offsetTop) {
      currentScrollY = 0;
      isWaitingForRefresh = true;
      console.log("⏸️ [ticker] Fin de ciclo. Esperando actualización de datos...");
    }
  } else {
    // Sin repetición (<= 10 items): parar al final del contenido
    const scrollLimit = Math.max(0, wrapper.scrollHeight - viewport.offsetHeight);
    if (currentScrollY >= scrollLimit && scrollLimit > 0) {
      currentScrollY = scrollLimit;
      isWaitingForRefresh = true;
    }
  }

  wrapper.style.transform = `translateY(-${currentScrollY}px)`;
  animationId = requestAnimationFrame(tick);
}

export function iniciarCarrusel() {
  const viewport = document.getElementById("failure-feed");
  const wrapper = document.getElementById("failure-feed-wrapper");
  
  // Añadir soporte para Scroll Manual
  viewport?.addEventListener('wheel', (e) => {
    if (isWaitingForRefresh && e.deltaY < 0) isWaitingForRefresh = false;
    
    currentScrollY += e.deltaY * 0.5; // Factor de sensibilidad
    if (currentScrollY < 0) currentScrollY = 0;
  }, { passive: true });

  // Añadir soporte para Arrastre (Grab & Drag)
  viewport?.addEventListener('pointerdown', (e) => {
    isDragging = true;
    startPointerY = e.pageY;
    startScrollY = currentScrollY;
    velocityY = 0; // Resetear inercia al tocar
    if (wrapper) wrapper.style.cursor = 'grabbing';
    viewport.setPointerCapture(e.pointerId);
  });

  viewport?.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dy = e.pageY - startPointerY;
    const newScrollY = startScrollY - dy;
    
    // Calculamos la velocidad del arrastre actual para la inercia futura
    velocityY = newScrollY - currentScrollY;
    currentScrollY = newScrollY;
    
    if (currentScrollY < 0) currentScrollY = 0;
    if (isWaitingForRefresh && dy > 0) isWaitingForRefresh = false;

    if (wrapper) wrapper.style.transform = `translateY(-${currentScrollY}px)`;
  });

  const stopDragging = (e) => {
    if (!isDragging) return;
    isDragging = false;
    if (wrapper) wrapper.style.cursor = 'grab';
    if (e.pointerId) viewport.releasePointerCapture(e.pointerId);
    lastTimestamp = 0; 
    requestAnimationFrame(tick); // Reanudar ticker
  };

  viewport?.addEventListener('pointerup', stopDragging);
  viewport?.addEventListener('pointercancel', stopDragging);

  initAlertSystem();
  requestAnimationFrame(tick);
}
export function renderCarousel() {
  const feed = document.getElementById("failure-feed");
  const queueStatus = document.getElementById("queue-status");
  const wrapper = document.getElementById("failure-feed-wrapper");
  if (!feed || !wrapper) return;

  if (!appState.notificationsVisible) {
    feed.style.opacity = "0";
    if (queueStatus) queueStatus.textContent = "Mostrar notificaciones";
    return;
  }

  const uiOverlay = document.getElementById("ui-overlay");
  const queueContainer = document.getElementById("queue-status-container");
  const topLimit = uiOverlay ? uiOverlay.getBoundingClientRect().bottom + 0 : 0;
  const bottomLimit = queueContainer ? (queueContainer.getBoundingClientRect().top - 10) : (window.innerHeight - 20);

  if (queueStatus) queueStatus.textContent = "Ocultar notificaciones";
  feed.style.opacity = "1";
  feed.style.top = `${topLimit}px`;
  feed.style.height = `${bottomLimit - topLimit}px`;

  const currentHash = getStructuralHash(appState.activeAlerts);
  if (currentHash === lastAlertsHash) return;
  lastAlertsHash = currentHash;

  let alertsToRender = [];
  if (appState.activeAlerts.length === 0) {
    for (let i = 0; i < CONFIG.NOTIFICATIONS.LOOP_BUFFER_SIZE; i++) {
      alertsToRender.push({ sn: `dummy-${i}`, status: 'gris', nombre: 'Esperando alertas...', provincia: 'SIN DATOS', codigoError: 'N/A', isRecent: false });
    }
  } else {
    alertsToRender = [...appState.activeAlerts];
    if (alertsToRender.length > 10) {
      alertsToRender.push({ isSeparator: true });
      alertsToRender.push(...alertsToRender.slice(0, CONFIG.NOTIFICATIONS.LOOP_BUFFER_SIZE));
    }
  }

  const html = alertsToRender.map(alerta => {
    if (alerta.isSeparator) return `<div class="carrusel-item-separator"><span class="capsula-gris">Nueva rotación</span></div>`;
    return `<div class="fail-note status-${alerta.status} ${alerta.isRecent ? 'new-alert-glow' : ''}"><div class="fail-content"><strong>${alerta.status === "rojo" ? "CONEXIÓN" : "ERROR"}:</strong> ${alerta.nombre}<br><small>${alerta.provincia ? alerta.provincia.toUpperCase() : ''} - ${alerta.codigoError}</small></div></div>`;
  }).join("");

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  window.morphdom(wrapper, tempDiv, { childrenOnly: true });
}

// Manejador para Ocultar/Mostrar
document.addEventListener('click', (e) => {
  if (e.target.id === "queue-status") {
    appState.notificationsVisible = !appState.notificationsVisible;
    renderCarousel();
  }
});