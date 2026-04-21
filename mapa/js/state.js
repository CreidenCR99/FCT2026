/**
 * Módulo: state.js
 * Centraliza la configuración estática y el estado dinámico de la aplicación.
 */

/**
 * Constantes de configuración y tiempos de ejecución.
 * @type {Object}
 */
export const CONFIG = {
  MS_DATOS: 7500,
  MS_ROTACION: 300000,
  MAP_TILES: "https://tiles.stadiamaps.com/tiles/stamen_terrain_background/{z}/{x}/{y}{r}.{ext}",
  TERRAIN_LINES: "https://tiles.stadiamaps.com/tiles/stamen_terrain_lines/{z}/{x}/{y}{r}.{ext}",
  ATTRIBUTION: '&copy; <a href="https://www.sicolares.com/" target="_blank">SicoLares</a> &copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  ZOOM_DEFAULT: 6.5,
  ZOOM_PAISES: {
    'españa': 6.7,
    'colombia': 6.5
  }
};

/**
 * Configuración de regiones lejanas por país para el mapa secundario (inset).
 * @type {Object}
 */
export const INSET_VIEWS = {
  "españa": { center: [28.4, -16.2], zoom: 6, label: "Canarias" }
  /* 
  "portugal": { center: [32.7, -17.0], zoom: 7, label: "Madeira / Azores" },
  "francia": { center: [14.6, -61.0], zoom: 7, label: "Antillas" },
  */
};

/**
 * @namespace
 * @property {Object|null} map - Instancia principal de Leaflet.
 * @property {Object|null} insetMap - Instancia del mapa secundario para regiones lejanas.
 * @property {Array<Object>} paises - Listado de países disponibles para la rotación.
 * @property {number} paisActualIdx - Índice del país que se está visualizando actualmente.
 * @property {Map<string, Object>} markersMap - Mapa de marcadores principales (Key: Provincia Cod).
 * @property {Map<string, Object>} insetMarkersMap - Mapa de marcadores secundarios (Key: Provincia Cod).
 * @property {Array} provincias - Datos consolidados de estados por provincia.
 * @property {Set} lastAlerts - Set de Números de Serie para evitar notificaciones duplicadas.
 * @property {Array} activeAlerts - Lista de alertas en el carrusel.
 * @property {boolean} notificationsVisible - Estado de visibilidad del panel.
 * @property {number|null} dataInterval - Referencia al intervalo de actualización de datos.
 * @property {number|null} rotacionInterval - Referencia al intervalo de rotación de países.
 * @property {boolean} estaPausado - Estado de la rotación automática.
 * @property {number} msNextData - Tiempo restante para la próxima sincronización de datos.
 * @property {number} msNextRotation - Tiempo restante para el próximo cambio de país.
 * @property {number|null} inactivityTimeout - Referencia al timeout de inactividad del mapa.
 * @property {boolean} isProgrammaticMove - Flag para distinguir movimientos programáticos del usuario.
 */
export const appState = {
  map: null,
  insetMap: null,
  paises: [],
  paisActualIdx: 0,
  markersMap: new Map(),
  insetMarkersMap: new Map(),
  provincias: [],
  lastAlerts: new Set(),
  activeAlerts: [],
  notificationsVisible: true,
  dataInterval: null,
  rotacionInterval: null,
  estaPausado: false,
  msNextData: 0,
  msNextRotation: 0,
  inactivityTimeout: null,
  isProgrammaticMove: false
};