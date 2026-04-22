/**
 * Módulo: config.js
 * Centraliza los parametros configurables de la aplicación
 */

/**
 * Constantes de configuración de zoom y tiempos de ejecución.
 * @property {String} API_ENDPOINT - URL base para las llamadas a la API.
 * @property {Number} MS_DATOS - Intervalo de actualización de datos en milisegundos.
 * @property {Number} MS_ROTACION - Intervalo de rotación automática entre países en milisegundos.
 * @property {Number} VELOCIDAD_CARRUSEL - Intervalo de cambio de alerta en el carrusel en milisegundos.
 * @property {Number} INACTIVO - Tiempo de inactividad del usuario antes de retomar la rotación automática.
 *      @description Si el usuario ha cambiado la posición de la camara, despues de estos segundos, la camara volvera a su posición original.
 * @property {Number} ZOOM_DEFAULT - Nivel de zoom por defecto para países sin configuración específica.
 * @property {Object} ZOOM_PAISES - Configuración de niveles de zoom específicos por país (clave: nombre del país en minúsculas).
 * @property {Object} NOTIFICATIONS - Configuración relacionada con las notificaciones y alertas.
 *      @property {Number} RECENT_THRESHOLD_MS - Umbral de tiempo para considerar una alerta como "reciente" en milisegundos.
 * @property {Object} SOUNDS - Configuración de sonidos para diferentes tipos de alertas.
 */
export const CONFIG = {
  API_ENDPOINT: 'api/main.php', // URL base de la API

  MS_DATOS: 7500,               // 7,5 segundos 
  MS_ROTACION: 300000,          // 5 minutos (5 * 60 * 1000)
  VELOCIDAD_CARRUSEL: 10000,    // 10.000 = LENTO | 1.000 = RAPIDO
  INACTIVO: 30000,              // 30 segundos (-1 para desactivarlo) 
  ZOOM_DEFAULT: 6.5,            // 6.5
  ZOOM_PAISES: {
    'españa': 6.7,              // 6.7
    'colombia': 6.5             // 6.5
  },
  NOTIFICATIONS: {
    RECENT_THRESHOLD_MS: 180000 // 3 minutos (3 * 60 * 1000) para brillo de alerta nueva
  },
  SOUNDS: {
    VOLUME: 0.5,                // 0.5 - Volumen general (0.0 a 1.0)
    TYPES: {
      // Configuración de síntesis: [Frecuencia(Hz), Tipo de onda, Duración(s)]
      // Ondas: 'sine', 'square', 'sawtooth', 'triangle'
      ROJO:    { freq: 150, type: 'sawtooth', duration: 0.5 }, // Grave y áspero (Alerta)
      NARANJA: { freq: 880, type: 'sine',     duration: 0.5 }  // Agudo y limpio (Notificación)
    }
  }

};

/**
 * Configuración de regiones lejanas por país para el mapa secundario (inset).
 * @example "españa": { center: [28.4, -16.0], zoom: 6.3, label: "Canarias" }
 * @type {Object}
 */
export const INSET_VIEWS = {
  "españa": { center: [28.4, -16.0], zoom: 6.3, label: "Canarias" }
  /* Coordenadas de otras islas para el futuro
  "portugal": { center: [32.7, -17.0], zoom: 7, label: "Madeira / Azores" },
  "francia": { center: [14.6, -61.0], zoom: 7, label: "Antillas" },
  */
};


/**
 * URLs y atribuciones para los mapas base y de líneas de terreno.
 * @property {String} MAP_TILES - URL de los tiles para el mapa base.
 * @property {String} TERRAIN_LINES - URL de los tiles para las líneas de terreno entre provincias.
 * @property {String} ATTRIBUTION - HTML con las atribuciones necesarias para el uso de los mapas.
 */
export const MAPAS = {
    MAP_TILES: "https://tiles.stadiamaps.com/tiles/stamen_terrain_background/{z}/{x}/{y}{r}.{ext}",
    TERRAIN_LINES: "https://tiles.stadiamaps.com/tiles/stamen_terrain_lines/{z}/{x}/{y}{r}.{ext}",
    ATTRIBUTION: '&copy; <a href="https://www.sicolares.com/" target="_blank">SicoLares</a> &copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}