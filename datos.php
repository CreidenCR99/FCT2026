<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header("Content-Type: application/json; charset=UTF-8");

$serverName = "";
$connectionInfo = array(
    "Database" => "",
    "UID" => "",
    "PWD" => "",
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

if ($modo === 'maquinas') {
    $organismo = trim($_GET['organismo'] ?? '');

    $sql = "SELECT
                o.Nombre AS Organismo,
                p.Nombre AS Provincia,
                ISNULL(c.Nombre, 'error') AS Cliente,
                m.Descripcion,
                m.UltimoControl
            FROM Maquinas m
            LEFT JOIN Organismos o ON o.codigo = m.organismo
            LEFT JOIN Provincias p ON p.codigo = m.provincia
            LEFT JOIN Clientes c ON c.codigo = m.cliente
            WHERE (? = '' OR o.Nombre = ?)
            ORDER BY o.Nombre, p.Nombre, c.Nombre, m.Descripcion";

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

echo json_encode(["error" => "Modo no válido"]);
sqlsrv_close($conn);
?>