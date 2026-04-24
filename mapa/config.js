/**
 * Módulo: config.js
 * Centraliza los parametros configurables de la aplicación
 */

/**
 * Constantes de configuración de zoom y tiempos de ejecución.
 * @property {String} API_ENDPOINT - URL base para las llamadas a la API.
 * @property {Number} MS_DATOS - Intervalo de actualización de datos en milisegundos.
 * @property {Number} MS_ROTACION_DEFAULT - Intervalo de rotación automática entre países por defecto en milisegundos.
 * @property {Object} MS_ROTACION_PAISES - Configuración de intervalos de rotación específicos por país (Utiliza el código de 3 números del país).
 * @property {Number} VELOCIDAD_CARRUSEL - Intervalo de cambio de alerta en el carrusel en milisegundos. (60.000 = LENTO | 1.000 = RAPIDO)
 * @property {Number} INACTIVO - Tiempo de inactividad del usuario antes de retomar la rotación automática. (Dejar en -1 para desactivarlo)
 *      @description Si el usuario ha cambiado la posición de la camara, despues de estos segundos, la camara volvera a su posición original.
 * @property {Number} ZOOM_DEFAULT - Nivel de zoom por defecto para países sin configuración específica.
 * @property {Object} ZOOM_PAISES - Configuración de niveles de zoom específicos por país (Utiliza el codigo de 3 numeros del país).
 * @property {Object} NOTIFICATIONS - Configuración relacionada con las notificaciones y alertas.
 *      @property {Number} RECENT_THRESHOLD_MS - Umbral de tiempo para considerar una alerta como "reciente" en milisegundos y aplicarle un brillo.
 *      @property {Number} LOOP_BUFFER_SIZE - Cantidad de elementos que se repiten al final de la lista para simular un desplazamiento infinito suave.
 * @property {Object} SOUNDS - Configuración de sonidos para diferentes tipos de alertas.
 *      @property {Number} VOLUME - Volumen general para los sonidos (rango de 0.0 a 1.0).
 *      @property {Object} TYPES - Definición de tipos de sonidos con sus parámetros de frecuencia(Hz), tipo de onda y duración(EN SEGUNDOS).
 * 
 * Todos los tiempos (MENOS SONIDOS) estan en milisegundos (ms):
 * 30 segundos = 30 * 1000 = 30000 ms
 * 5 minutos = 5 * 60 * 1000 = 300000 ms
 * 
 * Ambas son válidas:
 * MS_ROTACION = 5 * 60 * 1000
 * MS_ROTACION = 300000
 */
export const CONFIG = {
  API_ENDPOINT: 'api/main.php', // URL base de la API

  MS_DATOS: 7500,               // 7500 ms | 7,5 segundos 
  MS_ROTACION_DEFAULT: 300000,  // 300000 ms | 5 minutos
  MS_ROTACION_PAISES: {
    '724': 300000,              // 300000 ms | 5 minutos - España
    '170': 120000,              // 120000 ms | 2 minutos - Colombia
  },
  VELOCIDAD_CARRUSEL: 20000,    // 20000 (60.000 = LENTO | 1.000 = RAPIDO)
  INACTIVO: 30000,              // 30000 ms | 30 segundos (-1 para desactivarlo) 
  ZOOM_DEFAULT: 6.5,            // 6.5
  ZOOM_PAISES: {
    '724': 6.7,                 // 6.7 - España
    '170': 6.5,                 // 6.5 - Colombia
    // Zoom para otros posibles paises (México, Portugal y Francia)
    // '484': 6.0,              // 6.0 - México
    // '620': 6.7,              // 6.7 - Portugal
    // '250': 6.6,              // 6.6 - Francia

  },
  NOTIFICATIONS: {
    RECENT_THRESHOLD_MS: 120000,// 120000 ms | 2 minutos
    LOOP_BUFFER_SIZE: 10        // 10
  },
  SOUNDS: {
    VOLUME: 0.5,                // 0.5 (Volumen general de 0.0 a 1.0)
    TYPES: {
      // Configuración de síntesis: [Frecuencia(Hz), Tipo de onda, Duración(SEGUNDOS)]
      // Ondas: 'sine', 'square', 'sawtooth', 'triangle'
      ROJO:    { freq: 150, type: 'sawtooth', duration: 0.5 }, // Grave y áspero (Alerta)
      NARANJA: { freq: 880, type: 'sine',     duration: 0.5 }  // Agudo y limpio (Notificación)
    }
  }

};

/**
 * Configuración de regiones lejanas por país para el mapa secundario (inset).
 * @example '724': { center: [28.4, -16.0], zoom: 6.3, label: "Canarias" }
 * @type {Object}
 */
export const INSET_VIEWS = {
  '724': { center: [28.4, -16.0], zoom: 6.3, label: "Canarias" },
  // Coordenadas de otras posibles islas (Portugal y Francia)
  // '620': { center: [32.7, -17.0], zoom: 7.0, label: "Madeira / Azores" },
  // '250': { center: [14.6, -61.0], zoom: 7.0, label: "Antillas" },
};


/**
 * URLs y atribuciones para los mapas base y de líneas de terreno.
 * @property {String} MAP_TILES - URL de los tiles para el mapa base.
 * @property {String} TERRAIN_LINES - URL de los tiles para las líneas de terreno entre provincias.
 * @property {String} ATTRIBUTION - HTML con las atribuciones necesarias para el uso de los mapas.
 */
export const MAPAS = {
    MAP_TILES: "https://tiles.stadiamaps.com/tiles/stamen_terrain_background/{z}/{x}/{y}{r}.{ext}",   // "https://tiles.stadiamaps.com/tiles/stamen_terrain_background/{z}/{x}/{y}{r}.{ext}"
    TERRAIN_LINES: "https://tiles.stadiamaps.com/tiles/stamen_terrain_lines/{z}/{x}/{y}{r}.{ext}",    // "https://tiles.stadiamaps.com/tiles/stamen_terrain_lines/{z}/{x}/{y}{r}.{ext}"
    ATTRIBUTION: '&copy; <a href="https://www.sicolares.com/" target="_blank">SicoLares</a> &copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}