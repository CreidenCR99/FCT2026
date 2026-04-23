/**
 * Módulo: state.js
 * Maneja el estado dinámico de la aplicación.
 */

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
 * @property {boolean} isDummyAlertsMode - Flag para activar modo de pruebas con alertas simuladas.
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
  isProgrammaticMove: false,
  isDummyAlertsMode: false
};