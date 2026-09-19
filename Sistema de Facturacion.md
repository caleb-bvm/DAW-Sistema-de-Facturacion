# Guía esencial

## 1. Tecnologías utilizadas

- HTML: estructura de la interfaz.
- CSS: diseño Material Design 3 Expressive y adaptación móvil.
- JavaScript modular: interfaz, validaciones y todos los cálculos.
- PHP: puente entre JavaScript y MySQL.
- MySQL/MariaDB: almacenamiento permanente.
- XAMPP:
  - Apache ejecuta PHP.
  - MySQL administra la base de datos.
- Live Server de VS Code: sirve la interfaz durante el desarrollo.
- Navegador: permite imprimir la factura o guardarla como PDF.

## 2. Arquitectura general

```text
Live Server
    │
    ▼
HTML + CSS + JavaScript
    │
    │ Solicitudes HTTP usando fetch()
    ▼
API escrita en PHP y ejecutada por Apache
    │
    │ Consultas preparadas mediante PDO
    ▼
Base de datos MySQL
```

JavaScript realiza toda la lógica del sistema. PHP no calcula IVA, totales, comisiones, edades ni correlativos; solamente ejecuta consultas y devuelve JSON.

## 3. Servicios necesarios

En XAMPP deben permanecer iniciados:

- Apache.
- MySQL.

La interfaz puede abrirse con Live Server:

```text
http://127.0.0.1:5500/index.html
```

La API PHP se ejecuta desde Apache:

```text
http://localhost/facturacion/api/index.php
```

## 4. Organización esencial

```text
facturacion/
├── index.html
├── README.md
├── api/
│   └── index.php
├── config/
│   └── database.php
├── database/
│   └── schema.sql
└── assets/
    ├── css/
    │   └── styles.css
    ├── img/
    │   └── favicon.svg
    └── js/
        ├── principal.js
        ├── base-datos.js
        ├── calculos/
        │   ├── Calculo.js
        │   ├── CalculoMonetario.js
        │   ├── CalculoValorMonetario.js
        │   ├── CalculoTotalLinea.js
        │   ├── CalculoSubtotal.js
        │   ├── CalculoIVA.js
        │   ├── CalculoTotalFactura.js
        │   ├── CalculoComision.js
        │   ├── CalculoCorrelativo.js
        │   ├── CalculoEdad.js
        │   ├── CalculoCumpleanos.js
        │   └── CalculoFactura.js
        └── utilidades/
            ├── fechas.js
            └── formatos.js
```

## 5. Responsabilidad de cada componente

### `index.html`

Contiene las vistas principales:

- Inicio de sesión.
- Panel del vendedor.
- Nueva factura.
- Historial.
- Productos.
- Detalle imprimible de la factura.

### `styles.css`

Define:

- Paleta MD3 Expressive.
- Tarjetas y botones.
- Navegación lateral.
- Tablas y formularios.
- Diseño adaptable.
- Estilos especiales de impresión.

### `principal.js`

Controla:

- Inicio y cierre de sesión.
- Navegación entre vistas.
- Eventos de formularios.
- Validaciones.
- Presentación de resultados.
- Preparación de datos antes de guardarlos.
- Generación de la vista imprimible.

### `base-datos.js`

Centraliza las solicitudes `fetch()`:

- Iniciar sesión.
- Obtener productos y sucursales.
- Obtener facturas.
- Consultar una factura.
- Guardar productos.
- Guardar facturas.

También transforma las respuestas de PHP a JSON y muestra un error comprensible si Apache no responde correctamente.

### `api/index.php`

Recibe solicitudes HTTP y ejecuta consultas MySQL:

- `login`: buscar al vendedor.
- `catalogs`: obtener productos y sucursales.
- `invoices`: obtener el historial.
- `invoice`: consultar o guardar una factura.
- `product`: guardar un producto.

Usa consultas preparadas con PDO. Para guardar una factura utiliza una transacción, evitando encabezados sin detalles.

### `database.php`

Contiene los parámetros de conexión:

```php
DB_HOST = localhost
DB_NAME = facturacion_db
DB_USER = root
DB_PASS = ""
```

## 6. Base de datos

### Tabla `vendedores`

- `id`
- `nombre`
- `usuario`
- `clave`
- `fecha_nacimiento`
- `activo`
- `created_at`

### Tabla `sucursales`

- `id`
- `nombre`
- `direccion`
- `activo`
- `created_at`

### Tabla `productos`

- `id`
- `codigo`
- `descripcion`
- `precio`
- `activo`
- `created_at`

### Tabla `facturas`

- `id`
- `numero`
- `fecha`
- `vendedor_id`
- `sucursal_id`
- `subtotal`
- `iva_porcentaje`
- `iva`
- `total`
- `comision_porcentaje`
- `comision`
- `created_at`

### Tabla `factura_detalles`

- `id`
- `factura_id`
- `producto_id`
- `codigo_producto`
- `descripcion`
- `cantidad`
- `precio_unitario`
- `total_linea`

El detalle conserva una copia del código, descripción y precio utilizados. Así, una factura histórica no cambia si posteriormente se modifica el producto.

## 7. Relaciones

```text
vendedores  1 ─── N  facturas
sucursales  1 ─── N  facturas
facturas    1 ─── N  factura_detalles
productos   1 ─── N  factura_detalles
```

## 8. Polimorfismo

La clase `Calculo` establece un método común:

```javascript
calcular()
```

Las clases especializadas heredan ese contrato:

```javascript
CalculoIVA
CalculoComision
CalculoEdad
CalculoSubtotal
CalculoCorrelativo
```

Cada clase responde al mismo método, pero ejecuta una operación diferente.

`CalculoFactura` coordina las calculadoras sin conocer sus fórmulas internas:

```javascript
const subtotal = calculoSubtotal.calcular(totalesLinea);
const iva = calculoIVA.calcular(subtotal);
const total = calculoTotalFactura.calcular({ subtotal, iva });
const comision = calculoComision.calcular(subtotal);
```

Esto permite modificar una fórmula sin alterar la interfaz o los demás cálculos.

## 9. Cálculos de facturación

### Total de una línea

```text
total de línea = precio unitario × cantidad
```

Ejemplo:

```text
$25.00 × 3 = $75.00
```

### Subtotal sin IVA

```text
subtotal = suma de todos los totales de línea
```

### IVA

El IVA es del 13 %:

```text
IVA = subtotal × 0.13
```

### Total final

```text
total = subtotal + IVA
```

### Comisión

La comisión se calcula sobre el subtotal sin IVA:

|              Subtotal | Comisión |
| --------------------: | -------: |
|       $0.01 a $100.00 |      1 % |
|   $100.01 a $1,000.00 |      2 % |
| $1,000.01 a $2,000.00 |      3 % |
|       Desde $2,000.01 |      4 % |

```text
comisión = subtotal × porcentaje ÷ 100
```

Ejemplo:

```text
Subtotal: $1,500.00
Porcentaje: 3 %
Comisión: $45.00
IVA: $195.00
Total: $1,695.00
```

Todos los resultados monetarios se redondean a dos decimales.

## 10. Correlativos

Productos:

```text
PROD-000001
PROD-000002
PROD-000003
```

Facturas:

```text
FAC-00000001
FAC-00000002
FAC-00000003
```

`CalculoCorrelativo` recibe:

- Prefijo.
- Cantidad de dígitos.
- Códigos existentes.

Busca el número mayor, suma uno y completa los ceros.

Los correlativos son permanentes y no se reinician anualmente.

## 11. Fechas y cumpleaños

JavaScript descompone la edad en:

- Años.
- Meses.
- Semanas.
- Días.

Ejemplo:

```text
Nació hace 26 años, 2 meses, 1 semana y 3 días.
```

Los días restantes después de años y meses se dividen entre siete:

```text
semanas = parte entera de días restantes ÷ 7
días = residuo de días restantes ÷ 7
```

Mensajes:

- Un día antes: “Solo falta un día para tu celebración”.
- El cumpleaños: “¡Feliz cumpleaños!”.
- Un día después: “Esperamos que la celebración de ayer haya sido fantástica”.

También se contempla el 29 de febrero.

## 12. Validaciones principales

### Inicio de sesión

- Usuario obligatorio.
- Contraseña obligatoria.
- Vendedor activo.
- Mensaje si las credenciales no coinciden.

### Productos

- Descripción obligatoria.
- Máximo de 160 caracteres.
- Precio mayor que cero.
- Máximo de dos decimales.
- Código único.

### Facturas

- Fecha obligatoria.
- No permitir fechas futuras.
- Sucursal obligatoria.
- Al menos un producto.
- Producto existente.
- Cantidad entera entre 1 y 9,999.
- Precio mayor que cero.
- Evitar productos repetidos.
- Subtotal mayor que cero.
- Número de factura único.

## 13. Flujo para guardar un producto

```text
Usuario completa formulario
        ↓
JavaScript valida descripción y precio
        ↓
JavaScript genera PROD-000001
        ↓
base-datos.js envía JSON
        ↓
PHP ejecuta INSERT
        ↓
MySQL almacena el producto
        ↓
JavaScript actualiza el catálogo
```

## 14. Flujo para procesar una factura

```text
Seleccionar fecha y sucursal
        ↓
Agregar productos y cantidades
        ↓
JavaScript calcula cada línea
        ↓
JavaScript calcula subtotal
        ↓
JavaScript calcula IVA
        ↓
JavaScript calcula total
        ↓
JavaScript calcula comisión
        ↓
JavaScript genera el correlativo
        ↓
PHP recibe el JSON
        ↓
MySQL guarda factura y detalles
        ↓
JavaScript muestra la factura procesada
```

## 15. Comunicación con PHP

Ejemplo conceptual:

```javascript
fetch('http://localhost/facturacion/api/index.php?action=product', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(producto)
});
```

PHP recibe el contenido:

```php
$datos = json_decode(file_get_contents('php://input'), true);
```

Luego usa una consulta preparada:

```php
$consulta = db()->prepare(
    'INSERT INTO productos (codigo, descripcion, precio)
     VALUES (?, ?, ?)'
);

$consulta->execute([
    $datos['codigo'],
    $datos['descripcion'],
    $datos['precio']
]);
```

Finalmente devuelve JSON:

```php
echo json_encode(['id' => $conexion->lastInsertId()]);
```

## 16. Live Server y CORS

Live Server utiliza el puerto 5500, mientras Apache normalmente utiliza el puerto 80. Para el navegador son orígenes diferentes.

PHP debe permitir solicitudes desde:

```text
http://127.0.0.1:5500
http://localhost:5500
```

La API agrega encabezados CORS para estos orígenes y responde a las solicitudes `OPTIONS`.

## 17. Generación del PDF

No se necesita una librería adicional.

JavaScript crea una vista de factura preparada para impresión. El usuario selecciona:

```text
Imprimir o guardar PDF
```

Después, en el diálogo del navegador:

```text
Destino → Guardar como PDF
```

El documento contiene:

- Número de factura.
- Fecha.
- Vendedor.
- Sucursal.
- Productos.
- Cantidades.
- Precios.
- Subtotal.
- IVA.
- Total.
- Porcentaje de comisión.
- Monto de comisión.

## 18. Instalación desde cero

1. Instalar XAMPP.
2. Iniciar Apache y MySQL.
3. Crear el proyecto.
4. Crear la estructura de carpetas.
5. Importar `database/schema.sql` mediante phpMyAdmin.
6. Comprobar las credenciales en `config/database.php`.
7. Copiar `api` y `config` dentro de:

```text
C:\xampp\htdocs\facturacion
```

8. Abrir la carpeta del proyecto en VS Code.
9. Iniciar Live Server desde `index.html`.
10. Abrir:

```text
http://127.0.0.1:5500/index.html
```

11. Ingresar con:

```text
Usuario: vendedor
Contraseña: password
```

## 19. Orden recomendado de desarrollo

1. Crear la base de datos.
2. Configurar PDO.
3. Construir la API PHP.
4. Probar las respuestas JSON.
5. Crear la clase base `Calculo`.
6. Crear cada calculadora.
7. Crear `CalculoFactura`.
8. Crear el módulo de comunicación con la API.
9. Construir el inicio de sesión.
10. Construir el catálogo de productos.
11. Construir la captura de facturas.
12. Construir historial y detalle.
13. Crear la vista imprimible.
14. Añadir validaciones.
15. Aplicar el diseño MD3 Expressive.
16. Probar computadora y teléfono.
17. Probar límites de comisión y fechas especiales.

## 20. Pruebas esenciales

Probar subtotales:

```text
$100.00   → 1 %
$100.01   → 2 %
$1,000.00 → 2 %
$1,000.01 → 3 %
$2,000.00 → 3 %
$2,000.01 → 4 %
$5,000.01 → 4 %
```

Probar fechas:

- Cumpleaños normal.
- Un día antes.
- Un día después.
- Cambio de mes.
- Cambio de año.
- Nacimiento el 29 de febrero.
- Fecha de factura futura.

Probar persistencia:

- Producto guardado.
- Factura con varios productos.
- Encabezado y detalles completos.
- Factura visible en el historial.
- PDF con todos los valores.
- Correlativos sin duplicados.

## 21. Consideración académica

La contraseña inicial se mantiene de forma sencilla porque PHP se utiliza solamente como puente de datos y el objetivo principal es demostrar lógica JavaScript. En un sistema real deberían añadirse:

- Contraseñas cifradas.
- Sesiones controladas en el servidor.
- Validación completa en el servidor.
- Autorización por usuario.
- Correlativos generados de manera atómica.
- Protección CSRF.
- Configuración privada para las credenciales de MySQL.
