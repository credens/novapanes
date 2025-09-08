<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido']);
    exit;
}

// Get form data
$nombre = isset($_POST['nombre']) ? trim($_POST['nombre']) : '';
$email = isset($_POST['email']) ? trim($_POST['email']) : '';
$telefono = isset($_POST['telefono']) ? trim($_POST['telefono']) : '';
$mensaje = isset($_POST['mensaje']) ? trim($_POST['mensaje']) : '';

// Validate required fields
$errors = [];

if (empty($nombre)) {
    $errors[] = 'El nombre es obligatorio';
}

if (empty($telefono)) {
    $errors[] = 'El teléfono es obligatorio';
}

// Validate email format if provided
if (!empty($email) && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'El formato del email no es válido';
}

// Validate phone format (basic validation)
if (!empty($telefono) && !preg_match('/^[\d\s\-\+\(\)]{8,20}$/', $telefono)) {
    $errors[] = 'El formato del teléfono no es válido';
}

if (!empty($errors)) {
    echo json_encode(['success' => false, 'message' => implode('. ', $errors)]);
    exit;
}

// Email configuration
$to = 'panes.nova@gmail.com';
$subject = 'Nuevo mensaje desde NOVA Panes - ' . $nombre;

// Create email body
$email_body = "
<html>
<head>
    <title>Nuevo mensaje desde NOVA Panes</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #F9DAB9; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #B5651D; }
        .value { margin-left: 10px; }
    </style>
</head>
<body>
    <div class='header'>
        <h2>Nuevo mensaje desde NOVA Panes</h2>
    </div>
    <div class='content'>
        <div class='field'>
            <span class='label'>Nombre:</span>
            <span class='value'>" . htmlspecialchars($nombre) . "</span>
        </div>
        
        <div class='field'>
            <span class='label'>Teléfono:</span>
            <span class='value'>" . htmlspecialchars($telefono) . "</span>
        </div>";

if (!empty($email)) {
    $email_body .= "
        <div class='field'>
            <span class='label'>Email:</span>
            <span class='value'>" . htmlspecialchars($email) . "</span>
        </div>";
}

if (!empty($mensaje)) {
    $email_body .= "
        <div class='field'>
            <span class='label'>Mensaje:</span>
            <div style='margin-top: 10px; padding: 15px; background-color: #f9f9f9; border-left: 3px solid #B5651D;'>
                " . nl2br(htmlspecialchars($mensaje)) . "
            </div>
        </div>";
}

$email_body .= "
        <div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;'>
            Enviado desde el sitio web de NOVA Panes el " . date('d/m/Y H:i:s') . "
        </div>
    </div>
</body>
</html>";

// Email headers
$headers = [
    'MIME-Version: 1.0',
    'Content-type: text/html; charset=UTF-8',
    'From: NOVA Panes Website <noreply@' . $_SERVER['HTTP_HOST'] . '>',
    'Reply-To: ' . (!empty($email) ? $email : 'noreply@' . $_SERVER['HTTP_HOST']),
    'X-Mailer: PHP/' . phpversion()
];

// Send email
if (mail($to, $subject, $email_body, implode("\r\n", $headers))) {
    echo json_encode([
        'success' => true, 
        'message' => 'Mensaje enviado correctamente. Te contactaremos pronto.'
    ]);
} else {
    echo json_encode([
        'success' => false, 
        'message' => 'Error al enviar el mensaje. Inténtalo de nuevo.'
    ]);
}
?>