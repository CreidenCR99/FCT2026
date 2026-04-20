/**
 * Módulo: navigation.js
 * Maneja la lógica de navegación cinematográfica entre países y el control de rotación.
 */
import { appState, CONFIG, INSET_VIEWS } from './state.js';
import { actualizarStatsUI } from './ui.js';

// --- Gestión de Navegación ---

/**
 * Cambia el enfoque del mapa al siguiente o anterior país en la lista.
 * @param {number} dir - Dirección de la navegación (1 o -1).
 * @returns {void}
 */
export function navegarPais(dir) {
  appState.paisActualIdx = (appState.paisActualIdx + dir + appState.paises.length) % appState.paises.length;
  const pais = appState.paises[appState.paisActualIdx];
  appState.msNextRotation = CONFIG.MS_ROTACION;
  enfocarPais(pais);

  clearInterval(appState.rotacionInterval);
  if (!appState.estaPausado) {
    appState.rotacionInterval = setInterval(() => navegarPais(1), CONFIG.MS_ROTACION);
  }
}

/**
 * Alterna el estado de pausa de la rotación automática.
 * @returns {void}
 */
export function togglePausa() {
  appState.estaPausado = !appState.estaPausado;
  const btn = document.getElementById("btn-pause");
  btn.textContent = appState.estaPausado ? "▶" : "⏸";

  if (appState.estaPausado) {
    clearInterval(appState.rotacionInterval);
    appState.rotacionInterval = null;
  } else {
    appState.msNextRotation = CONFIG.MS_ROTACION;
    appState.rotacionInterval = setInterval(() => navegarPais(1), CONFIG.MS_ROTACION);
  }
}

/**
 * Realiza el zoom y desplazamiento (flyTo) hacia un país específico.
 * @param {Object} pais - Objeto con datos geográficos del país.
 * @returns {void}
 */
export function enfocarPais(pais) {
  if (!pais) return;
  document.getElementById("pais-nombre").textContent = pais.Nombre;
  actualizarStatsUI();

  const insetContainer = document.getElementById("inset-map-container");
  const config = INSET_VIEWS[pais.Nombre.toLowerCase()];
  
  if (config) {
    insetContainer.classList.add('active');
    appState.insetMap.setView(config.center, config.zoom);
    appState.insetMap.invalidateSize();
  } else {
    insetContainer.classList.remove('active');
  }

  appState.map.flyTo([pais.Latitud, pais.Longitud], pais.Zoom || 6.5, {
    animate: true,
    duration: 5,
  });
}