# Sistema de Facturacion

Sistema académico de facturación desarrollado con JavaScript y MySQL. Toda la lógica, validaciones y cálculos se realizan en JavaScript. PHP funciona únicamente como puente de conexión con la base de datos.

## Instalación en XAMPP

1. Copia esta carpeta dentro de `C:\xampp\htdocs`.
2. Inicia Apache y MySQL desde el panel de XAMPP.
3. Abre phpMyAdmin e importa `database/schema.sql`.
4. Si MySQL usa otras credenciales, actualiza `config/database.php`.
5. Abre el proyecto desde `http://localhost/facturacion/`.

También puedes abrir `index.html` con Live Server en `http://127.0.0.1:5500`. Apache y MySQL deben permanecer iniciados porque las consultas a la base de datos se envían a `http://localhost/facturacion/api/index.php`.

Acceso inicial:

- Usuario: `vendedor`
- Contraseña: `password`

## Reglas principales

- IVA: 13 %.
- La comisión se calcula sobre el subtotal sin IVA.
- Moneda: dólar estadounidense (USD).
- 1 % hasta $100; 2 % hasta $1,000; 3 % hasta $2,000; 4 % desde $2,000.01.
- Facturas: `FAC-00000001`.
- Productos: `PROD-000001`.
- Los correlativos son permanentes y se generan con JavaScript.

La opción **Imprimir o guardar PDF** utiliza el diálogo del navegador, donde se elige **Guardar como PDF**.

## Distribución de responsabilidades

- `assets/js/principal.js`: controlador principal y navegación de la interfaz.
- `assets/js/base-datos.js`: comunicación con la conexión PHP.
- `assets/js/calculos/`: una clase independiente para cada cálculo.
- `assets/js/utilidades/`: fechas y formatos reutilizables.
- `api/index.php`: consultas de lectura y escritura en MySQL, sin cálculos de facturación.
- `database/schema.sql`: estructura y datos iniciales.

## Polimorfismo

`Calculo.js` define el método común `calcular()`. Las clases de IVA, subtotal, comisión, edad, cumpleaños y correlativos heredan ese contrato y proporcionan su propia implementación. `CalculoFactura.js` puede coordinarlas sin conocer las fórmulas internas de cada clase.
