<?php

/**
 * TinyMCE image upload endpoint
 * Location: /users/upload_image.php
 *
 * - When article_id is supplied (editing existing article):
 *     stores in uploads/article_{id}/
 * - When no id or draft=1 is passed (new article):
 *     stores in uploads/drafts/user_{id}/
 *
 * Returns JSON:  { location: "../uploads/..." }
 * so that images render correctly from /articles/create.php and /articles/view.php
 */
header('Content-Type: application/json');
session_start();

require_once __DIR__ . '/../includes/db.php';

if (!isset($_SESSION['user_id'])) {
  http_response_code(401);
  echo json_encode(['error' => 'Unauthorized']);
  exit;
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
  http_response_code(400);
  echo json_encode(['error' => 'No file uploaded']);
  exit;
}

// article_id can be numeric or 0 for drafts
$articleId = isset($_GET['article_id']) && is_numeric($_GET['article_id'])
  ? (int)$_GET['article_id']
  : 0;

// Decide relative upload directory
if ($articleId > 0) {
  // Existing article
  $relativeDir = '/CMS/articles/uploads/article_' . $articleId . '/';
} else {
  // Draft for this user
  $relativeDir = 'uploads/drafts/user_' . $_SESSION['user_id'] . '/';
}

// Absolute directory on disk
$absDir = dirname(__DIR__) . '/' . $relativeDir;
if (!is_dir($absDir) && !mkdir($absDir, 0755, true)) {
  http_response_code(500);
  echo json_encode(['error' => 'Failed to create upload folder']);
  exit;
}

$tmp  = $_FILES['file']['tmp_name'];
$ext  = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
$safeName = uniqid('img_', true) . '.' . $ext;
$destAbs  = $absDir . $safeName;

if (!move_uploaded_file($tmp, $destAbs)) {
  http_response_code(500);
  echo json_encode(['error' => 'Could not move uploaded file']);
  exit;
}

// Path TinyMCE should embed — relative to /articles/create.php or /articles/view.php
$location = '../' . $relativeDir . $safeName;

echo json_encode(['location' => $location]);
