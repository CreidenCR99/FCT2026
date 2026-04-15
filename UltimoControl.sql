UPDATE maquinas
SET UltimoControl = FORMAT(
    DATEADD(MINUTE, ABS(CHECKSUM(NEWID())) % 541, '20260415 06:00:00'), 
    'yyyyMMddHHmm'
);