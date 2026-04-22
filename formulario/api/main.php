<?php
/**
 * SicoLares API - Entry Point
 */
require_once __DIR__ . "/bootstrap.php";

// Limpiamos el modo de posibles espacios o saltos de línea accidentales
$modo = trim($_GET["modo"] ?? "");

switch ($modo) {
    // --- MÁQUINAS ---
    case "organismos":
    case "provincias":
    case "maquinas":
    case "maquinas_navegacion":
    case "verificar_ns":
    case "crear_maquina":
    case "eliminar_maquina":
        require_once __DIR__ . "/machines.php";
        break;

    // --- LOGS ---
    case "crear_log":
    case "actualizar_log":
    case "registrar_log_errores":
        require_once __DIR__ . "/logs.php";
        break;

    // --- MAESTROS ---
    case "maestro":
    case "get_nombre":
    case "errores":
    case "guardar_maestro":
    case "eliminar_maestro":
    case "get_maestro_detalle":
    case "maquinas_search":
        require_once __DIR__ . "/masters.php";
        break;

    default:
        http_response_code(404);
        echo json_encode(["error" => "Modo no reconocido"]);
        break;
}
