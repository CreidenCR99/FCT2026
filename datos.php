<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header("Content-Type: application/json; charset=UTF-8");

// Intentamos habilitar la compresión Brotli (más eficiente que Gzip para texto/JSON).
// Si la extensión no está cargada o el cliente no lo soporta, volvemos a Gzip.
$supportsBrotli = extension_loaded('brotli') && 
                  isset($_SERVER['HTTP_ACCEPT_ENCODING']) && 
                  strpos($_SERVER['HTTP_ACCEPT_ENCODING'], 'br') !== false;

if ($supportsBrotli) {
    ob_start(function($buffer) {
        header('Content-Encoding: br');
        header('Vary: Accept-Encoding');
        return brotli_compress($buffer, 6); // Nivel 6: balance óptimo entre uso de CPU y tasa de compresión
    });
} else {
    if (!ob_start("ob_gzhandler")) {
        ob_start();
    }
}

/**
 * Envía una respuesta JSON optimizada mediante ETags.
 * Si los datos no han cambiado desde la última petición, devuelve 304 Not Modified,
 * ahorrando ancho de banda y recursos de red.
 */
function responder_json_si_cambia($data, $conn = null) {
    $json = json_encode($data);
    $etag = md5($json);
    
    // Obligamos a revalidar el caché en cada petición mediante headers estándar
    header("ETag: \"$etag\"");
    header("Cache-Control: no-cache, must-revalidate");

    if (isset($_SERVER['HTTP_IF_NONE_MATCH'])) {
        $etag_cliente = trim($_SERVER['HTTP_IF_NONE_MATCH'], '"');
        if ($etag_cliente === $etag) {
            if ($conn) sqlsrv_close($conn);
            http_response_code(304);
            exit;
        }
    }

    echo $json;
    if ($conn) sqlsrv_close($conn);
    exit;
}

/**
 * Carga variables de entorno desde un archivo .env local.
 * Parsea cada línea, ignorando comentarios (#) y líneas vacías, para asignar
 * valores a $_ENV y al entorno del sistema mediante putenv(). Esto permite
 * desacoplar las credenciales de la base de datos del código fuente.
 */
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

/**
 * Configuración de la conexión a SQL Server.
 * Recupera las constantes de entorno definidas en el .env (Servidor, BD, Usuario y Password)
 * para inicializar el objeto de conexión mediante el driver sqlsrv.
 */
$serverName = getenv('DB_SERVER');
$connectionInfo = array(
    "Database" => getenv('DB_DATABASE'),
    "UID" => getenv('DB_USER'),
    "PWD" => getenv('DB_PASS'),
    "CharacterSet" => "UTF-8"
);

$conn = sqlsrv_connect($serverName, $connectionInfo);

// Verificación de integridad de la conexión inicial
if ($conn === false) {
    http_response_code(500);
    echo json_encode(["error" => sqlsrv_errors()]);
    exit;
}

// Limpiamos el modo de posibles espacios o saltos de línea accidentales
$modo = trim($_GET['modo'] ?? '');

/**
 * MODO: organismos
 * Ejecuta una consulta DISTINCT para obtener todos los organismos que poseen máquinas,
 * permitiendo llenar los filtros dinámicos del frontend.
 */
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

    sqlsrv_free_stmt($stmt);
    responder_json_si_cambia($data, $conn);
}

/**
 * MODO: provincias
 * Recupera las provincias asociadas a un organismo opcional. Utiliza parámetros
 * de consulta (?) para neutralizar intentos de inyección SQL en la entrada del usuario.
 */
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

    sqlsrv_free_stmt($stmt);
    responder_json_si_cambia($data, $conn);
}

/**
 * MODO: maquinas
 * Consulta principal del sistema. Realiza un LEFT JOIN entre Maquinas y sus tablas maestras.
 * Aplica filtros dinámicos de Organismo y Provincia según lo solicitado por el frontend.
 */
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
    $numeroSeries = []; // Colección de números de serie para filtrar los logs en la siguiente consulta
    while ($row = sqlsrv_fetch_array($stmtMachines, SQLSRV_FETCH_ASSOC)) {
        $machines[] = $row;
        $numeroSeries[] = $row['NumeroSerie'];
    }
    sqlsrv_free_stmt($stmtMachines);

    // Si no hay maquinas, se devuelve antes
    if (empty($machines)) {
        echo json_encode([]);
        sqlsrv_close($conn);
        exit;
    }

    /**
     * Obtención de Logs mediante el operador IN.
     * Se construye dinámicamente una cadena de marcadores de posición (?) igual 
     * a la cantidad de máquinas encontradas para realizar una búsqueda eficiente.
     */
    $placeholders = implode(',', array_fill(0, count($numeroSeries), '?'));
    $sqlLogs = "SELECT
                    le.Id as ID,
                    le.NumeroSerie as Numero_Serie,
                    le.TipoMaquina,
                    le.TimeStamp,
                    le.CodigoError,
                    le.Activo,
                    le.Observaciones,
                    e.Descripcion as Mensaje
                FROM Log_Errores le
                LEFT JOIN Errores e ON le.CodigoError = e.Codigo
                WHERE le.NumeroSerie IN ($placeholders) 
                  AND le.Activo = 1
                ORDER BY le.NumeroSerie, le.Id DESC";

    $stmtLogs = sqlsrv_query($conn, $sqlLogs, $numeroSeries);

    if ($stmtLogs === false) {
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit;
    }

    $logsByNumeroSerie = [];
    while ($logRow = sqlsrv_fetch_array($stmtLogs, SQLSRV_FETCH_ASSOC)) {
        $ns = $logRow['Numero_Serie'];
        // Eliminamos el NumeroSerie del log individual para no repetir datos
        unset($logRow['Numero_Serie']);
        if (!isset($logsByNumeroSerie[$ns])) {
            $logsByNumeroSerie[$ns] = [];
        }
        $logsByNumeroSerie[$ns][] = $logRow;
    }
    sqlsrv_free_stmt($stmtLogs);

    // Agrupación manual de logs dentro de sus respectivas máquinas (Estructura jerárquica)
    foreach ($machines as &$machine) {
        $machine['Logs'] = $logsByNumeroSerie[$machine['NumeroSerie']] ?? [];
    }
    unset($machine); 

    // Enviamos las columnas una vez y los datos como arrays simples
    $cols = ["Organismo", "Provincia", "Cliente", "Descripcion", "UltimoControl", "MonitorizarEstado", "MonitorizarAlertas", "NumeroSerie", "Logs"];
    $rows = [];
    foreach ($machines as $m) {
        $row = [];
        foreach ($cols as $c) {
            $val = $m[$c] ?? ($c === 'Logs' ? [] : null);
            // Tipado: Convertimos monitores a int para ahorrar quotes en JSON
            if ($c === 'MonitorizarEstado' || $c === 'MonitorizarAlertas') {
                $val = (int)$val;
            }
            $row[] = $val;
        }
        $rows[] = $row;
    }

    responder_json_si_cambia(["cols" => $cols, "rows" => $rows], $conn);
}

/**
 * MODO: crear_log
 * Inserta un nuevo registro de incidencia técnica. Valida que los campos obligatorios
 * (Número de Serie, Mensaje, Fecha y Hora) no estén vacíos antes de procesar el INSERT.
 */
if ($modo === 'crear_log') {
    $ns = $_POST['numero_serie'] ?? '';
    $mensaje = $_POST['mensaje'] ?? '';
    $resultado = $_POST['resultado'] ?? '';
    $observaciones = $_POST['observaciones'] ?? '';
    $fecha = $_POST['fecha'] ?? '';
    $hora = $_POST['hora'] ?? '';

    if (empty($ns) || empty($mensaje) || empty($fecha) || empty($hora)) {
        http_response_code(400);
        echo json_encode(["error" => "Faltan campos obligatorios (Numero Serie, Mensaje, Fecha, Hora)"]);
        exit;
    }

    // El campo Activo en Log_Errores es 1 para error, 0 para solucionado.
    // Invertimos el $resultado del UI (donde 0 es error y 1 es OK)
    $activo = ($resultado == '0') ? 1 : 0;
    $timestamp = str_replace('-', '', $fecha) . str_replace(':', '', $hora) . '00';

    $sql = "INSERT INTO Log_Errores 
            (NumeroSerie, TipoMaquina, TimeStamp, CodigoError, Activo, Observaciones) 
            VALUES (?, ?, ?, ?, ?, ?)";
    
    // Nota: TipoMaquina se deja vacío o se podría recuperar de la tabla Maquinas si fuera necesario
    $params = array($ns, '', $timestamp, $mensaje, $activo, $observaciones);
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

/**
 * MODO: actualizar_log
 * Actualiza el estado (Solucionado/Sin Solucionar) y las notas de un log específico mediante su ID.
 */
if ($modo === 'actualizar_log') {
    $id = $_POST['id_log'] ?? '';
    $resultado = $_POST['resultado'] ?? '';
    $observaciones = $_POST['observaciones'] ?? '';

    if (empty($id)) {
        http_response_code(400);
        echo json_encode(["error" => "ID de log no proporcionado"]);
        exit;
    }

    // Mapeo: UI resultado 0 (Error) -> Activo 1. UI resultado 1 (OK) -> Activo 0.
    $activo = ($resultado == '0') ? 1 : 0;

    $sql = "UPDATE Log_Errores 
            SET Activo = ?, 
                Observaciones = ? 
            WHERE Id = ?";
    
    $params = array($activo, $observaciones, $id);
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