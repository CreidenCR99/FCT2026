<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header("Content-Type: application/json; charset=UTF-8");

// Función simple para cargar .env
function loadEnv($path) {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        list($name, $value) = explode('=', $line, 2);
        $_ENV[trim($name)] = trim($value);
        putenv(trim($name) . "=" . trim($value));
    }
}

loadEnv(__DIR__ . '/.env');

$serverName = getenv('DB_SERVER');
$connectionInfo = array(
    "Database" => getenv('DB_DATABASE'),
    "UID" => getenv('DB_USER'),
    "PWD" => getenv('DB_PASS'),
    "CharacterSet" => "UTF-8"
);

$conn = sqlsrv_connect($serverName, $connectionInfo);

if ($conn === false) {
    http_response_code(500);
    echo json_encode(["error" => sqlsrv_errors()]);
    exit;
}

$modo = $_GET['modo'] ?? '';

if ($modo === 'organismos') {
    $sql = "SELECT DISTINCT o.Nombre AS Organismo
            FROM Maquinas m
            LEFT JOIN Organismos o ON o.codigo = m.organismo
            WHERE o.Nombre IS NOT NULL
            ORDER BY o.Nombre";

    $stmt = sqlsrv_query($conn, $sql);

    if ($stmt === false) {
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit;
    }

    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = $row;
    }

    echo json_encode($data);
    sqlsrv_free_stmt($stmt);
    sqlsrv_close($conn);
    exit;
}

if ($modo === 'provincias') {
    $organismo = trim($_GET['organismo'] ?? '');
    $sql = "SELECT DISTINCT p.Nombre AS Provincia
            FROM Maquinas m
            LEFT JOIN Provincias p ON p.codigo = m.provincia
            LEFT JOIN Organismos o ON o.codigo = m.organismo
            WHERE p.Nombre IS NOT NULL
              AND (? = '' OR o.Nombre = ?)
            ORDER BY p.Nombre";

    $params = array($organismo, $organismo);
    $stmt = sqlsrv_query($conn, $sql, $params);

    if ($stmt === false) {
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit;
    }

    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = $row;
    }

    echo json_encode($data);
    sqlsrv_free_stmt($stmt);
    sqlsrv_close($conn);
    exit;
}

if ($modo === 'maquinas') {
    $organismo = trim($_GET['organismo'] ?? '');
    $provincia = trim($_GET['provincia'] ?? '');

    // Fetch all machines
    $sqlMachines = "SELECT
                o.Nombre AS Organismo,
                p.Nombre AS Provincia,
                ISNULL(c.Nombre, 'error') AS Cliente,
                m.Descripcion,
                m.UltimoControl,
                m.MonitorizarEstado,
                m.MonitorizarAlertas,
                m.NumeroSerie
            FROM Maquinas m
            LEFT JOIN Organismos o ON o.codigo = m.organismo
            LEFT JOIN Provincias p ON p.codigo = m.provincia
            LEFT JOIN Clientes c ON c.codigo = m.cliente
            WHERE (? = '' OR o.Nombre = ?)
              AND (? = '' OR p.Nombre = ?)
            ORDER BY o.Nombre, p.Nombre, c.Nombre, m.Descripcion";

    $paramsMachines = array($organismo, $organismo, $provincia, $provincia);
    $stmtMachines = sqlsrv_query($conn, $sqlMachines, $paramsMachines);

    if ($stmtMachines === false) {
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit;
    }

    $machines = [];
    $numeroSeries = [];
    while ($row = sqlsrv_fetch_array($stmtMachines, SQLSRV_FETCH_ASSOC)) {
        $machines[] = $row;
        $numeroSeries[] = $row['NumeroSerie'];
    }
    sqlsrv_free_stmt($stmtMachines);

    // If no machines, return early
    if (empty($machines)) {
        echo json_encode([]);
        sqlsrv_close($conn);
        exit;
    }

    // Fetch all logs for these machines
    $placeholders = implode(',', array_fill(0, count($numeroSeries), '?'));
    $sqlLogs = "SELECT
                    Numero_Serie,
                    Mensaje,
                    ResultadoCorrecto,
                    ID,
                    Observaciones
                FROM Log_Actualizaciones
                WHERE Numero_Serie IN ($placeholders)
                ORDER BY Numero_Serie, ID DESC";

    $stmtLogs = sqlsrv_query($conn, $sqlLogs, $numeroSeries);

    if ($stmtLogs === false) {
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit;
    }

    $logsByNumeroSerie = [];
    while ($logRow = sqlsrv_fetch_array($stmtLogs, SQLSRV_FETCH_ASSOC)) {
        $ns = $logRow['Numero_Serie'];
        if (!isset($logsByNumeroSerie[$ns])) {
            $logsByNumeroSerie[$ns] = [];
        }
        $logsByNumeroSerie[$ns][] = $logRow;
    }
    sqlsrv_free_stmt($stmtLogs);

    // Attach logs to machines
    foreach ($machines as &$machine) {
        $machine['Logs'] = $logsByNumeroSerie[$machine['NumeroSerie']] ?? [];
    }
    unset($machine); // Break the reference

    echo json_encode($machines);
    sqlsrv_close($conn);
    exit;
}

if ($modo === 'actualizar_log') {
    $id = $_POST['id_log'] ?? '';
    $resultado = $_POST['resultado'] ?? '';
    $observaciones = $_POST['observaciones'] ?? '';

    if (empty($id)) {
        http_response_code(400);
        echo json_encode(["error" => "ID de log no proporcionado"]);
        exit;
    }

    $sql = "UPDATE Log_Actualizaciones 
            SET ResultadoCorrecto = ?, 
                Observaciones = ? 
            WHERE ID = ?";
    
    $params = array($resultado, $observaciones, $id);
    $stmt = sqlsrv_query($conn, $sql, $params);

    if ($stmt === false) {
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit;
    }

    echo json_encode(["success" => true]);
    sqlsrv_close($conn);
    exit;
}

echo json_encode(["error" => "Modo no valido"]);
sqlsrv_close($conn);
?>