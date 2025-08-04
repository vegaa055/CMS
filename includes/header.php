<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
if (session_status() === PHP_SESSION_NONE) {
  session_start();
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tony Vega</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/css/bootstrap.min.css" rel="stylesheet" />
  <link rel="stylesheet" href="styles/style.css" />
</head>

<body>
  <nav class="navbar navbar-expand-lg">
    <!-- navbar content -->
  </nav>
  <div class="jumbotron">
    <div class="container">
      <h1 class="display-3">Vega Adeventure</h1>
      <p class="lead">Take a Journey Through the Southwest US</p>
    </div>
  </div>

  <nav class="navbar navbar-expand-lg">
    <div class="container-fluid">
      <a class="navbar-brand" href="#"><img src="/CMS/images/vega_adventure.png" alt=""></a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarSupportedContent">
        <ul class="navbar-nav me-auto mb-2 mb-lg-0">

          <li class="nav-item">
            <a class="nav-link active" aria-current="page" href="/CMS/index.php">Home</a>
          </li>

          <li class="nav-item">
            <a class="nav-link" href="#">Articles</a>
          </li>
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
              Destinations
            </a>
            <ul class="dropdown-menu">
              <li><a class="dropdown-item" href="#">Bisbee, AZ</a></li>
              <li><a class="dropdown-item" href="#">Cosmic Campgrounds, NM</a></li>
              <li>
                <hr class="dropdown-divider">
              </li>
              <li><a class="dropdown-item" href="#">All Destinations</a></li>
            </ul>
          </li>
        </ul>

        <div class="d-flex">
          <?php if (isset($_SESSION['username'])): ?>
            <a href="/CMS/users/profile.php?id=<?= $_SESSION['user_id'] ?>" class="text-decoration-none text-white">
              <span class="welcome-user">Welcome, <?= htmlspecialchars($_SESSION['username']) ?>!</span>
            </a>


            <!-- ── user is logged out or not a member - show login/register btns ───────────────── -->
          <?php else: ?>
            <a href="/CMS/users/login.php" class="btn btn-outline-success me-2">Login</a>
            <a href="/CMS/users/register.php" class="btn btn-outline-primary">Register</a>
          <?php endif; ?>
        </div>
      </div>
    </div>
    </div>
  </nav>