<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header("Content-Type: application/json; charset=UTF-8");

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

    echo json_encode($data);
    sqlsrv_free_stmt($stmt);
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

    echo json_encode($data);
    sqlsrv_free_stmt($stmt);
    sqlsrv_close($conn);
    exit;
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

    // Agrupación manual de logs dentro de sus respectivas máquinas (Estructura jerárquica)
    foreach ($machines as &$machine) {
        $machine['Logs'] = $logsByNumeroSerie[$machine['NumeroSerie']] ?? [];
    }
    unset($machine); 

    echo json_encode($machines);
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

    // Se asume la existencia de columnas Fecha y Hora en la tabla Log_Actualizaciones
    $sql = "INSERT INTO Log_Actualizaciones 
            (Numero_Serie, Mensaje, ResultadoCorrecto, Observaciones, Fecha, Hora) 
            VALUES (?, ?, ?, ?, ?, ?)";
    
    $params = array($ns, $mensaje, $resultado, $observaciones, $fecha, $hora);
    $stmt = sqlsrv_query($conn, $sql, $params);

    if ($stmt === false) {
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit;
    }

    // Actualización de MonitorizarAlertas en la tabla Maquinas
    if ($resultado == '0') {
        // Si el log es un error activo, marcamos la máquina con alerta (MonitorizarAlertas = 0)
        sqlsrv_query($conn, "UPDATE Maquinas SET MonitorizarAlertas = 0 WHERE NumeroSerie = ?", array($ns));
    } else {
        // Si el log es solucionado, comprobamos si quedan otros errores pendientes para esta máquina
        $sqlCheck = "SELECT COUNT(*) as Total FROM Log_Actualizaciones WHERE Numero_Serie = ? AND (ResultadoCorrecto = 0 OR ResultadoCorrecto IS NULL)";
        $stmtCheck = sqlsrv_query($conn, $sqlCheck, array($ns));
        if ($stmtCheck !== false) {
            $resCheck = sqlsrv_fetch_array($stmtCheck, SQLSRV_FETCH_ASSOC);
            if ($resCheck['Total'] == 0) {
                // No hay más errores activos: quitamos la alerta (MonitorizarAlertas = 1)
                sqlsrv_query($conn, "UPDATE Maquinas SET MonitorizarAlertas = 1 WHERE NumeroSerie = ?", array($ns));
            }
            sqlsrv_free_stmt($stmtCheck);
        }
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

    // Obtenemos el Numero_Serie antes de actualizar para poder verificar el estado de la máquina después
    $sqlNS = "SELECT Numero_Serie FROM Log_Actualizaciones WHERE ID = ?";
    $stmtNS = sqlsrv_query($conn, $sqlNS, array($id));
    $ns = null;
    if ($stmtNS !== false && $rowNS = sqlsrv_fetch_array($stmtNS, SQLSRV_FETCH_ASSOC)) {
        $ns = $rowNS['Numero_Serie'];
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

    // Actualización de MonitorizarAlertas en la tabla Maquinas
    if ($ns) {
        if ($resultado == '0') {
            // Si se marca como no solucionado, activamos la alerta (MonitorizarAlertas = 0)
            sqlsrv_query($conn, "UPDATE Maquinas SET MonitorizarAlertas = 0 WHERE NumeroSerie = ?", array($ns));
        } else {
            // Si se marca como solucionado, verificamos si es el último error pendiente
            $sqlCheck = "SELECT COUNT(*) as Total FROM Log_Actualizaciones WHERE Numero_Serie = ? AND (ResultadoCorrecto = 0 OR ResultadoCorrecto IS NULL)";
            $stmtCheck = sqlsrv_query($conn, $sqlCheck, array($ns));
            if ($stmtCheck !== false) {
                $resCheck = sqlsrv_fetch_array($stmtCheck, SQLSRV_FETCH_ASSOC);
                if ($resCheck['Total'] == 0) {
                    // No quedan errores: volvemos a poner MonitorizarAlertas en 1 (true)
                    sqlsrv_query($conn, "UPDATE Maquinas SET MonitorizarAlertas = 1 WHERE NumeroSerie = ?", array($ns));
                }
                sqlsrv_free_stmt($stmtCheck);
            }
        }
    }

    echo json_encode(["success" => true]);
    sqlsrv_close($conn);
    exit;
}

echo json_encode(["error" => "Modo no valido"]);
sqlsrv_close($conn);
?>