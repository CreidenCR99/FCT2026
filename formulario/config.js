/**
 * Módulo: config.js
 * Configuración centralizada de la aplicación SicoLares.
 */

/**
 * Constantes de configuración global, tiempos de refresco y parámetros de UI.
 * @property {String} API_ENDPOINT - URL base para las peticiones a la API.
 * @property {Number} REFRESH_INTERVAL_MS - Intervalo de refresco automático de datos en milisegundos.
 * @property {Number} OFFLINE_THRESHOLD_MINUTES - Minutos de inactividad para marcar una máquina como "Sin respuesta".
 * @property {Number} DEBOUNCE_MS - Tiempo de espera para la ejecución de búsquedas (debounce).
 * @property {Number} RESIZE_DEBOUNCE_MS - Tiempo de espera para el recalculo tras redimensionar la ventana.
 * @property {Object} PRESENTATION - Parámetros específicos del Modo Presentación (Pantalla Completa).
 *      @property {Number} DEFAULT_MAX_LINES - Número de líneas por defecto si falla el cálculo dinámico.
 *      @property {Number} MIN_LINES_LIMIT - Límite mínimo de líneas a renderizar por seguridad.
 *      @property {Number} ERRORS_PER_PAGE - Cantidad de errores a mostrar en el footer rotativo.
 *      @property {Number} SAFETY_MARGIN_PX - Margen de seguridad en píxeles para el cálculo de altura disponible.
 * @property {Object} UI - Configuración de comportamientos de la interfaz de usuario.
 *      @property {Number} TABLE_ANIMATION_LIMIT - Máximo de filas que ejecutan animación de entrada en cascada.
 *      @property {Number} TABLE_ANIMATION_DELAY_STEP - Incremento de retraso (s) entre filas en la animación inicial.
 *      @property {Number} BACK_TO_TOP_THRESHOLD_PX - Desplazamiento de scroll necesario para mostrar el botón de subida.
 * @property {Object} KPI_ANIMATION - Parámetros para las transiciones numéricas de las tarjetas de indicadores.
 *      @property {Number} BASE_DURATION_SMALL_DELTA - Duración base para cambios de valor mínimos.
 *      @property {Number} MAX_DURATION - Tope máximo de tiempo para una animación de conteo.
 *      @property {Number} BASE_DURATION_LARGE_DELTA - Tiempo base para cambios de valor significativos.
 *      @property {Number} DELTA_CALC_FACTOR - Factor de escala para ajustar la velocidad según la diferencia de valores.
 *      @example Con los valores predefinidos:
 *              - 10   máquinas: ~1500ms
 *              - 50   máquinas: ~2800ms
 *              - 100  máquinas: ~3100ms
 *              - +250 máquinas:  4000ms (Max)
 */
export const CONFIG = {
    API_ENDPOINT: 'api/main.php',           // 'api/main.php' (URL base de la API)

    REFRESH_INTERVAL_MS: 7500,              // 7500 ms | 7.5 segundos
    OFFLINE_THRESHOLD_MINUTES: 10,          // 10 minutos

    DEBOUNCE_MS: 250,                       // 250 ms
    RESIZE_DEBOUNCE_MS: 200,                // 200 ms

    PRESENTATION: {
        DEFAULT_MAX_LINES: 20,              // 20 líneas
        MIN_LINES_LIMIT: 24,                // 24 líneas
        ERRORS_PER_PAGE: 8,                 // 8 errores
        SAFETY_MARGIN_PX: 30                // 30 px
    },

    UI: {
        TABLE_ANIMATION_LIMIT: 50,          // 50 filas
        TABLE_ANIMATION_DELAY_STEP: 0.03,   // 0.03 segundos
        BACK_TO_TOP_THRESHOLD_PX: 200,      // 200 px
    },

    KPI_ANIMATION: {
        BASE_DURATION_SMALL_DELTA: 1000,    // 1000 ms
        MAX_DURATION: 4000,                 // 4000 ms
        BASE_DURATION_LARGE_DELTA: 2500,    // 2500 ms
        DELTA_CALC_FACTOR: 250,             // 250 maquinas para la duracion máxima
    }
};