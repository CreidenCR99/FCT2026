<?php
/**
 * @module config.js.php
 * @description Generador dinámico de configuración para JavaScript.
 * Este script actúa como un puente entre la configuración del servidor (definida en archivos .ini)
 * y las aplicaciones frontend. Procesa los datos obtenidos de `core/config.php` y los exporta
 * como constantes ES6.
 */
header('Content-Type: application/javascript; charset=UTF-8');
require_once __DIR__ . '/config.php';

$config = get_central_config();

// Mapear los datos del .ini al formato esperado por las apps JS
// Se definen valores por defecto en caso de que no existan en el archivo de configuración global.
$jsConfig = [
    // --- Configuración Común ---
    // API_ENDPOINT: Ruta relativa o absoluta hacia el controlador principal de datos.
    // REFRESH_INTERVAL_MS: Tiempo de espera entre peticiones de actualización.
    // OFFLINE_THRESHOLD_MINUTES: Tiempo de espera para considerar una máquina como desconectada.
    'API_ENDPOINT'              => $config['common']['api_endpoint'] ?? 'api/main.php',
    'REFRESH_INTERVAL_MS'       => (int)($config['common']['refresh_interval_ms'] ?? 7500),
    'OFFLINE_THRESHOLD_MINUTES' => (int)($config['common']['offline_threshold_minutes'] ?? 10),
    
    // Mapa específicos
    'MS_ROTACION_DEFAULT'       => (int)($config['mapa']['ms_rotacion_default'] ?? 300000),
    'MS_ROTACION_PAISES'        => $config['mapa']['ms_rotacion_paises'] ?? [],
    'VELOCIDAD_CARRUSEL'        => (int)($config['mapa']['velocidad_carrusel'] ?? 20000),
    'INACTIVO'                  => (int)($config['mapa']['inactivo'] ?? 30000),
    'FILTRO_HORARIO' => [
        'MODO'    => $config['mapa']['filtro_horario_modo'] ?? 'auto',
        'MAÑANA'   => (int)($config['mapa']['filtro_horario_mañana'] ?? 6),
        'MEDIODIA' => (int)($config['mapa']['filtro_horario_mediodia'] ?? 10),
        'TARDE'    => (int)($config['mapa']['filtro_horario_tarde'] ?? 18),
        'NOCHE'    => (int)($config['mapa']['filtro_horario_noche'] ?? 21)
    ],
    'ZOOM_DEFAULT'              => (float)($config['mapa']['zoom_default'] ?? 6.5),
    'ZOOM_PAISES'               => $config['mapa']['zoom_paises'] ?? [],
    'NOTIFICATIONS' => [
        'RECENT_THRESHOLD_MS'   => (int)($config['mapa']['recent_threshold_ms'] ?? 120000),
        'LOOP_BUFFER_SIZE'      => (int)($config['mapa']['loop_buffer_size'] ?? 10)
    ],
    'SOUNDS' => [
        'VOLUME' => (float)($config['mapa']['sounds_volume'] ?? 0.5),
        'TYPES'  => [
            'ROJO'    => $config['mapa']['sounds_rojo'] ?? [],
            'NARANJA' => $config['mapa']['sounds_naranja'] ?? []
        ]
    ],

    // Formulario específicos
    'DEBOUNCE_MS'               => (int)($config['formulario']['debounce_ms'] ?? 250),
    'RESIZE_DEBOUNCE_MS'        => (int)($config['formulario']['resize_debounce_ms'] ?? 200),
    'PRESENTATION' => [
        'DEFAULT_MAX_LINES'     => (int)($config['formulario']['presentation_default_max_lines'] ?? 20),
        'MIN_LINES_LIMIT'       => (int)($config['formulario']['presentation_min_lines_limit'] ?? 24),
        'ERRORS_PER_PAGE'       => (int)($config['formulario']['presentation_errors_per_page'] ?? 8),
        'SAFETY_MARGIN_PX'      => (int)($config['formulario']['presentation_safety_margin_px'] ?? 30)
    ],
    'UI' => [
        'TABLE_ANIMATION_LIMIT'      => (int)($config['formulario']['ui_table_animation_limit'] ?? 50),
        'TABLE_ANIMATION_DELAY_STEP' => (float)($config['formulario']['ui_table_animation_delay_step'] ?? 0.03),
        'BACK_TO_TOP_THRESHOLD_PX'   => (int)($config['formulario']['ui_back_to_top_threshold_px'] ?? 200)
    ],
    'KPI_ANIMATION' => [
        'BASE_DURATION_SMALL_DELTA'  => (int)($config['formulario']['kpi_base_duration_small_delta'] ?? 1000),
        'MAX_DURATION'               => (int)($config['formulario']['kpi_max_duration'] ?? 4000),
        'BASE_DURATION_LARGE_DELTA'  => (int)($config['formulario']['kpi_base_duration_large_delta'] ?? 2500),
        'DELTA_CALC_FACTOR'          => (int)($config['formulario']['kpi_delta_calc_factor'] ?? 250)
    ]
];

$insetViews = $config['mapa']['inset_views'] ?? [];
$mapas = [
    'MAP_TILES'     => $config['mapa']['map_tiles'] ?? '',
    'TERRAIN_LINES' => $config['mapa']['terrain_lines'] ?? '',
    'ATTRIBUTION'   => $config['mapa']['attribution'] ?? ''
];

echo "export const CONFIG = " . json_encode($jsConfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . ";\n";
echo "export const INSET_VIEWS = " . json_encode($insetViews, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . ";\n";
echo "export const MAPAS = " . json_encode($mapas, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . ";\n";
?>
