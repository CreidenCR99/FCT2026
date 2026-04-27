/**
 * @module api.js
 * @description Capa de abstracción para la comunicación con el backend y el Worker.
 * Gestiona la carga de datos geográficos, la sincronización de alertas críticas
 * y el renderizado eficiente de marcadores en el mapa mediante morphdom.
 */
import { appState } from './state.js';
import { CONFIG } from '../config.js';
import { aplicarFiltroHorario, actualizarStatsUI, sincronizarLeyenda } from './ui.js';
import { syncAlerts, getAlertTimestampsObject } from './notifications.js';
import { getCache, setCache } from './db.js';
import { showDBErrorToast } from '../../core/toasts.js';

// --- Inicialización del Worker ---

/** 
 * Trabajador en segundo plano para procesar datos pesados sin bloquear el hilo de UI.
 */
const apiWorker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

/** 
 * URL base para las peticiones desde el Worker (Resuelve problemas de 404 por rutas relativas)
 */
const API_BASE_URL = new URL('../', import.meta.url).href;

/**
 * Gestor de promesas para sincronizar el Worker con las llamadas await del hilo principal.
 * @type {Map<string, Function>}
 */
const pendingRequests = new Map();

apiWorker.onmessage = (e) => {
  const { mode, status, provincias, alertas, newAlerts, data, error } = e.data;
  const resolve = pendingRequests.get(mode);

  if (!resolve) return;
  pendingRequests.delete(mode);

  if (status >= 400) {
    if (e.data.db_connection_error) {
      showDBErrorToast("La conexión con la base de datos ha fallado en el servidor.");
    }
    console.error(`Error en Worker (${mode}):`, error);
    resolve();
    return;
  }

  if (status === 200) {
    if (mode === 'paises') {
      appState.paises = data;
      setCache('paises', data);
    } else if (mode === 'mapa_data') {
      // Actualización masiva de estado global tras recibir datos de puntos
      appState.provincias = provincias;
      setCache('mapa_data', { 
        provincias, 
        alertas, 
        alertTimestamps: getAlertTimestampsObject() 
      });

      syncAlerts(alertas);
      renderizarPuntosMapa();
      actualizarStatsUI();
    }
  }
  resolve();
};

/**
 * Solicita al servidor el catálogo de países habilitados para la rotación.
 * @async
 * @returns {Promise<void>} Resuelve cuando los países se han cargado en el estado.
 */
export async function cargarPaises() {
  // Intentar recuperación desde caché para carga instantánea
  const cached = await getCache('paises');
  if (cached) appState.paises = cached;

  return new Promise((resolve) => {
    pendingRequests.set('paises', resolve);
    apiWorker.postMessage({ mode: 'paises', url: `${API_BASE_URL}${CONFIG.API_ENDPOINT}?modo=paises` });
    
    if (cached) resolve(); // Resolvemos de inmediato si tenemos caché
  });
}

/**
 * Sincroniza el estado del mapa con el servidor. 
 * Actualiza provincias, detecta nuevos fallos y renderiza los marcadores.
 * @async
 * @returns {Promise<void>} Resuelve tras la petición o recuperación de caché.
 */
export async function actualizarDatos() {
  // Recuperar datos previos de provincias para pintar el mapa al instante
  const cached = await getCache('mapa_data');
  const hasCache = cached && !appState.provincias.length;

  if (hasCache) {
    appState.provincias = cached.provincias;
    // Restauramos el historial para comparar qué es nuevo realmente
    appState.lastAlerts = new Set((cached.alertas || []).map(a => a.sn));
    // Cargamos el carrusel inicial desde caché
    syncAlerts(cached.alertas || []);
    renderizarPuntosMapa();
    actualizarStatsUI();
  }

  return new Promise((resolve) => {
    // Si la pestaña está minimizada, pausamos la petición al servidor
    if (document.hidden) {
      resolve();
      return;
    }

    aplicarFiltroHorario();
    appState.msNextData = CONFIG.REFRESH_INTERVAL_MS;

    const bar = document.getElementById("data-refresh-bar");
    if (bar) {
      bar.style.transition = "none";
      bar.style.width = "0%";
      void bar.offsetWidth; // Forzar reflow para que el reinicio visual sea instantáneo
    }

    pendingRequests.set('mapa_data', resolve);
    apiWorker.postMessage({
      mode: 'mapa_data',
      url: `${API_BASE_URL}${CONFIG.API_ENDPOINT}?modo=mapa_data`,
      payload: { lastAlerts: appState.lastAlerts }
    });

    if (hasCache) resolve(); // Resolvemos de inmediato si ya pintamos el caché
  });
}

/**
 * Renderizado inteligente de marcadores.
 * Actualiza marcadores existentes o crea nuevos, eliminando los que ya no tienen datos.
 * @returns {void}
 */
function renderizarPuntosMapa() {
  const codigosNuevos = new Set();

  // Calculamos un retraso negativo basado en el reloj del sistema para que todas
  // las animaciones de 2s (definidas en CSS) pulsen exactamente al mismo tiempo,
  // independientemente de cuándo se crearon los elementos en el DOM.
  const syncDelay = -(performance.now() % 2000) / 1000;
  sincronizarLeyenda();

  appState.provincias.forEach((prov) => {
    const cod = prov.id_pais + "_" + prov.nombre; // ID único compuesto
    codigosNuevos.add(cod);

    let iconHTML = "";
    let hasData = false;
    const hasCritical = prov.counts.rojo > 0 || prov.counts.naranja > 0;

    ["verde", "rojo", "naranja"].forEach((status) => {
      const count = prov.counts[status];
      // Ignoramos estados sin máquinas
      if (count <= 0) return;
      hasData = true;
      iconHTML += `<div class="mini-dot dot-${status}" style="animation-delay: ${syncDelay}s">${count}</div>`;
    });

    if (!hasData) return;

    const fullHTML = `<div class="province-box ${hasCritical ? "pulse-alert" : ""}" style="animation-delay: ${syncDelay}s">${iconHTML}</div>`;

    const updateMarker = (mapInstance, storageMap, coords) => {
      if (storageMap.has(cod)) {
        const m = storageMap.get(cod);
        if (m._lastHTML !== fullHTML) {
          // OPTIMIZACIÓN: Usamos morphdom para parchear el marcador existente sin recrearlo
          const iconElement = m.getElement()?.querySelector('.province-box');
          if (iconElement) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = fullHTML;
            
            // Usamos morphdom con hooks para animar los cambios de cifras en los puntos
            morphdom(iconElement, tempDiv.firstChild, {
              onBeforeElUpdated: (fromEl, toEl) => {
                if (fromEl.classList.contains('mini-dot') && fromEl.textContent !== toEl.textContent) {
                  fromEl.classList.remove('dot-updating');
                  void fromEl.offsetWidth; // Forzar reflow para reiniciar la animación
                  fromEl.classList.add('dot-updating');
                }
                return true;
              }
            });
          } else {
            m.setIcon(L.divIcon({ className: "province-rect-container", html: fullHTML, iconSize: [0, 0] }));
          }
          m._lastHTML = fullHTML;
        }
      } else {
        const icon = L.divIcon({ className: "province-rect-container", html: fullHTML, iconSize: [0, 0] });
        const m = L.marker(coords, { icon }).addTo(mapInstance);
        m.bindPopup(`<strong>${prov.nombre}</strong>`);
        m._lastHTML = fullHTML;
        storageMap.set(cod, m);
      }
    };

    updateMarker(appState.map, appState.markersMap, [prov.lat, prov.lng]);
    updateMarker(appState.insetMap, appState.insetMarkersMap, [prov.lat, prov.lng]);
  });

  // Limpieza de marcadores huérfanos
  const limpiarHuerfanos = (mapInstance, storageMap) => {
    for (const [cod, marker] of storageMap.entries()) {
      if (!codigosNuevos.has(cod)) {
        mapInstance.removeLayer(marker);
        storageMap.delete(cod);
      }
    }
  };

  limpiarHuerfanos(appState.map, appState.markersMap);
  limpiarHuerfanos(appState.insetMap, appState.insetMarkersMap);
};
