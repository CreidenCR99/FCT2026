<?php
/**
 * masters.php
 * Endpoints para maestros: organismos, clientes, paises, provincias, errores.
 */

// Refuerzo de captura de anomalías globales (Errores PHP y Excepciones)
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    $msg = "ANOMALÍA PHP [$errno]: $errstr en $errfile:$errline | URI: " . ($_SERVER['REQUEST_URI'] ?? 'CLI');
    error_log($msg);
    return false; // Seguir con el flujo normal
});

set_exception_handler(function($e) {
    $msg = "EXCEPCIÓN NO CAPTURADA: " . $e->getMessage() . " en " . $e->getFile() . ":" . $e->getLine() . " | IP: " . ($_SERVER['REMOTE_ADDR'] ?? 'Unknown');
    error_log($msg);
    http_response_code(500);
    echo json_encode(["error" => "Error interno del servidor", "detail" => $e->getMessage()]);
    exit();
});

$modo = $_GET["modo"] ?? "";

// Verificar conexión antes de procesar
if (!$conn) {
    log_sql_error("Error crítico: Sin conexión al servidor SQL", "", []);
    http_response_code(503);
    echo json_encode(["error" => "Servicio de base de datos no disponible"]);
    exit();
}

/**
 * MODO: maquinas_navegacion
 * Recupera todos los campos necesarios para la navegación completa del maestro de máquinas (F1).
 */
if ($modo === "maquinas_navegacion") {
    $sql = "SELECT NumeroSerie AS Codigo, Descripcion, TipoMaquina, Notas, Organismo, Cliente, Provincia, 
            MonitorizarEstado, MonitorizarAlertas, UltimoControl, Actualizar 
            FROM Maquinas ORDER BY Descripcion";
    $stmt = sqlsrv_query($conn, $sql);
    if ($stmt === false) {
        log_sql_error("Error en maquinas_navegacion: " . json_encode(sqlsrv_errors()), $sql);
        http_response_code(500);
        echo json_encode(["error" => "No se pudo cargar el catálogo de máquinas"]);
        if ($conn) sqlsrv_close($conn);
        exit();
    }
    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) $data[] = $row;
    echo json_encode($data);
    if ($conn) sqlsrv_close($conn);
    exit();
}

/**
 * MODO: get_nombre
 * Devuelve el Nombre (o Descripcion) de una entidad dado su Codigo.
 */
if ($modo === "get_nombre") {
    $tipo   = $_GET["tipo"]   ?? "";
    $codigo = $_GET["codigo"] ?? "";
    $tablas = ["organismos" => "Organismos", "provincias" => "Provincias", "clientes" => "Clientes", "paises" => "Paises", "errores" => "Errores"];
    $tabla  = $tablas[$tipo] ?? "";
    if ($tabla && $codigo) {
        // La tabla Errores usa 'Descripcion' en lugar de 'Nombre'
        $col = ($tabla === "Errores") ? "Descripcion" : "Nombre";
        $sql = "SELECT $col AS Nombre FROM $tabla WHERE Codigo = ?";
        $stmt = sqlsrv_query($conn, $sql, [$codigo]);
        if ($stmt !== false) { $res = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC); echo json_encode(["nombre" => $res ? $res["Nombre"] : ""]); sqlsrv_free_stmt($stmt); }
        else { log_sql_error("Error en get_nombre (" . ($tipo ?: 'unknown') . "): " . json_encode(sqlsrv_errors()), $sql, [$codigo]); echo json_encode(["nombre" => ""]); }
    } else echo json_encode(["nombre" => ""]);
    if ($conn) sqlsrv_close($conn);
    exit();
}

/**
 * MODO: verificar_duplicado
 * Verifica en tiempo real si un Codigo O un Nombre/Descripcion ya existe
 * en la tabla maestra indicada. Equivalente genérico a verificar_ns.
 *
 * Parámetros GET:
 *   tipo  => organismos | clientes | paises | provincias | errores
 *   campo => codigo | nombre   (indica qué campo verificar)
 *   valor => valor a comprobar
 *
 * Respuesta: { "exists": true|false }
 */
if ($modo === "verificar_duplicado" || $modo === "verificar_ns") {
    // Unificación: si es verificar_ns o no viene tipo, asumimos maquinas/codigo
    $tipo  = $_GET["tipo"]  ?? ($modo === "verificar_ns" ? "maquinas" : "maquinas");
    $campo = $_GET["campo"] ?? ($modo === "verificar_ns" ? "codigo" : "nombre");
    $valor = trim($_GET["valor"] ?? $_GET["ns"] ?? "");

    $tablas = [
        "organismos" => "Organismos", 
        "provincias" => "Provincias", 
        "clientes"   => "Clientes", 
        "paises"     => "Paises", 
        "errores"    => "Errores",
        "maquinas"   => "Maquinas"
    ];
    $tabla  = $tablas[$tipo] ?? "";

    if (!$tabla || $valor === "") {
        echo json_encode(["exists" => false]);
        if ($conn) sqlsrv_close($conn);
        exit();
    }

// Determinar columna real a consultar
if ($campo === "codigo") {
        $col = ($tabla === "Maquinas") ? "NumeroSerie" : "Codigo";
        // Sin COLLATE para códigos ya que pueden ser numéricos
        $sql = "SELECT COUNT(*) AS cuenta FROM $tabla WHERE $col = ?";
    $params = [$valor];
} else {
        // Errores y Maquinas usan Descripcion; el resto usa Nombre
        $col = ($tabla === "Errores" || $tabla === "Maquinas") ? "Descripcion" : "Nombre";
    $sql = "SELECT COUNT(*) AS cuenta FROM $tabla WHERE $col COLLATE Latin1_General_CI_AI = ?";
    $params = [$valor];
}

    $stmt = sqlsrv_query($conn, $sql, $params);
    if ($stmt === false) {
        log_sql_error("Error verificar_duplicado ($tipo/$campo): " . json_encode(sqlsrv_errors()), $sql, $params);
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        if ($conn) sqlsrv_close($conn);
        exit();
    }
    $row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC);
    echo json_encode(["exists" => $row["cuenta"] > 0]);
    sqlsrv_close($conn);
    exit(); // Finalizamos ejecución tras responder validaciones
}

/**
 * MODO: maestro
 * Recupera el catálogo completo de una entidad específica.
 * Soporta casos especiales como 'Paises' y 'Provincias' que requieren coordenadas.
 */
if ($modo === "maestro") {
    $tipo = $_GET["tipo"] ?? "";
    if ($tipo === "maquinas") {
        $sql = "SELECT m.NumeroSerie AS Codigo, m.Descripcion AS Nombre FROM Maquinas m LEFT JOIN Organismos o ON o.Codigo = m.Organismo LEFT JOIN Provincias p ON p.Codigo = m.Provincia LEFT JOIN Clientes c ON c.Codigo = m.Cliente ORDER BY o.Nombre, p.Nombre, c.Nombre, m.Descripcion";
    } else {
        $tablas = ["organismos" => "Organismos", "provincias" => "Provincias", "clientes" => "Clientes", "paises" => "Paises", "errores" => "Errores"];
        $tabla  = $tablas[$tipo] ?? "";
        if (!$tabla) { echo json_encode([]); exit(); }
        if ($tabla === "Paises")     $sql = "SELECT Codigo, Nombre, Latitud, Longitud FROM Paises ORDER BY Nombre";
        elseif ($tabla === "Provincias") $sql = "SELECT Codigo, Nombre, Pais, Latitud, Longitud FROM Provincias ORDER BY Nombre";
        elseif ($tabla === "Errores")    $sql = "SELECT Codigo, Descripcion AS Nombre FROM Errores ORDER BY Codigo";
        else $sql = "SELECT Codigo, Nombre FROM $tabla ORDER BY Nombre";
    }
    $stmt = sqlsrv_query($conn, $sql);
    if ($stmt === false) {
        log_sql_error("Error en modo maestro ($tipo): " . json_encode(sqlsrv_errors()), $sql);
        http_response_code(500);
        echo json_encode(["error" => "Error interno al cargar catálogo"]);
        if ($conn) sqlsrv_close($conn);
        exit();
    }
    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) $data[] = $row;
    sqlsrv_free_stmt($stmt);
    responder_json_si_cambia($data, $conn);
}

if ($modo === "errores") {
    $sql = "SELECT Codigo, Descripcion FROM Errores ORDER BY Codigo";
    $stmt = sqlsrv_query($conn, $sql);
    if ($stmt === false) {
        log_sql_error("Error en catálogo de errores: " . json_encode(sqlsrv_errors()), $sql);
        http_response_code(500);
        echo json_encode(["error" => "Error al cargar errores"]);
        exit();
    }
    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) $data[] = ["Codigo" => $row["Codigo"], "Descripcion" => $row["Descripcion"]];
    sqlsrv_free_stmt($stmt);
    responder_json_si_cambia($data, $conn);
}

/**
 * MODO: guardar_maestro
 * Lógica universal de UPSERT (Insertar o Actualizar) para todas las tablas maestras.
 */
if ($modo === "guardar_maestro") {
    $tabla  = $_POST["tabla"]  ?? "";
    $codigo = $_POST["codigo"] ?? "";
    $nombre = $_POST["nombre"] ?? "";
    if (!$tabla || !$codigo) { echo json_encode(["error" => "Datos incompletos"]); exit(); }
    if ($tabla === "Paises") {
        $long = $_POST["longitud"] ?: null; $lat = $_POST["latitud"] ?: null;
        $sql = "IF EXISTS(SELECT 1 FROM Paises WHERE Codigo=?) UPDATE Paises SET Nombre=?, Longitud=?, Latitud=? WHERE Codigo=? ELSE INSERT INTO Paises (Codigo, Nombre, Longitud, Latitud) VALUES (?,?,?,?)";
        $params = [$codigo, $nombre, $long, $lat, $codigo, $codigo, $nombre, $long, $lat];
    } elseif ($tabla === "Provincias") {
        $pais = $_POST["pais"] ?: null; $long = $_POST["longitud"] ?: null; $lat = $_POST["latitud"] ?: null;
        $sql = "IF EXISTS(SELECT 1 FROM Provincias WHERE Codigo=?) UPDATE Provincias SET Nombre=?, Pais=?, Longitud=?, Latitud=? WHERE Codigo=? ELSE INSERT INTO Provincias (Codigo, Nombre, Pais, Longitud, Latitud) VALUES (?,?,?,?,?)";
        $params = [$codigo, $nombre, $pais, $long, $lat, $codigo, $codigo, $nombre, $pais, $long, $lat];
    } elseif ($tabla !== "Errores") {
        $sql = "IF EXISTS(SELECT 1 FROM $tabla WHERE Codigo=?) UPDATE $tabla SET Nombre=? WHERE Codigo=? ELSE INSERT INTO $tabla (Codigo, Nombre) VALUES (?,?)";
        $params = [$codigo, $nombre, $codigo, $codigo, $nombre];
    } else {
        $sql = "IF EXISTS(SELECT 1 FROM $tabla WHERE Codigo=?) UPDATE $tabla SET Descripcion=? WHERE Codigo=? ELSE INSERT INTO $tabla (Codigo, Descripcion) VALUES (?,?)";
        $params = [$codigo, $nombre, $codigo, $codigo, $nombre];
    }
    $stmt = sqlsrv_query($conn, $sql, $params);
    if ($stmt === false) log_sql_error("Error guardar maestro ($tabla): " . json_encode(sqlsrv_errors()), $sql, $params);
    echo json_encode(["success" => $stmt !== false, "error" => sqlsrv_errors()]);
    sqlsrv_close($conn); exit();
}

if ($modo === "eliminar_maestro") {
    $tabla  = $_POST["tabla"]  ?? "";
    $codigo = $_POST["codigo"] ?? "";
    $sql    = "DELETE FROM $tabla WHERE Codigo = ?";
    $stmt   = sqlsrv_query($conn, $sql, [$codigo]);
    echo json_encode(["success" => $stmt !== false]);
    sqlsrv_close($conn); exit();
}

if ($modo === "get_maestro_detalle") {
    $tabla  = $_GET["tabla"]  ?? "";
    $codigo = $_GET["codigo"] ?? "";
    $sql    = "SELECT * FROM $tabla WHERE Codigo = ?";
    $stmt   = sqlsrv_query($conn, $sql, [$codigo]);
    $res    = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC);
    echo json_encode($res ?: []);
    sqlsrv_close($conn); exit();
}

if ($modo === "maquinas_search") {
    $sql  = "SELECT NumeroSerie as Codigo, Descripcion as Nombre FROM Maquinas ORDER BY Descripcion";
    $stmt = sqlsrv_query($conn, $sql);
    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) $data[] = $row;
    sqlsrv_free_stmt($stmt);
    echo json_encode($data);
    sqlsrv_close($conn); exit();
}
?>