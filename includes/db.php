<?php
// db.php - Database connection for AnarchoSapien

$host = 'localhost';
$db   = 'blogsitedb';
$user = 'root';
$pass = ''; // Default for XAMPP
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
  PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
  $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
  echo "<strong>Database connection failed:</strong> " . $e->getMessage();
  exit;
}
