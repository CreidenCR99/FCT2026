<?php
error_reporting(E_ALL);
ini_set("display_errors", 0);
header("Content-Type: application/json; charset=UTF-8");

// Configuración de compresión
$supportsBrotli = extension_loaded("brotli") && 
                  isset($_SERVER["HTTP_ACCEPT_ENCODING"]) && 
                  strpos($_SERVER["HTTP_ACCEPT_ENCODING"], "br") !== false;

if ($supportsBrotli) {
    ob_start(function ($buffer) {
        header("Content-Encoding: br");
        header("Vary: Accept-Encoding");
        return brotli_compress($buffer, 6);
    });
} else {
    if (!ob_start("ob_gzhandler")) {
        ob_start();
    }
}

/**
 * Envía una respuesta JSON optimizada mediante ETags.
 */
function responder_json_si_cambia($data, $conn = null) {
    $json = json_encode($data);
    $etag = md5($json);

    header("ETag: \"$etag\"");
    header("Cache-Control: no-cache, must-revalidate");

    if (isset($_SERVER["HTTP_IF_NONE_MATCH"])) {
        $etag_cliente = trim($_SERVER["HTTP_IF_NONE_MATCH"], '"');
        if ($etag_cliente === $etag) {
            if ($conn) sqlsrv_close($conn);
            http_response_code(304);
            exit();
        }
    }

    echo $json;
    if ($conn) sqlsrv_close($conn);
    exit();
}

/**
 * Registra errores de SQL Server.
 */
function log_sql_error($message, $sql = null, $params = null) {
    $logFile = __DIR__ . '/sql_errors.log';
    $timestamp = date("Y-m-d H:i:s");
    $errors = sqlsrv_errors();
    
    $logEntry = "[$timestamp] ERROR: $message\n";
    if ($sql) $logEntry .= "SQL: $sql\n";
    if ($params) $logEntry .= "Params: " . json_encode($params, JSON_UNESCAPED_UNICODE) . "\n";
    $logEntry .= "DB Error: " . json_encode($errors, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
    $logEntry .= "--------------------------------------------------\n";
    
    error_log($logEntry, 3, $logFile);
}

/**
 * Carga variables de entorno.
 */
function loadEnv($path) {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), "#") === 0) continue;
        $parts = explode("=", $line, 2);
        if (count($parts) !== 2) continue;
        $_ENV[trim($parts[0])] = trim($parts[1]);
        putenv(trim($parts[0]) . "=" . trim($parts[1]));
    }
}

loadEnv(__DIR__ . "/.env");


// Conexión a la base de datos
$serverName = getenv("DB_SERVER");
$connectionInfo = [
    "Database" => getenv("DB_DATABASE"),
    "UID" => getenv("DB_USER"),
    "PWD" => getenv("DB_PASS"),
    "CharacterSet" => "UTF-8",
];

$conn = sqlsrv_connect($serverName, $connectionInfo);

if ($conn === false) {
    http_response_code(500);
    log_sql_error("Fallo de conexión al servidor");
    echo json_encode(["error" => sqlsrv_errors()]);
    exit();
}
?>