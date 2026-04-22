<?php
/**
 * SicoLares Mapa API - Lógica Geográfica
 */

/**
 * MODO: paises
 * Recupera el catálogo de países configurados con sus coordenadas base
 * para alimentar el sistema de rotación automática.
 */
if ($modo === 'paises') {
    $sql = "SELECT id, Codigo, Nombre, Latitud, Longitud FROM Paises ORDER BY Nombre";
    $stmt = sqlsrv_query($conn, $sql);
    
    if ($stmt === false) {
        log_sql_error("Error cargando países", $sql);
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit();
    }

    $paises = [];
    while($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) { $paises[] = $row; }
    responder_json_si_cambia($paises, $conn);
}

/**
 * MODO: mapa_data
 * Endpoint crítico que consolida la información de provincias y el estado de las máquinas.
 * Calcula en tiempo real qué máquinas están offline o tienen errores activos para 
 * agruparlas por provincia y alimentar los marcadores del mapa.
 */
if ($modo === 'mapa_data') {
    $sqlProvincias = "SELECT Codigo, Nombre, Latitud, Longitud, Pais FROM Provincias";
    $stmtProv = sqlsrv_query($conn, $sqlProvincias);

    if ($stmtProv === false) {
        log_sql_error("Error cargando provincias", $sqlProvincias);
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit();
    }

    $provincias = [];
    while($row = sqlsrv_fetch_array($stmtProv, SQLSRV_FETCH_ASSOC)) {
        $provincias[$row['Codigo']] = [
            "nombre" => $row['Nombre'],
            "lat" => (float)$row['Latitud'],
            "lng" => (float)$row['Longitud'],
            "id_pais" => $row['Pais'],
            "counts" => ["verde" => 0, "naranja" => 0, "rojo" => 0] // Conectadas, Errores, Desconectadas
        ];
    }

    $sqlMaquinas = "SELECT m.provincia, m.NumeroSerie, m.Descripcion, m.UltimoControl, m.MonitorizarEstado, m.MonitorizarAlertas,
                    (SELECT COUNT(*) FROM Log_Errores le WHERE le.NumeroSerie = m.NumeroSerie AND le.Activo = 1) as Errores,
                    (SELECT STRING_AGG(le2.CodigoError, ', ') FROM Log_Errores le2 WHERE le2.NumeroSerie = m.NumeroSerie AND le2.Activo = 1) as Codigos
                    FROM Maquinas m 
                    WHERE m.MonitorizarEstado = 1 OR m.MonitorizarAlertas = 1";
    
    $stmtMaq = sqlsrv_query($conn, $sqlMaquinas);
    $ahora = new DateTime();

    if ($stmtMaq === false) {
        log_sql_error("Error cargando máquinas", $sqlMaquinas);
        http_response_code(500);
        echo json_encode(["error" => sqlsrv_errors()]);
        exit();
    }

    $alertas = [];
    while($m = sqlsrv_fetch_array($stmtMaq, SQLSRV_FETCH_ASSOC)) {
        $codProv = $m['provincia'];
        if (!isset($provincias[$codProv])) continue;

        $monitorizaEstado = (int)($m['MonitorizarEstado'] ?? 0);
        $monitorizaAlertas = (int)($m['MonitorizarAlertas'] ?? 0);

        $isOffline = false;
        if ($monitorizaEstado === 1) {
            if ($m['UltimoControl']) {
                $fechaUC = DateTime::createFromFormat('YmdHi', substr($m['UltimoControl'], 0, 12));
                if ($fechaUC) {
                    $diff = ($ahora->getTimestamp() - $fechaUC->getTimestamp()) / 60;
                    if ($diff > 10) $isOffline = true;
                } else { $isOffline = true; }
            } else { $isOffline = true; }
        }

        $numErrores = (int)($m['Errores'] ?? 0);
        if ($monitorizaAlertas === 1 && $numErrores > 0) {
            $alertas[] = [
                "sn" => $m['NumeroSerie'] . "_err_" . $numErrores,
                "nombre" => $m['Descripcion'], "status" => "naranja",
                "provincia" => $provincias[$codProv]['nombre'], "codigoError" => $m['Codigos'] ?? 'ERROR'
            ];
            $provincias[$codProv]['counts']['naranja'] += $numErrores;
        }

        if ($monitorizaEstado === 1 && $isOffline) {
            $alertas[] = [
                "sn" => $m['NumeroSerie'] . "_offline",
                "nombre" => $m['Descripcion'], "status" => "rojo",
                "provincia" => $provincias[$codProv]['nombre'], "codigoError" => "CONEXIÓN"
            ];
            $provincias[$codProv]['counts']['rojo']++;
        } elseif ($monitorizaEstado === 1) {
            $provincias[$codProv]['counts']['verde']++;
        }
    }

    responder_json_si_cambia(["provincias" => array_values($provincias), "alertas" => $alertas], $conn);
}
?>