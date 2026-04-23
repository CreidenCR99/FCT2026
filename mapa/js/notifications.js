/**
 * Módulo: notifications.js
 * Gestiona el sistema de colas y el renderizado de notificaciones de fallo.
 */
import { appState } from './state.js';
import { CONFIG } from '../config.js';
import { getCache } from './db.js';

let swiperInstance = null;
let stickyTimeout = null; // Usado para gestionar el timeout de alertas "pegajosas" (no implementado en este contexto)

/** @type {AudioContext|null} Contexto de audio para síntesis de sonidos. */
let audioCtx = null;

/** 
 * Mapa para rastrear cuándo se vio por primera vez una alerta (SN -> timestamp).
 * Permite gestionar efectos visuales de "novedad".
 * @type {Map<string, number>} 
 */
const alertTimestamps = new Map(); 
let lastAlertsHash = "";

/**
 * Inicializa el carrusel de alertas.
 * Intenta recuperar el estado previo de IndexedDB para evitar parpadeos en la carga.
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
  if (serverAlerts.length === 0) {
    appState.isDummyAlertsMode = true;
  }

  // Actualizamos el historial para la próxima vuelta
  appState.lastAlerts = currentSns;
  appState.activeAlerts = processedAlerts;
  
  renderCarousel();
}

/**
 * Inicializa la instancia de Swiper para el carrusel.
 * Configura el modo ticker continuo y gestiona el loop manual infinito.
 * @returns {void}
 */
export function iniciarCarrusel() {
  if (swiperInstance) return;

  swiperInstance = new Swiper('#failure-feed', {
    direction: 'vertical',
    slidesPerView: 'auto',
    spaceBetween: 8,
    loop: false, 
    speed: CONFIG.VELOCIDAD_CARRUSEL, // Velocidad muy lenta para movimiento continuo
    autoplay: {
      delay: 0, // Movimiento sin pausas
      disableOnInteraction: false,
    },
    allowTouchMove: true,
    on: {
      setTranslate: function (swiper) {
        // Evitamos recursividad si ya estamos reseteando
        if (swiper.isResetting) return;

        // En lugar de updateActiveIndex (pesado), calculamos el progreso de forma ligera.
        // Teletransportamos solo cuando el primer elemento del buffer (índice = length) 
        // llega al inicio del contenedor.
        if (appState.activeAlerts.length > 0 && swiper.activeIndex >= appState.activeAlerts.length) {
          swiper.isResetting = true;
          swiper.autoplay.stop();
          swiper.setTransition(0);
          swiper.slideTo(0, 0);

          // Restauramos el comportamiento de ticker lineal tras el salto
          if (swiper.wrapperEl) swiper.wrapperEl.style.transitionTimingFunction = 'linear';
          
          setTimeout(() => {
            if (appState.notificationsVisible) {
              swiper.autoplay.start();
            }
            swiper.isResetting = false;
          }, 50); // Pequeño margen para que el DOM se asiente
        }
      }
    },
    grabCursor: true
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
 * Utiliza morphdom para una actualización eficiente sin interrumpir la animación de Swiper.
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
      queueContainer.style.bottom = isInsetActive ? '0.5vh' : '0.5vh';
  }
  
  const topLimit = uiOverlay ? uiOverlay.getBoundingClientRect().bottom + 0 : 0;
  const bottomLimit = queueContainer ? (queueContainer.getBoundingClientRect().top - 10) : (window.innerHeight - 20);
  
  feed.style.opacity = "1";
  feed.style.top = `${topLimit}px`;
  feed.style.height = `${bottomLimit - topLimit}px`;

  /**
   * Función auxiliar para garantizar que el movimiento continúe sin saltos.
   * Reinicia el motor de autoplay de Swiper y asegura el timing lineal.
   */
  const restartContinuousMotion = () => {
    if (swiperInstance && appState.notificationsVisible) {
      swiperInstance.autoplay.stop();
      swiperInstance.autoplay.start();
      if (swiperInstance.wrapperEl) {
        swiperInstance.wrapperEl.style.transitionTimingFunction = 'linear';
      }
    }
  };

  // Optimización: Si el contenido es idéntico al anterior, solo nos aseguramos de que el motor siga corriendo.
  const currentHash = JSON.stringify(appState.activeAlerts);
  if (currentHash === lastAlertsHash) {
    restartContinuousMotion();
    return;
  }
  lastAlertsHash = currentHash;

  // NOTA: La combinación de Swiper Loop + Morphdom es compleja porque Swiper genera clones 
  // que Morphdom no conoce. Detenemos el autoplay antes de manipular el DOM.
  if (swiperInstance) swiperInstance.autoplay.stop();

  // Si el swiper ya estaba en el área de buffer o separador, reseteamos a 0 
  // antes del morph para evitar saltos visuales extraños con el nuevo contenido.
  if (swiperInstance && (swiperInstance.activeIndex) >= appState.activeAlerts.length) {
    swiperInstance.slideTo(0, 0);
  }
  const currentTranslate = swiperInstance ? swiperInstance.getTranslate() : 0;

  // 2. Generar el HTML: Lista real + buffer de los 7 primeros
  let alertsToRender = [];
  const shouldShowDummy = appState.activeAlerts.length === 0;
  appState.isDummyAlertsMode = shouldShowDummy; // Actualizar el flag de estado

  if (shouldShowDummy) {
    // Generar 7 alertas de relleno
    for (let i = 0; i < 7; i++) {
      alertsToRender.push({
        sn: `dummy-${i}`,
        status: 'gris', // Puedes usar un estado específico para las dummy alerts
        nombre: 'Esperando alertas...',
        provincia: 'SIN DATOS',
        codigoError: 'N/A',
        isRecent: false
      });
    }
  } else {
    alertsToRender = [...appState.activeAlerts];
  }

  if (alertsToRender.length > 0) { // Solo añadir buffer si hay elementos para mostrar
    // Añadimos los 7 primeros al final para que el salto sea invisible
    alertsToRender.push(...alertsToRender.slice(0, Math.min(7, alertsToRender.length)));
  }

  const html = alertsToRender.map(alerta => `
    <div class="swiper-slide fail-note status-${alerta.status} ${alerta.isRecent ? 'recent-alert-glow' : ''}">
      <div class="fail-content">
        <strong>${alerta.status === "rojo" ? "CONEXIÓN" : "ERROR"}:</strong> ${alerta.nombre}
        <br><small>${alerta.provincia ? alerta.provincia.toUpperCase() : ''} - ${alerta.codigoError}</small>
      </div>
    </div>
  `).join("");

  // 3. Usar morphdom para actualizar solo lo necesario sin romper Swiper
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

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
    swiperInstance.update();
    
    // Restauramos siempre la posición para que el movimiento sea infinito y sin saltos
    swiperInstance.setTranslate(currentTranslate);

    // Forzamos el reinicio tras un breve delay para que el DOM se asiente
    setTimeout(restartContinuousMotion, 50);
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