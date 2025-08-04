<?php
require_once '../includes/db.php';
session_start();
$errors = [];
$success = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {  // Check if the form is submitted
  $username = trim($_POST['username']);   // Get the username from the form
  $email = trim($_POST['email']);           // Get the email from the form
  $password = $_POST['password'];           // Get the password from the form
  $confirm = $_POST['confirm_password'];    // Get the confirm password from the form

  if (empty($username) || empty($password) || empty($confirm) || empty($email)) {
    $errors[] = "All fields are required.";
  } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = "Please enter a valid email address.";
  } elseif ($password !== $confirm) {
    $errors[] = "Passwords do not match.";
  } else {
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
    $stmt->execute([$username, $email]);
    if ($stmt->fetch()) {
      $errors[] = "Username or email already exists.";
    } else {
      $hash = password_hash($password, PASSWORD_DEFAULT);
      $insert = $pdo->prepare("INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)");
      $insert->execute([$username, $hash, $email]);
      $success = true;
    }
  }
}
?>

<link rel="stylesheet" href="../styles/style.css">
<!-- header -->
<?php include('../includes/header.php'); ?>

<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Register - AnarchoSapien</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/css/bootstrap.min.css" rel="stylesheet">
</head>

<body class="bg-dark text-white">
  <div class="container mt-5">
    <div class="row">
      <div class="col-sm-6">
        <h2>Register</h2>

        <?php if ($success): ?>
          <div class="alert alert-success">Registration successful! You may now <a href="login.php">log in</a>.</div>
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
            <label for="username" class="form-label">Username</label>
            <input type="text" class="form-control" id="username" name="username" required>
          </div>
          <!-- email -->
          <div class="mb-3">
            <label for="email" class="form-label">E-Mail</label>
            <input type="email" class="form-control" id="email" name="email" required>
          </div>
          <div class="mb-3">
            <label for="password" class="form-label">Password</label>
            <input type="password" class="form-control" id="password" name="password" required>
          </div>
          <div class="mb-3">
            <label for="confirm_password" class="form-label">Confirm Password</label>
            <input type="password" class="form-control" id="confirm_password" name="confirm_password" required>
          </div>
          <button type="submit" class="btn btn-outline-success mt-2">Register</button>
        </form>
      </div>

      <div class="col-sm-6 mt-5">
        <img src="https://cdn.midjourney.com/6c7a5531-0214-4eb6-9eef-2f932fe04a46/0_3.png" class="img-fluid" alt="">
      </div>
    </div>
  </div>
</body>

</html>