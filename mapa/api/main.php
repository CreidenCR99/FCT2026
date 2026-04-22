<?php
/**
 * SicoLares Mapa API - Entry Point
 */
require_once __DIR__ . "/bootstrap.php";

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