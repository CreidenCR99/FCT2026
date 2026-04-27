<?php
/**
 * @file machines.php
 * @description Lógica central para la gestión del parque de máquinas.
 * Proporciona listados filtrados, gestión de inventario (UPSERT) y vinculación 
 * de máquinas con sus respectivos logs de error activos.
 */

/**
 * MODO: paises
 * Obtiene la lista única de países que tienen máquinas registradas.
 * Se utiliza para poblar el primer nivel de filtros en el frontend.
 */
if ($modo === "paises") {
    $sql = "
        SELECT DISTINCT pa.Nombre AS Pais 
        FROM Maquinas m 
        LEFT JOIN Provincias p ON p.Codigo = m.Provincia 
        LEFT JOIN Paises pa ON pa.Codigo = p.Pais 
        WHERE pa.Nombre IS NOT NULL 
        ORDER BY pa.Nombre
    ";
    
    $stmt = sqlsrv_query($conn, $sql);
    if ($stmt === false) {
        log_sql_error("Error paises", $sql);
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit();
    }
    
    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = $row;
    }
    sqlsrv_free_stmt($stmt);
    responder_json_si_cambia($data, $conn);
}

/**
 * MODO: organismos
 * Obtiene organismos únicos, permitiendo filtrar por país (filtrado cruzado).
 * Si el parámetro 'pais' está vacío, devuelve todos los organismos con máquinas.
 */
if ($modo === "organismos") {
    $pais = trim($_GET["pais"] ?? "");
    $sql = "
        SELECT DISTINCT o.Nombre AS Organismo 
        FROM Maquinas m 
        LEFT JOIN Organismos o ON o.Codigo = m.Organismo 
        LEFT JOIN Provincias p ON p.Codigo = m.Provincia 
        LEFT JOIN Paises pa ON pa.Codigo = p.Pais 
        WHERE o.Nombre IS NOT NULL 
        AND (? = '' OR pa.Nombre = ?) 
        ORDER BY o.Nombre
    ";
    $params = [$pais, $pais];
    
    $stmt = sqlsrv_query($conn, $sql, $params);
    if ($stmt === false) {
        log_sql_error("Error organismos", $sql, $params);
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit();
    }
    
    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = $row;
    }
    sqlsrv_free_stmt($stmt);
    responder_json_si_cambia($data, $conn);
}

/**
 * MODO: provincias
 * Obtiene provincias únicas filtradas por organismo y país.
 * Esto asegura que el usuario solo vea provincias donde el organismo seleccionado opera en dicho país.
 */
if ($modo === "provincias") {
    $organismo = trim($_GET["organismo"] ?? "");
    $pais = trim($_GET["pais"] ?? "");
    $sql = "
        SELECT DISTINCT p.Nombre AS Provincia 
        FROM Maquinas m 
        LEFT JOIN Provincias p ON p.Codigo = m.Provincia 
        LEFT JOIN Organismos o ON o.Codigo = m.Organismo 
        LEFT JOIN Paises pa ON pa.Codigo = p.Pais 
        WHERE p.Nombre IS NOT NULL 
        AND (? = '' OR o.Nombre = ?) 
        AND (? = '' OR pa.Nombre = ?) 
        ORDER BY p.Nombre
    ";
    $params = [$organismo, $organismo, $pais, $pais];
    
    $stmt = sqlsrv_query($conn, $sql, $params);
    if ($stmt === false) {
        log_sql_error("Error provincias", $sql, $params);
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit();
    }
    
    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = $row;
    }
    sqlsrv_free_stmt($stmt);
    responder_json_si_cambia($data, $conn);
}

/**
 * MODO: maquinas
 * Endpoint principal para el listado de máquinas y sus logs de error activos.
 * Aplica filtros de País, Organismo y Provincia de forma jerárquica.
 */
if ($modo === "maquinas") {
    $pais = trim($_GET["pais"] ?? "");
    $organismo = trim($_GET["organismo"] ?? "");
    $provincia = trim($_GET["provincia"] ?? "");
    
    // Consulta principal de máquinas con sus relaciones geográficas y de cliente
    $sqlMachines = "
        SELECT 
            o.Nombre AS Organismo, m.Organismo AS CodOrganismo,
            p.Nombre AS Provincia, m.Provincia AS CodProvincia, 
            ISNULL(c.Nombre, 'error') AS Cliente, m.Cliente AS CodCliente,
            m.Descripcion, m.UltimoControl, m.MonitorizarEstado, m.MonitorizarAlertas, 
            m.NumeroSerie, m.TipoMaquina 
        FROM Maquinas m 
        LEFT JOIN Organismos o ON o.Codigo = m.Organismo 
        LEFT JOIN Provincias p ON p.Codigo = m.Provincia 
        LEFT JOIN Paises pa ON pa.Codigo = p.Pais 
        LEFT JOIN Clientes c ON c.Codigo = m.Cliente 
        WHERE (? = '' OR pa.Nombre = ? OR (pa.Nombre IS NULL AND ? = '')) 
        AND (? = '' OR o.Nombre = ? OR (o.Nombre IS NULL AND ? = '')) 
        AND (? = '' OR p.Nombre = ? OR (p.Nombre IS NULL AND ? = '')) 
        ORDER BY o.Nombre, p.Nombre, c.Nombre, m.Descripcion
    ";
    
    $params = [$pais, $pais, $pais, $organismo, $organismo, $organismo, $provincia, $provincia, $provincia];
    $stmt = sqlsrv_query($conn, $sqlMachines, $params);
    if ($stmt === false) {
        log_sql_error("Error máquinas", $sqlMachines, $params);
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit();
    }
    
    $machines = [];
    $numeroSeries = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $machines[] = $row;
        $numeroSeries[] = $row["NumeroSerie"];
    }
    sqlsrv_free_stmt($stmt);
    
    // Recuperación de logs activos para las máquinas filtradas
    // Se aplica el mismo filtro geográfico a los logs para mantener la consistencia
    $logsByNS = [];
    if (!empty($numeroSeries)) {
        $sqlLogs = "
            SELECT 
                le.Id as ID, le.NumeroSerie as Numero_Serie, le.TipoMaquina, 
                le.TimeStamp, le.CodigoError, le.Activo, le.Observaciones, 
                e.Descripcion as Mensaje 
            FROM Log_Errores le 
            INNER JOIN Maquinas m ON m.NumeroSerie = le.NumeroSerie 
            LEFT JOIN Organismos o ON o.Codigo = m.Organismo 
            LEFT JOIN Provincias p ON p.Codigo = m.Provincia 
            LEFT JOIN Paises pa ON pa.Codigo = p.Pais 
            LEFT JOIN Errores e ON le.CodigoError = e.Codigo 
            WHERE le.Activo = 1 
            AND (? = '' OR pa.Nombre = ? OR (pa.Nombre IS NULL AND ? = '')) 
            AND (? = '' OR o.Nombre = ? OR (o.Nombre IS NULL AND ? = '')) 
            AND (? = '' OR p.Nombre = ? OR (p.Nombre IS NULL AND ? = '')) 
            ORDER BY le.NumeroSerie, le.Id DESC
        ";
        
        $stmtLogs = sqlsrv_query($conn, $sqlLogs, $params);
        if ($stmtLogs !== false) {
            while ($logRow = sqlsrv_fetch_array($stmtLogs, SQLSRV_FETCH_ASSOC)) {
                $ns = $logRow["Numero_Serie"];
                unset($logRow["Numero_Serie"]);
                
                if (!isset($logsByNS[$ns])) {
                    $logsByNS[$ns] = [];
                }
                $logsByNS[$ns][] = $logRow;
            }
            sqlsrv_free_stmt($stmtLogs);
        }
    }
    
    // Anidamos los logs en su máquina correspondiente
    foreach ($machines as &$m) {
        $m["Logs"] = $logsByNS[$m["NumeroSerie"]] ?? [];
    }
    
    $cols = ["Organismo", "CodOrganismo", "Provincia", "CodProvincia", "Cliente", "CodCliente", "Descripcion", "UltimoControl", "MonitorizarEstado", "MonitorizarAlertas", "NumeroSerie", "TipoMaquina", "Logs"];
    
    // Formateamos los datos en filas (arrays) para optimizar el tamaño de la respuesta JSON
    $rows = [];
    foreach ($machines as $m) {
        $row = [];
        foreach ($cols as $c) {
            $val = $m[$c] ?? ($c === "Logs" ? [] : null);
            if ($c === "MonitorizarEstado" || $c === "MonitorizarAlertas") {
                $val = (int)$val;
            }
            $row[] = $val;
        }
        $rows[] = $row;
    }
    
    responder_json_si_cambia(["cols" => $cols, "rows" => $rows], $conn);
}

/**
 * MODO: maquinas_navegacion
 * Obtiene todas las máquinas para navegación del maestro.
 */
if ($modo === "maquinas_navegacion") {
    $sql = "
        SELECT 
            m.NumeroSerie AS Codigo, m.Descripcion, m.TipoMaquina, m.Notas, 
            m.Organismo, m.Cliente, m.Provincia, m.MonitorizarEstado, 
            m.MonitorizarAlertas, m.UltimoControl, m.Actualizar 
        FROM Maquinas m 
        LEFT JOIN Organismos o ON o.Codigo = m.Organismo 
        LEFT JOIN Provincias p ON p.Codigo = m.Provincia 
        LEFT JOIN Clientes c ON c.Codigo = m.Cliente 
        ORDER BY o.Nombre, p.Nombre, c.Nombre, m.Descripcion
    ";
    
    $stmt = sqlsrv_query($conn, $sql);
    if ($stmt === false) {
        log_sql_error("Error navegación máquinas", $sql);
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit();
    }
    
    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = $row;
    }
    sqlsrv_free_stmt($stmt);
    responder_json_si_cambia($data, $conn);
}

/**
 * MODO: verificar_ns
 * Verifica si un número de serie ya existe en la base de datos.
 */
if ($modo === "verificar_ns") {
    $ns = $_GET["ns"] ?? "";
    $sql = "SELECT COUNT(*) as cuenta FROM Maquinas WHERE NumeroSerie = ?";
    $stmt = sqlsrv_query($conn, $sql, [$ns]);
    
    if ($stmt === false) {
        log_sql_error("Error verificar_ns", $sql, [$ns]);
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit();
    }
    
    $row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC);
    echo json_encode(["exists" => $row["cuenta"] > 0]);
    sqlsrv_close($conn);
    exit();
}

/**
 * MODO: crear_maquina
 * Crea una nueva máquina o actualiza una existente (UPSERT).
 */
if ($modo === "crear_maquina") {
    $ns = $_POST["ns"] ?? "";
    $desc = $_POST["descripcion"] ?? "";
    $tipo = $_POST["tipo"] ?? "";
    $notas = $_POST["notas"] ?? "";
    $org = $_POST["organismo"] ?? "";
    $cli = $_POST["cliente"] ?? "";
    $prov = $_POST["provincia"] ?? "";
    $ultimoControl = $_POST["UltimoControl"] ?? "0";
    
    if (empty($ns)) {
        http_response_code(400);
        echo json_encode(["error" => "El número de serie es obligatorio"]);
        exit();
    }
    
    $tablas_maestras = [
        ["tabla" => "Organismos", "codigo" => $org, "label" => "Organismo"],
        ["tabla" => "Clientes", "codigo" => $cli, "label" => "Cliente"],
        ["tabla" => "Provincias", "codigo" => $prov, "label" => "Provincia"]
    ];
    
    foreach ($tablas_maestras as $maestra) {
        $sqlCheck = "SELECT COUNT(*) as cuenta FROM " . $maestra["tabla"] . " WHERE codigo = ?";
        $stmtCheck = sqlsrv_query($conn, $sqlCheck, [$maestra["codigo"]]);
        $rowCheck = sqlsrv_fetch_array($stmtCheck, SQLSRV_FETCH_ASSOC);
        
        if ($rowCheck["cuenta"] == 0) {
            http_response_code(400);
            echo json_encode(["error" => "El código de " . $maestra["label"] . " no existe."]);
            exit();
        }
    }
    
    $actualizar = isset($_POST["actualizar"]) ? 1 : 0;
    $monEstado = isset($_POST["mon_estado"]) ? 1 : 0;
    $monAlerta = isset($_POST["mon_alertas"]) ? 1 : 0;
    
    $sql = "
        IF EXISTS (SELECT 1 FROM Maquinas WHERE NumeroSerie = ?) 
            UPDATE Maquinas SET Descripcion=?, TipoMaquina=?, Notas=?, Organismo=?, Cliente=?, Provincia=?, Actualizar=?, MonitorizarEstado=?, MonitorizarAlertas=? WHERE NumeroSerie=? 
        ELSE 
            INSERT INTO Maquinas (NumeroSerie, Descripcion, TipoMaquina, Notas, Organismo, Cliente, Provincia, Actualizar, UltimoControl, MonitorizarEstado, MonitorizarAlertas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ";
    
    $params = [
        $ns, $desc, $tipo, $notas, $org, $cli, $prov, $actualizar, $monEstado, $monAlerta, $ns, 
        $ns, $desc, $tipo, $notas, $org, $cli, $prov, $actualizar, $ultimoControl, $monEstado, $monAlerta
    ];
    
    $stmt = sqlsrv_query($conn, $sql, $params);
    if ($stmt === false) {
        log_sql_error("Error crear máquina", $sql, $params);
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit();
    }
    
    echo json_encode(["success" => true]);
    sqlsrv_close($conn);
    exit();
}

/**
 * MODO: eliminar_maquina
 * Elimina una máquina existente basándose en su número de serie.
 */
if ($modo === "eliminar_maquina") {
    $ns = $_POST["ns"] ?? "";
    if (empty($ns)) {
        http_response_code(400);
        echo json_encode(["error" => "No se ha proporcionado el número de serie"]);
        exit();
    }
    
    $sql = "DELETE FROM Maquinas WHERE NumeroSerie = ?";
    $stmt = sqlsrv_query($conn, $sql, [$ns]);
    
    if ($stmt === false) {
        log_sql_error("Error eliminar máquina", $sql, [$ns]);
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit();
    }
    
    echo json_encode(["success" => true]);
    sqlsrv_close($conn);
    exit();
}
?>