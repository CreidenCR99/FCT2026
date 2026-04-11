SELECT
    o.nombre AS Organismo,
    p.nombre AS Provincia,
    ISNULL(c.nombre, 'error') AS Cliente,
    m.Descripcion
FROM Maquinas m
LEFT JOIN Organismos o ON o.codigo = m.organismo
LEFT JOIN Provincias p ON p.codigo = m.provincia
LEFT JOIN Clientes c ON o.codigo = m.cliente
ORDER BY o.nombre, p.nombre, c.nombre, m.Descripcion;