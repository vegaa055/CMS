<?php
require_once '../includes/db.php';
require_once '../includes/config.php';
session_start();

$article = null;
if (isset($_GET['id']) && is_numeric($_GET['id'])) {
  $stmt = $pdo->prepare("SELECT a.*, u.username FROM articles a LEFT JOIN users u ON a.author_id = u.id WHERE a.id = ?");
  $stmt->execute([$_GET['id']]);
  $article = $stmt->fetch();
}

include('../includes/header.php');
?>

<link rel="stylesheet" href="<?= BASE_URL ?>../styles/style.css" />
<div class="container mt-5">
  <div class="row">
    <?php if ($article): ?>
      <h1><?= htmlspecialchars($article['title']) ?></h1>
      <?php if ($article['featured_image']): ?>
        <img src="<?= htmlspecialchars($article['featured_image']) ?>" alt="Featured Image" class="img-fluid mb-3 rounded-corners">
      <?php endif; ?>
      <p class="text-secondary">By <?= htmlspecialchars($article['username'] ?? 'Unknown') ?> on <?= $article['created_at'] ?></p>

      <?php if (isset($_SESSION['user_id']) && $_SESSION['user_id'] == $article['author_id']): ?>
        <div class="mb-3 p-0">
          <a href="edit.php?id=<?= $article['id'] ?>" class="btn btn-link edit-delete">Edit</a>
          <a href="delete.php?id=<?= $article['id'] ?>" class="btn btn-link edit-delete" onclick="return confirm('Are you sure you want to delete this article?');">Delete</a>
        </div>
      <?php endif; ?>

      <hr>
      <div class="mt-4">
        <?= nl2br(htmlspecialchars($article['content'])) ?>
      </div>
    <?php else: ?>
      <div class="alert alert-danger">Article not found.</div>
    <?php endif; ?>
  </div>
</div>

<?php include('../includes/footer.php'); ?>