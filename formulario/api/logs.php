<?php
/**
 * @file logs.php
 * @description Lógica de negocio para la gestión de logs e incidencias.
 * Permite el registro de nuevos errores, la actualización de estados de reparación
 * y la generación de reportes históricos de 24 horas para exportación.
 */

/**
 * MODO: crear_log
 * Crea un nuevo registro de log/incidencia para una máquina.
 */
if ($modo === "crear_log") {
    $ns = $_POST["numero_serie"] ?? "";
    $codigo_error = $_POST["codigo_error"] ?? "";
    $tipo = $_POST["tipo_maquina"] ?? "";
    $resultado = $_POST["resultado"] ?? "";
    $observaciones = $_POST["observaciones"] ?? "";
    $fecha = $_POST["fecha"] ?? "";
    $hora = $_POST["hora"] ?? "";
    
    if (empty($ns) || empty($codigo_error) || empty($fecha) || empty($hora)) {
        http_response_code(400);
        echo json_encode(["error" => "Faltan campos obligatorios"]);
        exit();
    }
    
    $activo = $resultado == "0" ? 1 : 0;
    $timestamp = str_replace("-", "", $fecha) . str_replace(":", "", $hora) . "00";
    
    $sql = "INSERT INTO Log_Errores (NumeroSerie, TipoMaquina, TimeStamp, CodigoError, Activo, Observaciones) VALUES (?, ?, ?, ?, ?, ?)";
    $params = [$ns, $tipo, $timestamp, $codigo_error, $activo, $observaciones];
    
    $stmt = sqlsrv_query($conn, $sql, $params);
    if ($stmt === false) {
        log_sql_error("Error crear log", $sql, $params);
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit();
    }
    
    echo json_encode(["success" => true]);
    sqlsrv_close($conn);
    exit();
}

/**
 * MODO: actualizar_log
 * Actualiza el estado (activo/inactivo) y las observaciones de un log existente.
 */
if ($modo === "actualizar_log") {
    $id = $_POST["id_log"] ?? "";
    $resultado = $_POST["resultado"] ?? "";
    $observaciones = $_POST["observaciones"] ?? "";
    
    if (empty($id)) {
        http_response_code(400);
        echo json_encode(["error" => "ID de log no proporcionado"]);
        exit();
    }
    
    $activo = $resultado == "0" ? 1 : 0;
    
    $sql = "UPDATE Log_Errores SET Activo = ?, Observaciones = ? WHERE Id = ?";
    $params = [$activo, $observaciones, $id];
    
    $stmt = sqlsrv_query($conn, $sql, $params);
    if ($stmt === false) {
        log_sql_error("Error actualizar log", $sql, $params);
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit();
    }
    
    echo json_encode(["success" => true]);
    sqlsrv_close($conn);
    exit();
}

/**
 * MODO: registrar_log_errores
 * Endpoint simplificado para registrar un error activo de manera rápida.
 */
if ($modo === "registrar_log_errores") {
    $ns = $_POST["ns"] ?? "";
    $tipo = $_POST["tipo"] ?? null;
    $codigoErr = $_POST["codigo_error"] ?? "";
    $activo = isset($_POST["activo"]) ? 1 : 0;
    $obs = $_POST["observaciones"] ?? null;
    $ts = date("YmdHis");
    
    $sql = "INSERT INTO Log_Errores (NumeroSerie, TipoMaquina, TimeStamp, CodigoError, Activo, Observaciones) VALUES (?, ?, ?, ?, ?, ?)";
    $params = [$ns, $tipo, $ts, $codigoErr, $activo, $obs];
    
    $stmt = sqlsrv_query($conn, $sql, $params);
    echo json_encode(["success" => $stmt !== false]);
    sqlsrv_close($conn);
    exit();
}

/**
 * MODO: exportar_errores_24h
 * Recupera todos los errores ocurridos en las últimas 24 horas para exportación CSV.
 * Incluye tanto errores activos como corregidos.
 */
if ($modo === "exportar_errores_24h") {
    $h24ago = date("YmdHis", time() - 86400);
    $sql = "
        SELECT 
            le.TimeStamp, 
            m.NumeroSerie, 
            m.Descripcion as Maquina, 
            o.Nombre as Organismo, 
            p.Nombre as Provincia, 
            c.Nombre as Cliente,
            e.Descripcion as Error, 
            le.Activo, 
            le.Observaciones
        FROM Log_Errores le 
        INNER JOIN Maquinas m ON m.NumeroSerie = le.NumeroSerie 
        LEFT JOIN Organismos o ON o.Codigo = m.Organismo 
        LEFT JOIN Provincias p ON p.Codigo = m.Provincia 
        LEFT JOIN Paises pa ON pa.Codigo = p.Pais 
        LEFT JOIN Clientes c ON c.Codigo = m.Cliente
        LEFT JOIN Errores e ON le.CodigoError = e.Codigo 
        WHERE le.TimeStamp >= ? 
        ORDER BY le.TimeStamp DESC
    ";
    
    $stmt = sqlsrv_query($conn, $sql, [$h24ago]);
    if ($stmt === false) {
        log_sql_error("Error exportar 24h", $sql, [$h24ago]);
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit();
    }
    
    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = $row;
    }
    sqlsrv_free_stmt($stmt);
    echo json_encode($data);
    sqlsrv_close($conn);
    exit();
}
?>