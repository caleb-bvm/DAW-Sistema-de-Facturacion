<?php
declare(strict_types=1);

const DB_HOST = 'localhost';
const DB_NAME = 'facturacion_db';
const DB_USER = 'root';
const DB_PASS = '';

function db(): PDO
{
    static $connection = null;

    if ($connection === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $connection = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }

    return $connection;
}
