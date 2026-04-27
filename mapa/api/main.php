<?php
/**
 * @file main.php
 * @description Controlador frontal (Router) para la API del Mapa.
 * Canaliza las peticiones hacia el módulo de procesamiento geográfico geo.php.
 */
require_once __DIR__ . "/../../core/bootstrap.php";

$modo = trim($_GET["modo"] ?? "");

switch ($modo) {
    case "paises":
    case "mapa_data":
        require_once __DIR__ . "/geo.php";
        break;

    default:
        http_response_code(404);
        echo json_encode(["error" => "Modo no reconocido"]);
        break;
}
?>