-- SQL Server 2019 o posterior. Ejecutar en la base elegida.
CREATE TABLE sucursales (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL,
    direccion NVARCHAR(180) NOT NULL,
    activo BIT NOT NULL DEFAULT 1,
    created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE vendedores (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(120) NOT NULL,
    usuario NVARCHAR(50) NOT NULL UNIQUE,
    clave NVARCHAR(100) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    activo BIT NOT NULL DEFAULT 1,
    created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE productos (
    id INT IDENTITY(1,1) PRIMARY KEY,
    codigo NVARCHAR(20) NULL,
    descripcion NVARCHAR(160) NOT NULL,
    precio DECIMAL(12,2) NOT NULL,
    activo BIT NOT NULL DEFAULT 1,
    created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE facturas (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    numero NVARCHAR(20) NULL,
    fecha DATE NOT NULL,
    vendedor_id INT NOT NULL,
    sucursal_id INT NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 13.00,
    iva DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    comision_porcentaje DECIMAL(5,2) NOT NULL,
    comision DECIMAL(12,2) NOT NULL,
    created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_factura_vendedor FOREIGN KEY (vendedor_id) REFERENCES vendedores(id),
    CONSTRAINT fk_factura_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales(id)
);
GO

CREATE TABLE factura_detalles (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    factura_id BIGINT NOT NULL,
    producto_id INT NOT NULL,
    codigo_producto NVARCHAR(20) NOT NULL,
    descripcion NVARCHAR(160) NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    total_linea DECIMAL(12,2) NOT NULL,
    CONSTRAINT fk_detalle_factura FOREIGN KEY (factura_id) REFERENCES facturas(id),
    CONSTRAINT fk_detalle_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
);
GO

INSERT INTO sucursales (nombre, direccion) VALUES
(N'Sucursal Central', N'San Salvador'),
(N'Sucursal Santa Ana', N'Santa Ana');
GO

-- Usuarios de demostración inactivos: el administrador debe asignar nuevas contraseñas.
INSERT INTO vendedores (nombre, usuario, clave, fecha_nacimiento, activo) VALUES
(N'Vendedor de Prueba', N'vendedor', N'', N'2000-09-07', 0),
(N'Caleb Ortiz', N'caleb.ortiz', N'', N'2007-01-18', 0),
(N'Ivania Guerrero', N'ivania.guerrero', N'', N'2007-08-06', 0),
(N'Ana Carrillo', N'ana.carrillo', N'', N'2007-03-20', 0),
(N'Vendedor 1', N'vendedor1', N'', N'1994-09-27', 0),
(N'Vendedor 2', N'vendedor2', N'', N'1975-09-28', 0),
(N'Vendedor 3', N'vendedor3', N'', N'2003-09-29', 0);
GO

INSERT INTO productos (codigo, descripcion, precio) VALUES
(N'PROD-000001', N'Teclado inalámbrico', 245.00),
(N'PROD-000002', N'Mouse ergonómico', 175.50),
(N'PROD-000003', N'Monitor de 24 pulgadas', 1450.00),
(N'PROD-000004', N'Auriculares inalámbricos con micrófono', 389.90),
(N'PROD-000005', N'Cámara web Full HD', 325.00),
(N'PROD-000006', N'Memoria USB de 128 GB', 149.75),
(N'PROD-000007', N'Disco sólido SSD de 1 TB', 725.00),
(N'PROD-000008', N'Computadora portátil de 15 pulgadas', 4899.00),
(N'PROD-000009', N'Tableta gráfica con lápiz digital', 1195.50),
(N'PROD-000010', N'Bocina Bluetooth portátil', 279.99),
(N'PROD-000011', N'Adaptador multipuerto USB-C', 235.00),
(N'PROD-000012', N'Router inalámbrico de doble banda', 499.50),
(N'PROD-000013', N'Impresora multifuncional a color', 1849.00),
(N'PROD-000014', N'Teléfono inteligente de 128 GB', 3299.00),
(N'PROD-000015', N'Reloj inteligente con GPS', 1399.90);
GO

CREATE UNIQUE INDEX uq_producto_codigo ON productos(codigo) WHERE codigo IS NOT NULL;
GO
CREATE UNIQUE INDEX uq_factura_numero ON facturas(numero) WHERE numero IS NOT NULL;
GO
