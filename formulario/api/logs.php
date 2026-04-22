<?php
/**
 * SicoLares API - Lógica de Logs e Incidencias
 */

if ($modo === "crear_log") {
    $ns = $_POST["numero_serie"] ?? ""; $codigo_error = $_POST["codigo_error"] ?? ""; $tipo = $_POST["tipo_maquina"] ?? ""; $resultado = $_POST["resultado"] ?? ""; $observaciones = $_POST["observaciones"] ?? ""; $fecha = $_POST["fecha"] ?? ""; $hora = $_POST["hora"] ?? "";
    if (empty($ns) || empty($codigo_error) || empty($fecha) || empty($hora)) { http_response_code(400); echo json_encode(["error" => "Faltan campos obligatorios"]); exit(); }
    
    $activo = $resultado == "0" ? 1 : 0;
    $timestamp = str_replace("-", "", $fecha) . str_replace(":", "", $hora) . "00";
    $sql = "INSERT INTO Log_Errores (NumeroSerie, TipoMaquina, TimeStamp, CodigoError, Activo, Observaciones) VALUES (?, ?, ?, ?, ?, ?)";
    $params = [$ns, $tipo, $timestamp, $codigo_error, $activo, $observaciones];
    $stmt = sqlsrv_query($conn, $sql, $params);
    if ($stmt === false) { log_sql_error("Error crear log", $sql, $params); http_response_code(500); echo json_encode(["error" => sqlsrv_errors()]); exit(); }
    echo json_encode(["success" => true]);
    sqlsrv_close($conn); exit();
}

if ($modo === "actualizar_log") {
    $id = $_POST["id_log"] ?? ""; $resultado = $_POST["resultado"] ?? ""; $observaciones = $_POST["observaciones"] ?? "";
    if (empty($id)) { http_response_code(400); echo json_encode(["error" => "ID de log no proporcionado"]); exit(); }
    
    $activo = $resultado == "0" ? 1 : 0;
    $sql = "UPDATE Log_Errores SET Activo = ?, Observaciones = ? WHERE Id = ?";
    $params = [$activo, $observaciones, $id];
    $stmt = sqlsrv_query($conn, $sql, $params);
    if ($stmt === false) { log_sql_error("Error actualizar log", $sql, $params); http_response_code(500); echo json_encode(["error" => sqlsrv_errors()]); exit(); }
    echo json_encode(["success" => true]);
    sqlsrv_close($conn); exit();
}

if ($modo === "registrar_log_errores") {
    $ns = $_POST["ns"] ?? ""; $tipo = $_POST["tipo"] ?? null; $codigoErr = $_POST["codigo_error"] ?? ""; $activo = isset($_POST["activo"]) ? 1 : 0; $obs = $_POST["observaciones"] ?? null; $ts = date("YmdHis");
    $sql = "INSERT INTO Log_Errores (NumeroSerie, TipoMaquina, TimeStamp, CodigoError, Activo, Observaciones) VALUES (?, ?, ?, ?, ?, ?)";
    $params = [$ns, $tipo, $ts, $codigoErr, $activo, $obs];
    $stmt = sqlsrv_query($conn, $sql, $params);
    echo json_encode(["success" => $stmt !== false]);
    sqlsrv_close($conn); exit();
}
?>