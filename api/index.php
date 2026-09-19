<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

// Permite que la interfaz abierta con Live Server consulte este archivo en Apache.
$allowedOrigins = ['http://127.0.0.1:5500', 'http://localhost:5500'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond(mixed $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function input(): array
{
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($action === 'login' && $method === 'POST') {
        $data = input();
        $query = db()->prepare('SELECT id, nombre, usuario, fecha_nacimiento FROM vendedores WHERE usuario = ? AND clave = ? AND activo = 1');
        $query->execute([$data['usuario'] ?? '', $data['clave'] ?? '']);
        $seller = $query->fetch();
        respond($seller ?: ['error' => 'Credenciales incorrectas'], $seller ? 200 : 401);
    }

    if ($action === 'catalogs' && $method === 'GET') {
        $products = db()->query('SELECT id, codigo, descripcion, precio FROM productos WHERE activo = 1 ORDER BY id')->fetchAll();
        $branches = db()->query('SELECT id, nombre, direccion FROM sucursales WHERE activo = 1 ORDER BY nombre')->fetchAll();
        respond(['productos' => $products, 'sucursales' => $branches]);
    }

    if ($action === 'invoices' && $method === 'GET') {
        $sellerId = (int)($_GET['seller_id'] ?? 0);
        $query = db()->prepare('SELECT f.*, s.nombre sucursal, s.direccion FROM facturas f JOIN sucursales s ON s.id = f.sucursal_id WHERE f.vendedor_id = ? ORDER BY f.id DESC');
        $query->execute([$sellerId]);
        respond($query->fetchAll());
    }

    if ($action === 'invoice' && $method === 'GET') {
        $invoiceId = (int)($_GET['id'] ?? 0);
        $query = db()->prepare('SELECT f.*, s.nombre sucursal, s.direccion, v.nombre vendedor FROM facturas f JOIN sucursales s ON s.id = f.sucursal_id JOIN vendedores v ON v.id = f.vendedor_id WHERE f.id = ?');
        $query->execute([$invoiceId]);
        $invoice = $query->fetch();
        if (!$invoice) respond(['error' => 'Factura no encontrada'], 404);
        $details = db()->prepare('SELECT producto_id, codigo_producto, descripcion, cantidad, precio_unitario, total_linea FROM factura_detalles WHERE factura_id = ? ORDER BY id');
        $details->execute([$invoiceId]);
        respond(['factura' => $invoice, 'detalles' => $details->fetchAll()]);
    }

    if ($action === 'product' && $method === 'POST') {
        $data = input();
        $query = db()->prepare('INSERT INTO productos (codigo, descripcion, precio) VALUES (?, ?, ?)');
        $query->execute([$data['codigo'] ?? '', $data['descripcion'] ?? '', $data['precio'] ?? 0]);
        respond(['id' => (int)db()->lastInsertId()], 201);
    }

    if ($action === 'invoice' && $method === 'POST') {
        $data = input();
        $connection = db();
        $connection->beginTransaction();
        try {
            $query = $connection->prepare('INSERT INTO facturas (numero, fecha, vendedor_id, sucursal_id, subtotal, iva_porcentaje, iva, total, comision_porcentaje, comision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $query->execute([
                $data['numero'], $data['fecha'], $data['vendedor_id'], $data['sucursal_id'],
                $data['subtotal'], $data['iva_porcentaje'], $data['iva'], $data['total'],
                $data['comision_porcentaje'], $data['comision']
            ]);
            $invoiceId = (int)$connection->lastInsertId();
            $detail = $connection->prepare('INSERT INTO factura_detalles (factura_id, producto_id, codigo_producto, descripcion, cantidad, precio_unitario, total_linea) VALUES (?, ?, ?, ?, ?, ?, ?)');
            foreach ($data['detalles'] as $line) {
                $detail->execute([
                    $invoiceId, $line['producto_id'], $line['codigo_producto'], $line['descripcion'],
                    $line['cantidad'], $line['precio_unitario'], $line['total_linea']
                ]);
            }
            $connection->commit();
            respond(['id' => $invoiceId], 201);
        } catch (Throwable $error) {
            $connection->rollBack();
            throw $error;
        }
    }

    respond(['error' => 'Operación no encontrada'], 404);
} catch (PDOException $error) {
    $message = $error->getCode() === '23000' ? 'El código o número ya existe.' : 'No se pudo completar la operación en la base de datos.';
    respond(['error' => $message], 500);
}
