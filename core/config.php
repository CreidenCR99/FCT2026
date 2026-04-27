<?php
/**
 * @file config.php
 * @description Utilidad para la gestión de la configuración centralizada.
 * Lee el archivo config.ini de la raíz y procesa los campos complejos (JSON) 
 * para transformarlos en estructuras de datos nativas de PHP.
 */

/**
 * Lee y parsea el archivo de configuración centralizado.
 * Realiza una limpieza de los campos JSON (sustituyendo comillas simples por dobles)
 * antes de la decodificación para asegurar la compatibilidad con json_decode.
 * 
 * @return array Configuración estructurada.
 */
function get_central_config() {
    $iniPath = __DIR__ . '/../config.ini';
    if (!file_exists($iniPath)) {
        return [];
    }

    $config = parse_ini_file($iniPath, true);

    // Procesar campos que son JSON strings para convertirlos en arrays de PHP
    if (isset($config['mapa'])) {
        $jsonFields = [
            'ms_rotacion_paises', 
            'zoom_paises', 
            'sounds_rojo', 
            'sounds_naranja', 
            'inset_views'
        ];
        foreach ($jsonFields as $field) {
            if (isset($config['mapa'][$field])) {
                $config['mapa'][$field] = json_decode(str_replace("'", '"', $config['mapa'][$field]), true);
            }
        }
    }

    return $config;
}
?>
