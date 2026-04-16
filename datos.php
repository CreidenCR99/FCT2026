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
 * MODO: maquinas_navegacion
 * Obtiene la lista completa de máquinas para la navegación del maestro.
 */
if ($modo === 'maquinas_navegacion') {
    $sql = "SELECT NumeroSerie, Descripcion, TipoMaquina, Notas, Organismo, Cliente, Provincia, 
                   MonitorizarEstado, MonitorizarAlertas, Actualizar 
            FROM Maquinas ORDER BY NumeroSerie";
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
    echo json_encode($data);
    sqlsrv_close($conn);
    exit;
}

/**
 * MODO: get_nombre
 * Recupera el nombre de un organismo, provincia o cliente por su código.
 */
if ($modo === 'get_nombre') {
    $tipo = $_GET['tipo'] ?? '';
    $codigo = $_GET['codigo'] ?? '';
    $tabla = '';
    if ($tipo === 'organismos') $tabla = 'Organismos';
    else if ($tipo === 'provincias') $tabla = 'Provincias';
    else if ($tipo === 'clientes') $tabla = 'Clientes';

    if ($tabla && $codigo) {
        $sql = "SELECT Nombre FROM $tabla WHERE codigo = ?";
        $stmt = sqlsrv_query($conn, $sql, array($codigo));
        $res = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC);
        echo json_encode(["nombre" => $res ? $res['Nombre'] : ""]);
        sqlsrv_free_stmt($stmt);
    } else {
        echo json_encode(["nombre" => ""]);
    }
    sqlsrv_close($conn);
    exit;
}

/**
 * MODO: verificar_ns
 * Comprueba si un número de serie ya existe en la tabla Maquinas.
 */
if ($modo === 'verificar_ns') {
    $ns = $_GET['ns'] ?? '';
    $sql = "SELECT COUNT(*) as cuenta FROM Maquinas WHERE NumeroSerie = ?";
    $stmt = sqlsrv_query($conn, $sql, array($ns));
    $row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC);
    echo json_encode(["exists" => $row['cuenta'] > 0]);
    sqlsrv_close($conn);
    exit;
}

/**
 * MODO: maestro
 * Obtiene el catálogo completo de una entidad (organismos, provincias o clientes)
 * devolviendo tanto el código como el nombre.
 */
if ($modo === 'maestro') {
    $tipo = $_GET['tipo'] ?? '';
    $tabla = '';
    if ($tipo === 'organismos') $tabla = 'Organismos';
    else if ($tipo === 'provincias') $tabla = 'Provincias';
    else if ($tipo === 'clientes') $tabla = 'Clientes';
    else if ($tipo === 'maquinas') { $sql = "SELECT NumeroSerie AS Codigo, Descripcion AS Nombre FROM Maquinas ORDER BY NumeroSerie"; }
    else { echo json_encode([]); exit; }

    if (!isset($sql)) { $sql = "SELECT codigo AS Codigo, Nombre FROM $tabla ORDER BY Nombre"; }
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
    echo json_encode($data);
    sqlsrv_close($conn);
    exit;
}

/**
 * MODO: errores
 * Obtiene el catálogo completo de errores configurados en el sistema.
 */
if ($modo === 'errores') {
    $sql = "SELECT Codigo, Descripcion FROM Errores ORDER BY Codigo";
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
    echo json_encode($data);
    sqlsrv_close($conn);
    exit;
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
                m.NumeroSerie,
                m.TipoMaquina
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

    $logsByNumeroSerie = [];

    if (!empty($numeroSeries)) {
        /**
         * Obtención de Logs optimizada.
         * En lugar de usar un IN clause con miles de parámetros (que fallaría por el límite de 2100 de sqlsrv),
         * aplicamos los mismos filtros de Organismo/Provincia que en la consulta de máquinas.
         */
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
                    INNER JOIN Maquinas m ON m.NumeroSerie = le.NumeroSerie
                    LEFT JOIN Organismos o ON o.codigo = m.organismo
                    LEFT JOIN Provincias p ON p.codigo = m.provincia
                    LEFT JOIN Errores e ON le.CodigoError = e.Codigo
                    WHERE le.Activo = 1
                      AND (? = '' OR o.Nombre = ?)
                      AND (? = '' OR p.Nombre = ?)
                    ORDER BY le.NumeroSerie, le.Id DESC";

        $stmtLogs = sqlsrv_query($conn, $sqlLogs, $paramsMachines);

        if ($stmtLogs === false) {
            http_response_code(500);
            echo json_encode(["error" => sqlsrv_errors()]);
            exit;
        }

        while ($logRow = sqlsrv_fetch_array($stmtLogs, SQLSRV_FETCH_ASSOC)) {
            $ns = $logRow['Numero_Serie'];
            unset($logRow['Numero_Serie']);
            if (!isset($logsByNumeroSerie[$ns])) {
                $logsByNumeroSerie[$ns] = [];
            }
            $logsByNumeroSerie[$ns][] = $logRow;
        }
        sqlsrv_free_stmt($stmtLogs);
    }

    // Agrupación manual de logs dentro de sus respectivas máquinas (Estructura jerárquica)
    foreach ($machines as &$machine) {
        $machine['Logs'] = $logsByNumeroSerie[$machine['NumeroSerie']] ?? [];
    }
    unset($machine); 

    // Enviamos las columnas una vez y los datos como arrays simples
    $cols = ["Organismo", "Provincia", "Cliente", "Descripcion", "UltimoControl", "MonitorizarEstado", "MonitorizarAlertas", "NumeroSerie", "TipoMaquina", "Logs"];
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
 * MODO: crear_maquina
 * Inserta o actualiza una máquina en la tabla Maquinas.
 */
if ($modo === 'crear_maquina') {
    $ns = $_POST['ns'] ?? '';
    $desc = $_POST['descripcion'] ?? '';
    $tipo = $_POST['tipo'] ?? '';
    $notas = $_POST['notas'] ?? '';
    $org = $_POST['organismo'] ?? '';
    $cli = $_POST['cliente'] ?? '';
    $prov = $_POST['provincia'] ?? '';

    if (empty($ns)) {
        http_response_code(400);
        echo json_encode(["error" => "El número de serie es obligatorio"]);
        exit;
    }

    // Validación de existencia de códigos maestros
    $tablas_maestras = [
        ['tabla' => 'Organismos', 'codigo' => $org, 'label' => 'Organismo'],
        ['tabla' => 'Clientes', 'codigo' => $cli, 'label' => 'Cliente'],
        ['tabla' => 'Provincias', 'codigo' => $prov, 'label' => 'Provincia']
    ];

    foreach ($tablas_maestras as $maestra) {
        $sqlCheck = "SELECT COUNT(*) as cuenta FROM " . $maestra['tabla'] . " WHERE codigo = ?";
        $stmtCheck = sqlsrv_query($conn, $sqlCheck, array($maestra['codigo']));
        if ($stmtCheck === false) {
            http_response_code(500);
            echo json_encode(["error" => sqlsrv_errors()]);
            exit;
        }
        $rowCheck = sqlsrv_fetch_array($stmtCheck, SQLSRV_FETCH_ASSOC);
        if ($rowCheck['cuenta'] == 0) {
            http_response_code(400);
            echo json_encode(["error" => "El código de " . $maestra['label'] . " (" . $maestra['codigo'] . ") no existe en la base de datos."]);
            exit;
        }
    }

    // Valores de bits (1 si el checkbox está marcado, 0 si no)
    $actualizar = isset($_POST['actualizar']) ? 1 : 0;
    $ultimoControl = null;
    $monEstado = isset($_POST['mon_estado']) ? 1 : 0;
    $monAlerta = isset($_POST['mon_alertas']) ? 1 : 0;

    $sql = "IF EXISTS (SELECT 1 FROM Maquinas WHERE NumeroSerie = ?)
                UPDATE Maquinas SET Descripcion=?, TipoMaquina=?, Notas=?, Organismo=?, Cliente=?, Provincia=?, Actualizar=?, MonitorizarEstado=?, MonitorizarAlertas=? WHERE NumeroSerie=?
            ELSE
                INSERT INTO Maquinas (NumeroSerie, Descripcion, TipoMaquina, Notas, Organismo, Cliente, Provincia, Actualizar, UltimoControl, MonitorizarEstado, MonitorizarAlertas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    $params = array(
        $ns, $desc, $tipo, $notas, $org, $cli, $prov, $actualizar, $monEstado, $monAlerta, $ns,
        $ns, $desc, $tipo, $notas, $org, $cli, $prov, $actualizar, $ultimoControl, $monEstado, $monAlerta
    );

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
 * MODO: eliminar_maquina
 * Elimina una máquina de la base de datos.
 */
if ($modo === 'eliminar_maquina') {
    $ns = $_POST['ns'] ?? '';

    if (empty($ns)) {
        http_response_code(400);
        echo json_encode(["error" => "No se ha proporcionado el número de serie"]);
        exit;
    }

    $sql = "DELETE FROM Maquinas WHERE NumeroSerie = ?";
    $stmt = sqlsrv_query($conn, $sql, array($ns));
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
 * MODO: crear_log
 * Inserta un nuevo registro de incidencia técnica. Valida que los campos obligatorios
 * (Número de Serie, Mensaje, Fecha y Hora) no estén vacíos antes de procesar el INSERT.
 */
if ($modo === 'crear_log') {
    $ns = $_POST['numero_serie'] ?? '';
    $codigo_error = $_POST['codigo_error'] ?? '';
    $tipo = $_POST['tipo_maquina'] ?? '';
    $resultado = $_POST['resultado'] ?? '';
    $observaciones = $_POST['observaciones'] ?? '';
    $fecha = $_POST['fecha'] ?? '';
    $hora = $_POST['hora'] ?? '';

    if (empty($ns) || empty($codigo_error) || empty($fecha) || empty($hora)) {
        http_response_code(400);
        echo json_encode(["error" => "Faltan campos obligatorios (Numero Serie, Codigo Error, Fecha, Hora)"]);
        exit;
    }

    // El campo Activo en Log_Errores es 1 para error, 0 para solucionado.
    // Invertimos el $resultado del UI (donde 0 es error y 1 es OK)
    $activo = ($resultado == '0') ? 1 : 0;
    $timestamp = str_replace('-', '', $fecha) . str_replace(':', '', $hora) . '00';

    $sql = "INSERT INTO Log_Errores 
            (NumeroSerie, TipoMaquina, TimeStamp, CodigoError, Activo, Observaciones) 
            VALUES (?, ?, ?, ?, ?, ?)";
    
    $params = array($ns, $tipo, $timestamp, $codigo_error, $activo, $observaciones);
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