<?php
/**
 * SicoLares - Backend del Mapa de Monitoreo
 * Gestión de datos geográficos, estados de máquinas y notificaciones en tiempo real.
 */

error_reporting(E_ALL);
ini_set("display_errors", 0); // Evita que errores de PHP rompan el JSON
header("Content-Type: application/json; charset=UTF-8");

// Intentamos habilitar la compresión Brotli (más eficiente que Gzip para texto/JSON).
// Si la extensión no está cargada o el cliente no lo soporta, volvemos a Gzip.
$supportsBrotli =
    extension_loaded("brotli") &&
    isset($_SERVER["HTTP_ACCEPT_ENCODING"]) &&
    strpos($_SERVER["HTTP_ACCEPT_ENCODING"], "br") !== false;

if ($supportsBrotli) {
    ob_start(function ($buffer) {
        header("Content-Encoding: br");
        header("Vary: Accept-Encoding");
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
function responder_json_si_cambia($data, $conn = null)
{
    $json = json_encode($data);
    $etag = md5($json);

    // Obligamos a revalidar el caché en cada petición mediante headers estándar
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
 * loadEnv
 * 
 * Carga variables de entorno desde un archivo .env local.
 * Parsea cada línea, ignorando comentarios (#) y líneas vacías, para asignar
 * valores a $_ENV y al entorno del sistema mediante putenv(). Esto permite
 * desacoplar las credenciales de la base de datos del código fuente.
 */
function loadEnv($path)
{
    if (!file_exists($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), "#") === 0) {
            continue;
        }
        $parts = explode("=", $line, 2);
        if (count($parts) !== 2) continue;
        $_ENV[trim($parts[0])] = trim($parts[1]);
        putenv(trim($parts[0]) . "=" . trim($parts[1]));
    }
}

loadEnv(__DIR__ . "/.env");

/**
 * Configuración de la conexión a SQL Server.
 * Recupera las constantes de entorno definidas en el .env (Servidor, BD, Usuario y Password)
 * para inicializar el objeto de conexión mediante el driver sqlsrv.
 */
$serverName = getenv("DB_SERVER");
$connectionInfo = [
    "Database" => getenv("DB_DATABASE"),
    "UID" => getenv("DB_USER"),
    "PWD" => getenv("DB_PASS"),
    "CharacterSet" => "UTF-8",
];

$conn = sqlsrv_connect($serverName, $connectionInfo);

// Verificación de integridad de la conexión inicial
if ($conn === false) {
    http_response_code(500);
    echo json_encode(["error" => sqlsrv_errors()]);
    exit();
}

$modo = $_GET['modo'] ?? '';

// --- SECCIÓN: FUNCIONES AUXILIARES ---

// --- SECCIÓN: CONSULTAS MAESTRAS ---

/**
 * Obtiene el listado de países disponibles para la rotación.
 */
if ($modo === 'paises') {
    $sql = "SELECT id, Codigo, Nombre, Latitud, Longitud FROM Paises ORDER BY Nombre";
    $stmt = sqlsrv_query($conn, $sql);
    
    if ($stmt === false) {
        http_response_code(500);
        responder_json_si_cambia(["error" => sqlsrv_errors()], $conn);
    }

    $paises = [];
    while($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $paises[] = $row;
    }
    responder_json_si_cambia($paises, $conn);
}

// --- SECCIÓN: PROCESAMIENTO DE ESTADOS ---

/**
 * Obtiene el estado consolidado por provincia para pintar los puntos en el mapa.
 */
if ($modo === 'mapa_data') {
    // 1. Consultamos provincias con sus coordenadas
    $sqlProvincias = "SELECT Codigo, Nombre, Latitud, Longitud, Pais FROM Provincias";
    $stmtProv = sqlsrv_query($conn, $sqlProvincias);

    if ($stmtProv === false) {
        http_response_code(500);
        responder_json_si_cambia(["error" => sqlsrv_errors()], $conn);
    }

    $provincias = [];
    while($row = sqlsrv_fetch_array($stmtProv, SQLSRV_FETCH_ASSOC)) {
        $provincias[$row['Codigo']] = [
            "nombre" => $row['Nombre'],
            "lat" => (float)$row['Latitud'],
            "lng" => (float)$row['Longitud'],
            "id_pais" => $row['Pais'],
            "counts" => [
                "verde"   => 0,
                "naranja" => 0,
                "rojo"    => 0
            ]
        ];
    }

    // 2. Consultamos máquinas y sus errores para determinar el color de la provincia
    // Lógica: Rojo si hay alguna offline (>10m), Naranja si hay errores activos, Verde si todo OK.
    $sqlMaquinas = "SELECT m.provincia, m.NumeroSerie, m.Descripcion, m.UltimoControl, m.MonitorizarAlertas,
                    (SELECT COUNT(*) FROM Log_Errores le WHERE le.NumeroSerie = m.NumeroSerie AND le.Activo = 1) as Errores
                    FROM Maquinas m 
                    WHERE m.MonitorizarEstado = 1";
    
    $stmtMaq = sqlsrv_query($conn, $sqlMaquinas);
    $ahora = new DateTime();

    if ($stmtMaq === false) {
        http_response_code(500);
        responder_json_si_cambia(["error" => sqlsrv_errors()], $conn);
    }

    $alertas = [];
    while($m = sqlsrv_fetch_array($stmtMaq, SQLSRV_FETCH_ASSOC)) {
        $codProv = $m['provincia'];
        if (!isset($provincias[$codProv])) continue;

        // 1. Determinar estado de conexión (Rojo vs Verde)
        $isOffline = false;
        if ($m['UltimoControl']) {
            $uc = $m['UltimoControl'];
            // Sincronización con formato de 14 dígitos (YYYYMMDDHHMMSS)
            $fechaUC = DateTime::createFromFormat('YmdHi', substr($uc, 0, 12));
            if ($fechaUC) {
                $diff = ($ahora->getTimestamp() - $fechaUC->getTimestamp()) / 60;
                if ($diff > 10) $isOffline = true;
            } else {
                $isOffline = true;
            }
        } else {
            $isOffline = true;
        }

        // 2. Conteo de errores activos (Naranja)
        // Sumamos el total de errores de la máquina a la provincia si se monitorizan alertas
        $numErrores = (int)($m['Errores'] ?? 0);
        $monitorizaAlertas = (int)($m['MonitorizarAlertas'] ?? 0);

        if ($monitorizaAlertas === 1 && $numErrores > 0) {
            $provincias[$codProv]['counts']['naranja'] += $numErrores;
            
            // Notificación de errores
            $alertas[] = [
                "sn" => $m['NumeroSerie'] . "_err_" . $numErrores, // SN dinámico para disparar notificación si cambia el conteo
                "nombre" => $m['Descripcion'],
                "status" => "naranja",
                "provincia" => $provincias[$codProv]['nombre']
            ];
        }

        // 3. Conteo de Conectividad (Rojo / Verde)
        if ($isOffline) {
            $provincias[$codProv]['counts']['rojo']++;
            // Notificación de desconexión
            $alertas[] = [
                "sn" => $m['NumeroSerie'] . "_offline",
                "nombre" => $m['Descripcion'],
                "status" => "rojo",
                "provincia" => $provincias[$codProv]['nombre']
            ];
        } else {
            // Solo contamos como Verde (Operativo) si no tiene errores y está online
            if ($numErrores === 0 || $monitorizaAlertas === 0) {
                $provincias[$codProv]['counts']['verde']++;
            }
        }
    }

    responder_json_si_cambia([
        "provincias" => array_values($provincias),
        "alertas" => $alertas
    ], $conn);
}
?>