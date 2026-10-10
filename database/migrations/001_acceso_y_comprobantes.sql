-- Migración transaccional para la estructura base en SQL Server.
ALTER TABLE vendedores ALTER COLUMN clave NVARCHAR(255) NOT NULL;
GO
ALTER TABLE vendedores ADD rol NVARCHAR(20) NOT NULL DEFAULT N'facturador' CHECK (rol IN (N'administrador',N'facturador')),
 bloqueado_permanente BIT NOT NULL DEFAULT 0, remoto BIT NOT NULL DEFAULT 0, motivo_bloqueo NVARCHAR(180) NOT NULL DEFAULT N'';
GO
ALTER TABLE productos ADD clasificacion NVARCHAR(12) NOT NULL DEFAULT N'gravada' CHECK (clasificacion IN (N'gravada',N'exenta',N'no_sujeta'));
GO
CREATE TABLE clientes (
 id INT IDENTITY(1,1) PRIMARY KEY, nombre NVARCHAR(160) NOT NULL, correo NVARCHAR(254) NOT NULL,
 nit NVARCHAR(20) NOT NULL DEFAULT N'', nrc NVARCHAR(20) NOT NULL DEFAULT N'', actividad NVARCHAR(160) NOT NULL DEFAULT N'',
 direccion NVARCHAR(250) NOT NULL DEFAULT N'', telefono NVARCHAR(30) NOT NULL DEFAULT N'', contribuyente BIT NOT NULL DEFAULT 0,
 created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
ALTER TABLE facturas ADD tipo NVARCHAR(3) NOT NULL DEFAULT N'CF' CHECK (tipo IN (N'CF',N'CCF')),
 cliente_id INT NULL REFERENCES clientes(id), cliente_snapshot NVARCHAR(MAX) NULL, emisor_snapshot NVARCHAR(MAX) NULL,
 condicion NVARCHAR(10) NOT NULL DEFAULT N'contado' CHECK (condicion IN (N'contado',N'credito')),
 forma_pago NVARCHAR(15) NOT NULL DEFAULT N'efectivo' CHECK (forma_pago IN (N'efectivo',N'tarjeta',N'transferencia')),
 estado NVARCHAR(10) NOT NULL DEFAULT N'emitida' CHECK (estado IN (N'emitida',N'anulada')), motivo_anulacion NVARCHAR(250) NULL,
 ventas_gravadas DECIMAL(12,2) NOT NULL DEFAULT 0, ventas_exentas DECIMAL(12,2) NOT NULL DEFAULT 0,
 ventas_no_sujetas DECIMAL(12,2) NOT NULL DEFAULT 0, solicitud_id CHAR(36) NULL;
GO
CREATE UNIQUE INDEX uq_factura_solicitud ON facturas(solicitud_id) WHERE solicitud_id IS NOT NULL;
GO
ALTER TABLE factura_detalles ADD descuento DECIMAL(12,2) NOT NULL DEFAULT 0,
 clasificacion NVARCHAR(12) NOT NULL DEFAULT N'gravada' CHECK (clasificacion IN (N'gravada',N'exenta',N'no_sujeta')),
 iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 13, subtotal DECIMAL(12,2) NULL, iva DECIMAL(12,2) NULL,
 comision_porcentaje DECIMAL(5,2) NULL, comision DECIMAL(12,2) NULL;
GO
CREATE TABLE horarios_acceso (
 id INT IDENTITY(1,1) PRIMARY KEY, vendedor_id INT NOT NULL REFERENCES vendedores(id), dia TINYINT NOT NULL CHECK (dia BETWEEN 1 AND 7),
 inicio TIME(0) NOT NULL, fin TIME(0) NOT NULL, CHECK (inicio < fin)
);
GO
INSERT INTO horarios_acceso (vendedor_id,dia,inicio,fin)
 SELECT v.id,d.dia,'08:00:00','17:00:00' FROM vendedores v CROSS JOIN (VALUES(1),(2),(3),(4),(5)) d(dia);
GO
CREATE TABLE bloqueos_acceso (
 id INT IDENTITY(1,1) PRIMARY KEY, vendedor_id INT NOT NULL REFERENCES vendedores(id),
 tipo NVARCHAR(12) NOT NULL CHECK (tipo IN (N'vacaciones',N'temporal')), inicio DATE NOT NULL, fin DATE NOT NULL,
 motivo NVARCHAR(180) NOT NULL, CHECK (inicio <= fin)
);
GO
CREATE TABLE festivos (fecha DATE PRIMARY KEY,nombre NVARCHAR(120) NOT NULL);
GO
CREATE TABLE sesiones (
 id BIGINT IDENTITY(1,1) PRIMARY KEY,vendedor_id INT NOT NULL REFERENCES vendedores(id),
 token_hash CHAR(64) NOT NULL UNIQUE,csrf CHAR(64) NOT NULL,ultima_actividad DATETIME2(0) NOT NULL
);
GO
CREATE TABLE intentos_acceso (
 id BIGINT IDENTITY(1,1) PRIMARY KEY,vendedor_id INT NULL REFERENCES vendedores(id),
 usuario NVARCHAR(50) NOT NULL,ip VARCHAR(45) NOT NULL,pais CHAR(2) NULL,fuente NVARCHAR(80) NOT NULL,
 motivo NVARCHAR(50) NOT NULL,fecha DATETIME2(0) NOT NULL
);
GO
CREATE INDEX idx_intentos_ip_fecha ON intentos_acceso(ip,fecha);
GO
CREATE INDEX idx_intentos_usuario_fecha ON intentos_acceso(usuario,fecha);
GO
CREATE TABLE correos (
 id BIGINT IDENTITY(1,1) PRIMARY KEY,factura_id BIGINT NULL REFERENCES facturas(id),intento_id BIGINT NULL REFERENCES intentos_acceso(id),
 tipo NVARCHAR(10) NOT NULL CHECK (tipo IN (N'factura',N'alerta')),destinatario NVARCHAR(254) NOT NULL,
 asunto NVARCHAR(160) NOT NULL,cuerpo NVARCHAR(MAX) NOT NULL,clave_unica CHAR(64) NULL,
 estado NVARCHAR(12) NOT NULL DEFAULT N'pendiente' CHECK (estado IN (N'pendiente',N'procesando',N'aceptado',N'fallido')),
 intentos INT NOT NULL DEFAULT 0 CHECK (intentos >= 0),proximo_intento DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
 error NVARCHAR(250) NULL,updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
CREATE UNIQUE INDEX uq_correo_clave ON correos(clave_unica) WHERE clave_unica IS NOT NULL;
GO
CREATE INDEX idx_correo_trabajo ON correos(estado,proximo_intento);
GO
CREATE TABLE auditoria (
 id BIGINT IDENTITY(1,1) PRIMARY KEY,vendedor_id INT NOT NULL REFERENCES vendedores(id),
 accion NVARCHAR(80) NOT NULL,referencia NVARCHAR(80) NOT NULL,fecha DATETIME2(0) NOT NULL
);
GO
