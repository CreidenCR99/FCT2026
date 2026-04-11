/**
 * Módulo: state.js
 */

export const INTERVALO_MS = 7500;

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
  sortCol: null,
  sortDir: 1
};
