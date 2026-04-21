/**
 * Módulo: notifications.js
 * Gestiona el sistema de colas y el renderizado de notificaciones de fallo.
 */
import { appState } from './state.js';
import { getCache } from './db.js';

let swiperInstance = null;
let stickyTimeout = null;
const alertTimestamps = new Map(); // Seguimiento de tiempo por Número de Serie
const RECENT_THRESHOLD = 3 * 60 * 1000; // 3 minutos en ms
let lastAlertsHash = "";

/**
 * Inicializa el carrusel de alertas.
 */
async function initAlertSystem() {
  // 1. Cargar desde caché para saber qué alertas ya existían
  const cached = await getCache('mapa_data').catch(() => null);
  if (cached && cached.alertas) {
    appState.lastAlerts = new Set(cached.alertas.map(a => a.sn));
    renderCarousel(); // Renderizado inicial desde caché
  }
}

/**
 * Sincroniza las alertas del servidor con el carrusel local.
 * @param {Array} serverAlerts - Lista de alertas actuales del backend.
 */
export function syncAlerts(serverAlerts) {
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
    const isRecent = (now - firstSeen) < RECENT_THRESHOLD;
    return { ...alert, isRecent };
  });

  // Limpieza del mapa de tiempos para alertas que ya no existen
  for (const sn of alertTimestamps.keys()) {
    if (!currentSns.has(sn)) alertTimestamps.delete(sn);
  }

  // Actualizamos el historial para la próxima vuelta
  appState.lastAlerts = currentSns;
  appState.activeAlerts = processedAlerts;
  
  renderCarousel();
}

/**
 * Inicializa la instancia de Swiper para el carrusel.
 * @returns {void}
 */
export function iniciarCarrusel() {
  if (swiperInstance) return;

  swiperInstance = new Swiper('#failure-feed', {
    direction: 'vertical',
    slidesPerView: 'auto',
    spaceBetween: 8,
    loop: true, 
    speed: 1500, // Velocidad muy lenta para movimiento continuo
    autoplay: {
      delay: 0, // Movimiento sin pausas
      disableOnInteraction: false,
    },
    allowTouchMove: false, // Desactivado para ticker continuo más estable
    grabCursor: false
  });

  // Forzar CSS lineal para el efecto ticker continuo
  if (swiperInstance && swiperInstance.wrapperEl) {
    swiperInstance.wrapperEl.style.transitionTimingFunction = 'linear';
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderCarousel();
    }, 200);
  });
  initAlertSystem();
}

/**
 * Renderiza las alertas visibles basadas en el espacio disponible.
 */
export function renderCarousel() {
  const feed = document.getElementById("failure-feed");
  const queueStatus = document.getElementById("queue-status");
  const wrapper = document.getElementById("failure-feed-wrapper");
  if (!feed || !wrapper) return;

  if (!appState.notificationsVisible) {
    feed.style.opacity = "0";
    if (swiperInstance) swiperInstance.autoplay.stop();
    if (queueStatus) queueStatus.textContent = "Mostrar notificaciones";
    return;
  }

  if (queueStatus) queueStatus.textContent = "Ocultar notificaciones";

  // Recalcular límites de espacio
  const uiOverlay = document.getElementById("ui-overlay");
  const insetContainer = document.getElementById("inset-map-container");
  const queueContainer = document.getElementById("queue-status-container");
  const isInsetActive = insetContainer && insetContainer.classList.contains('active');

  // Reposicionar el botón de cola según el minimapa
  if (queueContainer) {
      queueContainer.style.bottom = isInsetActive ? '25.5vh' : '0.5vh';
  }
  
  const topLimit = uiOverlay ? uiOverlay.getBoundingClientRect().bottom + 10 : 100;
  const bottomLimit = queueContainer ? (queueContainer.getBoundingClientRect().top - 10) : (window.innerHeight - 20);
  
  feed.style.opacity = "1";
  feed.style.top = `${topLimit}px`;
  feed.style.height = `${bottomLimit - topLimit}px`;

  // Evitar re-renderizado costoso si los datos no han cambiado
  const currentHash = JSON.stringify(appState.activeAlerts);
  if (currentHash === lastAlertsHash) {
    if (swiperInstance) swiperInstance.update();
    return;
  }
  lastAlertsHash = currentHash;

  // NOTA: La combinación de Swiper Loop + Morphdom es compleja porque Swiper genera clones 
  // que Morphdom no conoce. Para evitar que el carrusel "salte" al principio en actualizaciones 
  // de fondo, capturamos la posición actual y la restauramos si no hay novedades.
  const currentTranslate = swiperInstance ? swiperInstance.getTranslate() : 0;

  // 2. Generar el HTML de los slides
  const html = appState.activeAlerts.map(alerta => `
    <div class="swiper-slide fail-note status-${alerta.status} ${alerta.isRecent ? 'recent-alert-glow' : ''}">
      <div class="fail-content">
        <strong>${alerta.status === "rojo" ? "CONEXIÓN" : "ERROR"}:</strong> ${alerta.nombre}
        <br><small>${alerta.provincia.toUpperCase()} - ${alerta.codigoError}</small>
      </div>
    </div>
  `).join("");

  // 3. Usar morphdom para actualizar solo lo necesario sin romper Swiper
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Si hay loop, debemos destruirlo temporalmente para que morphdom no borre los duplicados de Swiper
  if (swiperInstance && swiperInstance.params.loop) swiperInstance.loopDestroy();

  window.morphdom(wrapper, tempDiv, {
    childrenOnly: true,
    onBeforeElUpdated: (fromEl, toEl) => {
      // Solo procesar si son elementos (evita errores con nodos de texto)
      if (fromEl.nodeType !== 1) return true;
      if (fromEl.isEqualNode(toEl)) return false;
      
      // Preservar clases de estado de Swiper
      const swiperClasses = ["swiper-slide-active", "swiper-slide-next", "swiper-slide-prev", "swiper-slide-duplicate"];
      swiperClasses.forEach(cls => {
        if (fromEl.classList.contains(cls)) toEl.classList.add(cls);
      });
      return true;
    }
  });

  // 4. Actualizar Swiper y reiniciar Autoplay si no hay novedades fijadas
  if (swiperInstance) {
    if (swiperInstance.params.loop) swiperInstance.loopCreate();
    swiperInstance.update();
    
    // Restauramos siempre la posición para que el movimiento sea infinito y sin saltos
    swiperInstance.setTranslate(currentTranslate);
    if (appState.notificationsVisible && !swiperInstance.autoplay.running) {
      swiperInstance.autoplay.start();
    }
    if (swiperInstance.wrapperEl) {
      swiperInstance.wrapperEl.style.transitionTimingFunction = 'linear';
    }
  }
}

// Manejador para Ocultar/Mostrar
document.addEventListener('click', (e) => {
  if (e.target.id === "queue-status") {
    appState.notificationsVisible = !appState.notificationsVisible;
    renderCarousel();
  }
});

/**
 * Limpiador de seguridad: Elimina notificaciones que se quedaron "a medias"
 * durante una transición al cambiar de pestaña.
 */
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    const stuckNotes = document.querySelectorAll('.fail-note.leaving');
    stuckNotes.forEach(note => note.remove());

    // Forzar reinicio de Swiper al volver a la página
    if (swiperInstance) {
      swiperInstance.update();
      if (appState.notificationsVisible && !swiperInstance.autoplay.running) {
        swiperInstance.autoplay.start();
      }
    }
  } else {
    if (swiperInstance) swiperInstance.autoplay.stop();
  }
});