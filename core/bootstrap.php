<?php
/**
 * @file bootstrap.php
 * @description Punto de entrada principal para el núcleo de la aplicación.
 * Gestiona la carga de variables de entorno, la configuración de compresión (Brotli/Gzip),
 * la conexión centralizada a la base de datos SQL Server y funciones de utilidad globales.
 */

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
 * 
 * @param mixed $data Datos a codificar en JSON.
 * @param resource|null $conn Conexión a la base de datos para cerrarla antes de salir.
 * @return void
 */
function responder_json_si_cambia($data, $conn = null) {
    $json = json_encode($data);
    $etag = md5($json);

    header("ETag: \"$etag\"");
    header("Cache-Control: no-cache, must-revalidate");

    if (isset($_SERVER["HTTP_IF_NONE_MATCH"])) {
        $etag_cliente = trim($_SERVER["HTTP_IF_NONE_MATCH"], '"');
        if ($etag_cliente === $etag) {
            if ($conn) {
                sqlsrv_close($conn);
            }
            http_response_code(304);
            exit();
        }
    }

    echo $json;
    if ($conn) {
        sqlsrv_close($conn);
    }
    exit();
}

/**
 * Registra errores de SQL en un archivo de log persistente.
 * Captura información detallada del contexto: URI, método, IP del cliente, 
 * archivo y línea desde donde se produjo la llamada.
 * 
 * @param string $message Mensaje descriptivo del error.
 * @param string|null $sql Consulta SQL que falló (opcional).
 * @param array|null $params Parámetros vinculados a la consulta (opcional).
 * @return void
 */
function log_sql_error($message, $sql = null, $params = null) {
    $logFile = __DIR__ . '/../sql_errors.log';
    $timestamp = date("Y-m-d H:i:s");
    $errors = sqlsrv_errors();
    
    // Capturar información extra del entorno
    $uri = $_SERVER['REQUEST_URI'] ?? 'Desconocida';
    $method = $_SERVER['REQUEST_METHOD'] ?? 'Desconocido';
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'Desconocida';
    
    // Obtener el archivo y línea donde se llamó la función (nivel 0 es debug_backtrace, nivel 1 es log_sql_error, nivel 2 es el que llama)
    $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2);
    $callerFile = isset($trace[0]['file']) ? basename($trace[0]['file']) : 'Desconocido';
    $callerLine = isset($trace[0]['line']) ? $trace[0]['line'] : 'Desconocida';
    
    $logEntry = "[$timestamp] ERROR: $message\n";
    $logEntry .= "Location: $callerFile (Línea $callerLine)\n";
    $logEntry .= "Request: $method $uri (IP: $ip)\n";
    
    if ($sql) {
        // Limpiar el SQL de espacios extra y saltos de línea para que sea más legible en el log
        $cleanSql = preg_replace('/\s+/', ' ', trim($sql));
        $logEntry .= "SQL: $cleanSql\n";
    }
    if ($params) {
        $logEntry .= "Params: " . json_encode($params, JSON_UNESCAPED_UNICODE) . "\n";
    }
    if ($errors) {
        $logEntry .= "DB Error: " . json_encode($errors, JSON_UNESCAPED_UNICODE) . "\n";
    } else {
        $logEntry .= "DB Error: (No detail from sqlsrv_errors())\n";
    }
    $logEntry .= "--------------------------------------------------\n";
    
    error_log($logEntry, 3, $logFile);
}

/**
 * Carga variables de entorno desde un archivo .env.
 * 
 * @param string $path Ruta al archivo .env.
 * @return void
 */
function loadEnv($path) {
    if (!file_exists($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), "#") === 0) {
            continue;
        }
        $parts = explode("=", $line, 2);
        if (count($parts) !== 2) {
            continue;
        }
        $key = trim($parts[0]);
        $value = trim($parts[1]);
        $_ENV[$key] = $value;
        putenv("$key=$value");
    }
}

loadEnv(__DIR__ . "/../.env");

// Cargar configuración centralizada
require_once __DIR__ . '/config.php';
$centralConfig = get_central_config();

// Priorizar config.ini para variables comunes si están definidas
if (isset($centralConfig['common']['offline_threshold_minutes'])) {
    $_ENV['OFFLINE_THRESHOLD_MINUTES'] = $centralConfig['common']['offline_threshold_minutes'];
    putenv("OFFLINE_THRESHOLD_MINUTES=" . $centralConfig['common']['offline_threshold_minutes']);
}

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
    echo json_encode([
        "error" => sqlsrv_errors(),
        "db_connection_error" => true
    ]);
    exit();
}
?>