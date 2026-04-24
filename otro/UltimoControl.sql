UPDATE maquinas
SET UltimoControl = FORMAT(
    DATEADD(MINUTE, ABS(CHECKSUM(NEWID())) % 7 * 60 + 1, '20260422 08:00:00'), 
    'yyyyMMddHHmm'
);