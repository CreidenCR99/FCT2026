/**
 * Módulo: state.js
 */

/**
 * Frecuencia de actualización automática en milisegundos (7.5 segundos).
 * @type {number}
 */
export const INTERVALO_MS = 7500;

/**
 * Objeto de estado global que centraliza los datos y la configuración de la aplicación.
 * @namespace
 * @property {number} maxLineasPresentacion - Número máximo de filas permitidas por página en el modo presentación.
 * @property {Array<Object>} datosTabla - Almacén de los datos de máquinas y logs recuperados del servidor.
 * @property {Array<string>} columnasTabla - Nombres de las columnas dinámicas detectadas en el dataset.
 * @property {number|null} estadoInterval - Referencia al ID del intervalo de actualización automática.
 * @property {boolean} modoPresentacion - Indica si la interfaz está en modo pantalla completa/rotación.
 * @property {Array<Array<Object>>} paginasPresentacion - Datos de máquinas agrupados y paginados para la presentación.
 * @property {number} paginaPresentacionActual - Índice de la página que se muestra actualmente en la rotación.
 * @property {boolean} estaPausado - Estado de pausa de la rotación automática en el modo presentación.
 * @property {string} filtroOrganismo - Valor del filtro seleccionado para Organismo.
 * @property {string} filtroProvincia - Valor del filtro seleccionado para Provincia.
 * @property {string} filtroTexto - Cadena de búsqueda para filtrar la tabla localmente.
 * @property {AbortController|null} currentController - Controlador para abortar peticiones fetch en curso.
 * @property {Object} prevEstados - Mapa de NumeroSerie -> Clase de estado para detectar cambios visuales.
 * @property {Object} prevKpis - Almacena los valores anteriores de los KPIs para las animaciones numéricas.
 * @property {string|null} sortCol - Nombre de la columna por la que se está ordenando actualmente.
 * @property {number} sortDir - Dirección de la ordenación (1 para ascendente, -1 para descendente).
 */
export const appState = {
  maxLineasPresentacion: 20,
  datosTabla: [],
  columnasTabla: [],
  estadoInterval: null,
  modoPresentacion: false,
  paginasPresentacion: [],
  paginaPresentacionActual: 0,
  estaPausado: false,
  filtroOrganismo: "",
  filtroProvincia: "",
  filtroTexto: "",
  currentController: null,
  prevEstados: {},
  prevKpis: { total: 0, ok: 0, alerta: 0, log: 0 },
  sortCol: null,
  sortDir: 1
};
