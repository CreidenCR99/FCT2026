<?php
/**
 * SicoLares API - Lógica de Máquinas
 */

if ($modo === "organismos") {
    $sql = "SELECT DISTINCT o.Nombre AS Organismo FROM Maquinas m LEFT JOIN Organismos o ON o.Codigo = m.Organismo WHERE o.Nombre IS NOT NULL ORDER BY o.Nombre";
    $stmt = sqlsrv_query($conn, $sql);
    if ($stmt === false) { log_sql_error("Error organismos", $sql); http_response_code(500); echo json_encode(["error" => sqlsrv_errors()]); exit(); }
    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) $data[] = $row;
    sqlsrv_free_stmt($stmt);
    responder_json_si_cambia($data, $conn);
}

if ($modo === "provincias") {
    $organismo = trim($_GET["organismo"] ?? "");
    $sql = "SELECT DISTINCT p.Nombre AS Provincia FROM Maquinas m LEFT JOIN Provincias p ON p.Codigo = m.Provincia LEFT JOIN Organismos o ON o.Codigo = m.Organismo WHERE p.Nombre IS NOT NULL AND (? = '' OR o.Nombre = ?) ORDER BY p.Nombre";
    $params = [$organismo, $organismo];
    $stmt = sqlsrv_query($conn, $sql, $params);
    if ($stmt === false) { log_sql_error("Error provincias", $sql, $params); http_response_code(500); echo json_encode(["error" => sqlsrv_errors()]); exit(); }
    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) $data[] = $row;
    sqlsrv_free_stmt($stmt);
    responder_json_si_cambia($data, $conn);
}

if ($modo === "maquinas") {
    $organismo = trim($_GET["organismo"] ?? "");
    $provincia = trim($_GET["provincia"] ?? "");
    $sqlMachines = "SELECT o.Nombre AS Organismo, p.Nombre AS Provincia, ISNULL(c.Nombre, 'error') AS Cliente, m.Descripcion, m.UltimoControl, m.MonitorizarEstado, m.MonitorizarAlertas, m.NumeroSerie, m.TipoMaquina FROM Maquinas m LEFT JOIN Organismos o ON o.Codigo = m.Organismo LEFT JOIN Provincias p ON p.Codigo = m.Provincia LEFT JOIN Clientes c ON c.Codigo = m.Cliente WHERE (? = '' OR o.Nombre = ? OR (o.Nombre IS NULL AND ? = '')) AND (? = '' OR p.Nombre = ? OR (p.Nombre IS NULL AND ? = '')) ORDER BY o.Nombre, p.Nombre, c.Nombre, m.Descripcion";
    $params = [$organismo, $organismo, $organismo, $provincia, $provincia, $provincia];
    $stmt = sqlsrv_query($conn, $sqlMachines, $params);
    if ($stmt === false) { log_sql_error("Error máquinas", $sqlMachines, $params); http_response_code(500); echo json_encode(["error" => sqlsrv_errors()]); exit(); }
    $machines = [];
    $numeroSeries = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) { $machines[] = $row; $numeroSeries[] = $row["NumeroSerie"]; }
    sqlsrv_free_stmt($stmt);
    
    $logsByNS = [];
    if (!empty($numeroSeries)) {
        $sqlLogs = "SELECT le.Id as ID, le.NumeroSerie as Numero_Serie, le.TipoMaquina, le.TimeStamp, le.CodigoError, le.Activo, le.Observaciones, e.Descripcion as Mensaje FROM Log_Errores le INNER JOIN Maquinas m ON m.NumeroSerie = le.NumeroSerie LEFT JOIN Organismos o ON o.Codigo = m.Organismo LEFT JOIN Provincias p ON p.Codigo = m.Provincia LEFT JOIN Errores e ON le.CodigoError = e.Codigo WHERE le.Activo = 1 AND (? = '' OR o.Nombre = ? OR (o.Nombre IS NULL AND ? = '')) AND (? = '' OR p.Nombre = ? OR (p.Nombre IS NULL AND ? = '')) ORDER BY le.NumeroSerie, le.Id DESC";
        $stmtLogs = sqlsrv_query($conn, $sqlLogs, $params);
        if ($stmtLogs !== false) {
            while ($logRow = sqlsrv_fetch_array($stmtLogs, SQLSRV_FETCH_ASSOC)) { $ns = $logRow["Numero_Serie"]; unset($logRow["Numero_Serie"]); if (!isset($logsByNS[$ns])) $logsByNS[$ns] = []; $logsByNS[$ns][] = $logRow; }
            sqlsrv_free_stmt($stmtLogs);
        }
    }
    foreach ($machines as &$m) $m["Logs"] = $logsByNS[$m["NumeroSerie"]] ?? [];
    
    $cols = ["Organismo", "Provincia", "Cliente", "Descripcion", "UltimoControl", "MonitorizarEstado", "MonitorizarAlertas", "NumeroSerie", "TipoMaquina", "Logs"];
    $rows = [];
    foreach ($machines as $m) {
        $row = [];
        foreach ($cols as $c) { $val = $m[$c] ?? ($c === "Logs" ? [] : null); if ($c === "MonitorizarEstado" || $c === "MonitorizarAlertas") $val = (int)$val; $row[] = $val; }
        $rows[] = $row;
    }
    responder_json_si_cambia(["cols" => $cols, "rows" => $rows], $conn);
}

if ($modo === "maquinas_navegacion") {
    $sql = "SELECT m.NumeroSerie AS Codigo, m.Descripcion, m.TipoMaquina, m.Notas, m.Organismo, m.Cliente, m.Provincia, m.MonitorizarEstado, m.MonitorizarAlertas, m.Actualizar FROM Maquinas m LEFT JOIN Organismos o ON o.Codigo = m.Organismo LEFT JOIN Provincias p ON p.Codigo = m.Provincia LEFT JOIN Clientes c ON c.Codigo = m.Cliente ORDER BY o.Nombre, p.Nombre, c.Nombre, m.Descripcion";
    $stmt = sqlsrv_query($conn, $sql);
    if ($stmt === false) { log_sql_error("Error navegación máquinas", $sql); http_response_code(500); echo json_encode(["error" => sqlsrv_errors()]); exit(); }
    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) $data[] = $row;
    sqlsrv_free_stmt($stmt);
    responder_json_si_cambia($data, $conn);
}

if ($modo === "verificar_ns") {
    $ns = $_GET["ns"] ?? "";
    $sql = "SELECT COUNT(*) as cuenta FROM Maquinas WHERE NumeroSerie = ?";
    $stmt = sqlsrv_query($conn, $sql, [$ns]);
    if ($stmt === false) { log_sql_error("Error verificar_ns", $sql, [$ns]); http_response_code(500); echo json_encode(["error" => sqlsrv_errors()]); exit(); }
    $row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC);
    echo json_encode(["exists" => $row["cuenta"] > 0]);
    sqlsrv_close($conn);
    exit();
}

if ($modo === "crear_maquina") {
    $ns = $_POST["ns"] ?? ""; $desc = $_POST["descripcion"] ?? ""; $tipo = $_POST["tipo"] ?? ""; $notas = $_POST["notas"] ?? ""; $org = $_POST["organismo"] ?? ""; $cli = $_POST["cliente"] ?? ""; $prov = $_POST["provincia"] ?? "";
    if (empty($ns)) { http_response_code(400); echo json_encode(["error" => "El número de serie es obligatorio"]); exit(); }
    
    $tablas_maestras = [["tabla" => "Organismos", "codigo" => $org, "label" => "Organismo"], ["tabla" => "Clientes", "codigo" => $cli, "label" => "Cliente"], ["tabla" => "Provincias", "codigo" => $prov, "label" => "Provincia"]];
    foreach ($tablas_maestras as $maestra) {
        $sqlCheck = "SELECT COUNT(*) as cuenta FROM " . $maestra["tabla"] . " WHERE codigo = ?";
        $stmtCheck = sqlsrv_query($conn, $sqlCheck, [$maestra["codigo"]]);
        $rowCheck = sqlsrv_fetch_array($stmtCheck, SQLSRV_FETCH_ASSOC);
        if ($rowCheck["cuenta"] == 0) { http_response_code(400); echo json_encode(["error" => "El código de " . $maestra["label"] . " no existe."]); exit(); }
    }
    
    $actualizar = isset($_POST["actualizar"]) ? 1 : 0; $monEstado = isset($_POST["mon_estado"]) ? 1 : 0; $monAlerta = isset($_POST["mon_alertas"]) ? 1 : 0;
    $sql = "IF EXISTS (SELECT 1 FROM Maquinas WHERE NumeroSerie = ?) UPDATE Maquinas SET Descripcion=?, TipoMaquina=?, Notas=?, Organismo=?, Cliente=?, Provincia=?, Actualizar=?, MonitorizarEstado=?, MonitorizarAlertas=? WHERE NumeroSerie=? ELSE INSERT INTO Maquinas (NumeroSerie, Descripcion, TipoMaquina, Notas, Organismo, Cliente, Provincia, Actualizar, UltimoControl, MonitorizarEstado, MonitorizarAlertas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)";
    $params = [$ns, $desc, $tipo, $notas, $org, $cli, $prov, $actualizar, $monEstado, $monAlerta, $ns, $ns, $desc, $tipo, $notas, $org, $cli, $prov, $actualizar, $monEstado, $monAlerta];
    $stmt = sqlsrv_query($conn, $sql, $params);
    if ($stmt === false) { log_sql_error("Error crear máquina", $sql, $params); http_response_code(500); echo json_encode(["error" => sqlsrv_errors()]); exit(); }
    echo json_encode(["success" => true]);
    sqlsrv_close($conn); exit();
}

if ($modo === "eliminar_maquina") {
    $ns = $_POST["ns"] ?? "";
    if (empty($ns)) { http_response_code(400); echo json_encode(["error" => "No se ha proporcionado el número de serie"]); exit(); }
    $sql = "DELETE FROM Maquinas WHERE NumeroSerie = ?";
    $stmt = sqlsrv_query($conn, $sql, [$ns]);
    if ($stmt === false) { log_sql_error("Error eliminar máquina", $sql, [$ns]); http_response_code(500); echo json_encode(["error" => sqlsrv_errors()]); exit(); }
    echo json_encode(["success" => true]);
    sqlsrv_close($conn); exit();
}
?>