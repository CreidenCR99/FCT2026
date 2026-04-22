/**
 * Módulo: config.js
 * Configuración centralizada de la aplicación SicoLares.
 */
export const CONFIG = {
    // URL base de la API
    API_ENDPOINT: 'api/main.php',
    
    // Intervalo de refresco automático (milisegundos)
    REFRESH_INTERVAL_MS: 7500,
    
    // Tiempo de espera para búsqueda y resize (debounce en milisegundos)
    DEBOUNCE_MS: 250,
    RESIZE_DEBOUNCE_MS: 200,
    
    // Umbral de tiempo para considerar una máquina fuera de línea (minutos)
    OFFLINE_THRESHOLD_MINUTES: 10,
    
    // Configuración del Modo Presentación
    PRESENTATION: {
        DEFAULT_MAX_LINES: 20,
        MIN_LINES_LIMIT: 24,
        ERRORS_PER_PAGE: 8,
        SAFETY_MARGIN_PX: 30
    },
    
    // Configuración de la Interfaz de Usuario (UI)
    UI: {
        TABLE_ANIMATION_LIMIT: 50,
        TABLE_ANIMATION_DELAY_STEP: 0.03,
        BACK_TO_TOP_THRESHOLD_PX: 200
    }
};