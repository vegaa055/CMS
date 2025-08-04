<?php
session_start();
// load configuration and database connection
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db.php';
include('../includes/header.php');


if (!isset($_SESSION['user_id'])) {
  header("Location: login.php");
  exit;
}

$errors = [];
$success = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $title = trim($_POST['title']);
  $content = trim($_POST['content']);

  if (empty($title) || empty($content)) {
    $errors[] = "Title and content are required.";
  } else {
    $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $title)));

    $stmt = $pdo->prepare("INSERT INTO articles (title, slug, content, author_id) VALUES (?, ?, ?, ?)");
    $stmt->execute([$title, $slug, $content, $_SESSION['user_id']]);
    $success = true;
  }
}
?>

<link rel="stylesheet" href="<?= BASE_URL ?>../styles/style.css" />

<body class="bg-dark text-white">
  <div class="container mt-5">
    <h2>Create New Article</h2>

    <?php if ($success): ?>
      <div class="alert alert-success">Article published successfully!</div>
    <?php endif; ?>

    <?php if ($errors): ?>
      <div class="alert alert-danger">
        <ul>
          <?php foreach ($errors as $error): ?>
            <li><?= htmlspecialchars($error) ?></li>
          <?php endforeach; ?>
        </ul>
      </div>
    <?php endif; ?>

    <form method="POST" action="">
      <div class="mb-3">
        <label for="title" class="form-label">Title</label>
        <input type="text" class="form-control" id="title" name="title" required>
      </div>
      <div class="mb-3">
        <label for="content" class="form-label">Content</label>
        <textarea class="form-control" id="content" name="content" rows="10" required></textarea>
      </div>
      <button type="submit" class="btn btn-outline-success">Publish Article</button>
    </form>
  </div>
</body>

</html>