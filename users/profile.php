<?php
require_once __DIR__ . '/../includes/db.php';
session_start();

if (!isset($_GET['id']) || !is_numeric($_GET['id'])) die("User not found");
$user_id = (int) $_GET['id'];

$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$user_id]);

$user = $stmt->fetch();

if (!$user) die("User not found");

include '../includes/header.php';

?>
<link rel="stylesheet" href="<?= BASE_URL ?>../styles/style.css" />

<div class="container mt-5">

  <div class="row">

    <div class="col-sm profile-picture-info">

      <!-- <div class="col-sm">
        <img src="/anarchosapien/users/<?= $user['profile_picture'] ?: 'images/default.png' ?>" class="profile-picture my-3">
      </div> -->

      <div class="col profile-side-info">
        <h2 class="profile-title"><?= htmlspecialchars($user['username']) ?></h2>
        <!-- <p class="user-quote">"<?= nl2br(htmlspecialchars($user['quote'])) ?: '<span class="text-muted">No quote available.</span>' ?>"</p> -->
        <p class="profile-joined">Member Since: <?= date('F j, Y', strtotime($user['created_at'])) ?></p>
        <?php if (isset($_SESSION['user_id']) && $_SESSION['user_id'] == $user['id']): ?>
          <a href="edit_profile.php" class="btn btn-outline-primary btn-sm edit-profile">Edit Profile</a>
        <?php endif; ?>
      </div>



    </div>

    <!-- Link to edit_profile.php -->
    <div class="col-md">


      <div class="text-start mx-auto mt-3" style="max-width: 600px;">
        <h5 class="section-title-3">About</h5>
        <hr class="text-danger" style="width: 50%; margin: 0; margin-top: 10px; margin-bottom: 20px;">

        <p><?= nl2br(htmlspecialchars($user['bio'])) ?: '<span class="text-muted">No bio available.</span>' ?></p>
      </div>
    </div>
  </div>
</div>
<?php include '../includes/footer.php'; ?>