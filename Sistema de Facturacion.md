# Guía del sistema
## Arquitectura
El navegador muestra la interfaz HTML/CSS y JavaScript modular. Node.js sirve la interfaz y la API desde el mismo origen; SQL Server conserva los datos. El navegador muestra una vista previa del cálculo, mientras el servidor obtiene los precios del catálogo y vuelve a calcular cada línea antes de guardar.

Flujo de emisión: sesión válida → cliente y sucursal → productos, cantidades y descuentos → cálculo en servidor → transacción de factura, detalles, auditoría y correo pendiente → PDF disponible → envío SMTP con reintentos.

## Cálculos
Los precios finales incluyen IVA. Una línea de dos unidades a $113.00, sin descuentos, suma $226.00. Su base sin IVA es $200.00 y el IVA incluido es $26.00. Según la escala de la aplicación, esa línea usa el 2 % de comisión: $4.00.

Dos productos distintos con base de $100.00 cada uno generan $1.00 por producto, por lo tanto $2.00 de comisión total. La escala se aplica a cada línea; sumar primero ambas bases y aplicar el 2 % produciría un resultado diferente y no corresponde a la regla acordada.

Los cálculos usan centavos enteros, redondean la base y la comisión de cada línea al centavo y después suman. Una línea exenta o no sujeta no extrae IVA. El descuento se resta del importe final de la línea antes de separar el impuesto. La suma de base e IVA coincide con el total cobrado.

Las clases de `assets/js/calculos` mantienen el contrato `calcular()` para demostrar herencia y polimorfismo. El servidor conserva su cálculo definitivo, validado mediante pruebas que comparan ambas implementaciones.

## Acceso
Las contraseñas se almacenan con scrypt y sal aleatoria. La cookie de sesión es HttpOnly, SameSite=Lax y Secure en producción. El servidor guarda sólo el hash del token y exige un token CSRF para las operaciones de escritura.

Cada solicitud comprueba que la cuenta siga activa, que no esté bloqueada, que no esté de vacaciones y que se encuentre en una ubicación permitida. A facturadores se les aplica también horario y festivos. El final de un intervalo de horario está excluido; los días inicial y final de vacaciones están incluidos.

El país procede de una base local de GeoIP. Las cabeceras de IP sólo se aceptan desde proxies expresamente autorizados. Las redes de oficina se configuran en el servidor. El administrador controla usuarios, permisos, horarios, festivos, bloqueos, auditoría y envíos desde la aplicación.

## Persistencia y concurrencia
SQL Server almacena sucursales, vendedores, productos, clientes, facturas, detalles, sesiones, horarios, bloqueos, festivos, intentos, auditoría y correos. Se usan parámetros SQL, tipos Unicode, DECIMAL para importes y fechas UTC en DATETIME2; la aplicación presenta la hora de El Salvador.

Las identidades generan los números permanentes. Los índices únicos filtrados permiten varios valores nulos mientras se asigna el número definitivo. El identificador de solicitud impide que un doble envío cree facturas duplicadas. Las transacciones guardan encabezado, detalles y correo juntos. Los bloqueos de actualización protegen las operaciones que pueden competir entre sí.

Una factura guarda copias de los datos de cliente, emisor y productos. Editar el cliente o el catálogo no modifica comprobantes anteriores. El historial de un facturador sólo incluye sus documentos; un administrador puede consultar todos.

## Crédito fiscal, PDF y correo
Se distinguen CF y CCF. El cliente de CCF debe ser contribuyente y contar con NIT, NRC, actividad, dirección y correo. La factura registra condición de pago, forma de pago y separación entre gravadas, exentas y no sujetas.

El PDF se genera en Node mediante PDFKit, incluye emisor, receptor, detalle y totales, y pagina cuando hay muchos productos. El cliente no recibe información de comisiones ni de acceso. Nodemailer transmite el PDF a tu SMTP local. La cola registra los intentos y su resultado; el mismo identificador de mensaje se conserva al reintentar.

Los documentos son académicos y muestran «Documento de prueba - sin validez fiscal». Una integración legal con documentos tributarios electrónicos de Hacienda necesitaría emisión, firma, transmisión y validación autorizadas que están fuera de esta implementación.

## Puesta en marcha
Consultar README.md para instalar y ejecutar. La instancia local SQLEXPRESS utiliza autenticación de Windows; para otro servidor se puede configurar autenticación SQL. Las credenciales y datos privados van en .env y no se publican por HTTP ni se guardan en Git.
