ALTER TABLE auditoria ADD detalles NVARCHAR(MAX) NULL;
GO
CREATE INDEX idx_auditoria_fecha ON auditoria(fecha,id);
GO
