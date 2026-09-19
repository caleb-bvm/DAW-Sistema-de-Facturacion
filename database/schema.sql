CREATE DATABASE IF NOT EXISTS facturacion_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER DATABASE facturacion_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE facturacion_db;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE sucursales (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(180) NOT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vendedores (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    clave VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE productos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NULL,
    descripcion VARCHAR(160) NOT NULL,
    precio DECIMAL(12,2) UNSIGNED NOT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE facturas (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    numero VARCHAR(20) UNIQUE NULL,
    fecha DATE NOT NULL,
    vendedor_id INT UNSIGNED NOT NULL,
    sucursal_id INT UNSIGNED NOT NULL,
    subtotal DECIMAL(12,2) UNSIGNED NOT NULL,
    iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 13.00,
    iva DECIMAL(12,2) UNSIGNED NOT NULL,
    total DECIMAL(12,2) UNSIGNED NOT NULL,
    comision_porcentaje DECIMAL(5,2) UNSIGNED NOT NULL,
    comision DECIMAL(12,2) UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_factura_vendedor FOREIGN KEY (vendedor_id) REFERENCES vendedores(id),
    CONSTRAINT fk_factura_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales(id)
);

CREATE TABLE factura_detalles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    factura_id BIGINT UNSIGNED NOT NULL,
    producto_id INT UNSIGNED NOT NULL,
    codigo_producto VARCHAR(20) NOT NULL,
    descripcion VARCHAR(160) NOT NULL,
    cantidad INT UNSIGNED NOT NULL,
    precio_unitario DECIMAL(12,2) UNSIGNED NOT NULL,
    total_linea DECIMAL(12,2) UNSIGNED NOT NULL,
    CONSTRAINT fk_detalle_factura FOREIGN KEY (factura_id) REFERENCES facturas(id),
    CONSTRAINT fk_detalle_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
);

INSERT INTO sucursales (nombre, direccion) VALUES
('Sucursal Central', 'San Salvador'),
('Sucursal Santa Ana', 'Santa Ana');

-- Usuarios iniciales. Todos utilizan la contraseña temporal: password
INSERT INTO vendedores (nombre, usuario, clave, fecha_nacimiento) VALUES
('Vendedor de Prueba', 'vendedor', 'password', '2000-09-07'),
('Caleb Ortiz', 'caleb.ortiz', 'password', '2007-01-18'),
('Ivania Guerrero', 'ivania.guerrero', 'password', '2007-08-06'),
('Ana Carrillo', 'ana.carrillo', 'password', '2007-03-20');

INSERT INTO productos (codigo, descripcion, precio) VALUES
('PROD-000001', 'Teclado inalámbrico', 245.00),
('PROD-000002', 'Mouse ergonómico', 175.50),
('PROD-000003', 'Monitor de 24 pulgadas', 1450.00),
('PROD-000004', 'Auriculares inalámbricos con micrófono', 389.90),
('PROD-000005', 'Cámara web Full HD', 325.00),
('PROD-000006', 'Memoria USB de 128 GB', 149.75),
('PROD-000007', 'Disco sólido SSD de 1 TB', 725.00),
('PROD-000008', 'Computadora portátil de 15 pulgadas', 4899.00),
('PROD-000009', 'Tableta gráfica con lápiz digital', 1195.50),
('PROD-000010', 'Bocina Bluetooth portátil', 279.99),
('PROD-000011', 'Adaptador multipuerto USB-C', 235.00),
('PROD-000012', 'Router inalámbrico de doble banda', 499.50),
('PROD-000013', 'Impresora multifuncional a color', 1849.00),
('PROD-000014', 'Teléfono inteligente de 128 GB', 3299.00),
('PROD-000015', 'Reloj inteligente con GPS', 1399.90);
