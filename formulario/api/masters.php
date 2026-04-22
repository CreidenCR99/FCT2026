<?php
/**
 * SicoLares API - Lógica de Tablas Maestras
 */

/**
 * MODO: get_nombre
 * Función de utilidad para resolver un código a su nombre/descripción.
 * Útil para mostrar nombres descriptivos al lado de inputs de código.
 */
if ($modo === "get_nombre") {
    $tipo = $_GET["tipo"] ?? ""; $codigo = $_GET["codigo"] ?? "";
    $tablas = ["organismos" => "Organismos", "provincias" => "Provincias", "clientes" => "Clientes", "paises" => "Paises", "errores" => "Errores"];
    $tabla = $tablas[$tipo] ?? "";
    if ($tabla && $codigo) {
        // La tabla Errores usa 'Descripcion' en lugar de 'Nombre'
        $col = ($tabla === "Errores") ? "Descripcion" : "Nombre";
        $sql = "SELECT $col AS Nombre FROM $tabla WHERE Codigo = ?";
        $stmt = sqlsrv_query($conn, $sql, [$codigo]);
        if ($stmt !== false) { $res = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC); echo json_encode(["nombre" => $res ? $res["Nombre"] : ""]); sqlsrv_free_stmt($stmt); }
        else { log_sql_error("Error en get_nombre", $sql, [$codigo]); echo json_encode(["nombre" => ""]); }
    } else echo json_encode(["nombre" => ""]);
    if ($conn) {
        sqlsrv_close($conn);
    }
    exit();
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
        $tabla = $tablas[$tipo] ?? "";
        if (!$tabla) { echo json_encode([]); exit(); }
        if ($tabla === "Paises") $sql = "SELECT Codigo, Nombre, Latitud, Longitud FROM Paises ORDER BY Nombre";
        elseif ($tabla === "Provincias") $sql = "SELECT Codigo, Nombre, Pais, Latitud, Longitud FROM Provincias ORDER BY Nombre";
        elseif ($tabla === "Errores") $sql = "SELECT Codigo, Descripcion AS Nombre FROM Errores ORDER BY Codigo";
        else $sql = "SELECT Codigo, Nombre FROM $tabla ORDER BY Nombre";
    }
    $stmt = sqlsrv_query($conn, $sql);
    if ($stmt === false) {
        log_sql_error("Error en modo maestro ($tipo)", $sql);
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
        log_sql_error("Error en catálogo de errores", $sql);
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
    $tabla = $_POST["tabla"] ?? ""; $codigo = $_POST["codigo"] ?? ""; $nombre = $_POST["nombre"] ?? "";
    if (!$tabla || !$codigo) { echo json_encode(["error" => "Datos incompletos"]); exit(); }
    if ($tabla === "Paises") {
        $long = $_POST["longitud"] ?: null; $lat = $_POST["latitud"] ?: null;
        $sql = "IF EXISTS(SELECT 1 FROM Paises WHERE Codigo=?) UPDATE Paises SET Nombre=?, Longitud=?, Latitud=? WHERE Codigo=? ELSE INSERT INTO Paises (Codigo, Nombre, Longitud, Latitud) VALUES (?,?,?,?)";
        $params = [$codigo, $nombre, $long, $lat, $codigo, $codigo, $nombre, $long, $lat];
    } elseif ($tabla === "Provincias") {
        $pais = $_POST["pais"] ?: null; $long = $_POST["longitud"] ?: null; $lat = $_POST["latitud"] ?: null;
        $sql = "IF EXISTS(SELECT 1 FROM Provincias WHERE Codigo=?) UPDATE Provincias SET Nombre=?, Pais=?, Longitud=?, Latitud=? WHERE Codigo=? ELSE INSERT INTO Provincias (Codigo, Nombre, Pais, Longitud, Latitud) VALUES (?,?,?,?,?)";
        $params = [$codigo, $nombre, $pais, $long, $lat, $codigo, $codigo, $nombre, $pais, $long, $lat];
    } else {
        $sql = "IF EXISTS(SELECT 1 FROM $tabla WHERE Codigo=?) UPDATE $tabla SET Nombre=? WHERE Codigo=? ELSE INSERT INTO $tabla (Codigo, Nombre) VALUES (?,?)";
        $params = [$codigo, $nombre, $codigo, $codigo, $nombre];
    }
    $stmt = sqlsrv_query($conn, $sql, $params);
    if ($stmt === false) log_sql_error("Error guardar maestro", $sql, $params);
    echo json_encode(["success" => $stmt !== false, "error" => sqlsrv_errors()]);
    sqlsrv_close($conn); exit();
}

if ($modo === "eliminar_maestro") {
    $tabla = $_POST["tabla"] ?? ""; $codigo = $_POST["codigo"] ?? "";
    $sql = "DELETE FROM $tabla WHERE Codigo = ?";
    $stmt = sqlsrv_query($conn, $sql, [$codigo]);
    echo json_encode(["success" => $stmt !== false]);
    sqlsrv_close($conn); exit();
}

if ($modo === "get_maestro_detalle") {
    $tabla = $_GET["tabla"] ?? ""; $codigo = $_GET["codigo"] ?? "";
    $sql = "SELECT * FROM $tabla WHERE Codigo = ?";
    $stmt = sqlsrv_query($conn, $sql, [$codigo]);
    $res = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC);
    echo json_encode($res ?: []);
    sqlsrv_close($conn); exit();
}

if ($modo === "maquinas_search") {
    $sql = "SELECT NumeroSerie as Codigo, Descripcion as Nombre FROM Maquinas ORDER BY Descripcion";
    $stmt = sqlsrv_query($conn, $sql);
    $data = [];
    while($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) $data[] = $row;
    sqlsrv_free_stmt($stmt);
    echo json_encode($data);
    sqlsrv_close($conn); exit();
}
?>