/**
 * Módulo: navigation.js
 * Maneja la lógica de navegación cinematográfica entre países y el control de rotación.
 */
import { appState } from './state.js';
import { CONFIG, INSET_VIEWS } from '../config.js';
import { actualizarStatsUI } from './ui.js';
import { renderCarousel } from './notifications.js';

// --- Configuración de Vistas por País ---

/**
 * Determina el nivel de zoom óptimo para cada país.
 * @param {string} nombre - Nombre del país.
 * @returns {number} Nivel de zoom (6.5 por defecto).
 */
const getZoomPorPais = (nombre) => {
  return CONFIG.ZOOM_PAISES[nombre.toLowerCase()] || CONFIG.ZOOM_DEFAULT;
};

// --- Gestión de Navegación ---

/**
 * Cambia el enfoque del mapa al siguiente o anterior país en la lista.
 * @param {number} dir - Dirección de la navegación (1 o -1).
 * @returns {void}
 */
export function navegarPais(dir) {
  if (document.hidden) return; // No rotar si la pestaña está minimizada

  appState.paisActualIdx = (appState.paisActualIdx + dir + appState.paises.length) % appState.paises.length;
  const pais = appState.paises[appState.paisActualIdx];
  appState.msNextRotation = CONFIG.MS_ROTACION;
  enfocarPais(pais);
}

/**
 * Alterna el estado de pausa de la rotación automática.
 * @returns {void}
 */
export function togglePausa() {
  appState.estaPausado = !appState.estaPausado;
  const btn = document.getElementById("btn-pause");
  btn.textContent = appState.estaPausado ? "▶" : "⏸";
  if (!appState.estaPausado) appState.msNextRotation = CONFIG.MS_ROTACION;
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

  const zoom = getZoomPorPais(pais.Nombre);

  appState.isProgrammaticMove = true;
  appState.map.flyTo([pais.Latitud, pais.Longitud], zoom, {
    animate: true,
    duration: 5,
  });
}