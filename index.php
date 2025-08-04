<?php include('includes/header.php'); ?>
<?php include('includes/db.php');
if (session_status() === PHP_SESSION_NONE) {
  session_start();
} ?>

<link rel="stylesheet" href="styles/style.css" />


<div class="main-content">

  <div class="container">

    <div class="row">

      <div class="featured-article col-sm-8 m-2">
        <h2>Featured Article</h2>
        <?php
        $featured = $pdo->query("SELECT id, title, content, featured_image, created_at FROM articles ORDER BY created_at DESC LIMIT 1")->fetch();
        if ($featured):
        ?>
          <!-- Display featured article title -->
          <h4><a href="<?= BASE_URL ?>articles/view.php?id=<?= $featured['id'] ?>" class="text-decoration-none article-title">
              <?= htmlspecialchars($featured['title']) ?></a></h4>
          <?php if ($featured['featured_image']): ?>

            <!-- Display featured image if available - onclick directs us to article -->
            <a href="<?= BASE_URL ?>articles/view.php?id=<?= $featured['id'] ?>" class="text-decoration-none article-title">
              <img src="articles/<?= htmlspecialchars($featured['featured_image']) ?>" class="img-fluid mb-3" alt="Featured Image">
            </a>

            <p><small>Published on <?= date("F j, Y", strtotime($featured['created_at'])) ?></small></p>
          <?php endif; ?>
          <hr>
          <p><?= substr(strip_tags($featured['content']), 0, 300) . '...' ?></p>
          <a href="<?= BASE_URL ?>articles/view.php?id=<?= $featured['id'] ?>" class="btn btn-outline-danger">Read More</a>
        <?php else: ?>
          <p>No featured article found.</p>
        <?php endif; ?>
      </div>



      <div class="article-list col-sm-4 m-2">
        <h3>Recent Posts</h3>
        <ul>
          <?php
          $stmt = $pdo->query("SELECT id, title, slug, created_at FROM articles ORDER BY created_at DESC");
          while ($row = $stmt->fetch()) {
            echo "<h3 class='article-titles-list'><a href='articles/view.php?id={$row['id']}'>{$row['title']}</a></h3>";
            echo "<p><small>Published on {$row['created_at']}</small></p>";
          }

          ?>
        </ul>

      </div>
    </div>
  </div>
</div>


<?php include('includes/footer.php'); ?>