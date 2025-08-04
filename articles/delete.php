<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db.php';
session_start();

if (!isset($_SESSION['user_id']) || !isset($_GET['id']) || !is_numeric($_GET['id'])) {
  die("Unauthorized access.");
}

$articleId = $_GET['id'];

// Verify ownership
$stmt = $pdo->prepare("SELECT * FROM articles WHERE id = ? AND author_id = ?");
$stmt->execute([$articleId, $_SESSION['user_id']]);
$article = $stmt->fetch();

if (!$article) {
  die("Article not found or access denied.");
}

// Delete article from database
$stmt = $pdo->prepare("DELETE FROM articles WHERE id = ? AND author_id = ?");
$stmt->execute([$articleId, $_SESSION['user_id']]);

// Delete associated images and directory
$uploadDir = "uploads/article_" . $articleId . "/";
if (file_exists($uploadDir) && is_dir($uploadDir)) {
  $files = glob($uploadDir . '*');
  foreach ($files as $file) {
    if (is_file($file)) {
      unlink($file);
    }
  }
  rmdir($uploadDir);
}

header("Location: /CMS/index.php");
exit;
