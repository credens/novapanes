<?php
// Set content type and CORS headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false, 
        'message' => 'Método no permitido'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Function to sanitize input
function sanitizeInput($data) {
    return htmlspecialchars(strip_tags(trim($data)), ENT_QUOTES, 'UTF-8');
}

// Get and sanitize form data
$nombre = isset($_POST['nombre']) ? sanitizeInput($_POST['nombre']) : '';
$email = isset($_POST['email']) ? sanitizeInput($_POST['email']) : '';
$telefono = isset($_POST['telefono']) ? sanitizeInput($_POST['telefono']) : '';
$mensaje = isset($_POST['mensaje']) ? sanitizeInput($_POST['mensaje']) : '';

// Validation
$errors = [];

// Required field validation
if (empty($nombre)) {
    $errors[] = 'El nombre es obligatorio';
} elseif (strlen($nombre) < 2) {
    $errors[] = 'El nombre debe tener al menos 2 caracteres';
} elseif (strlen($nombre) > 100) {
    $errors[] = 'El nombre no puede exceder 100 caracteres';
}

if (empty($telefono)) {
    $errors[] = 'El teléfono es obligatorio';
} elseif (!preg_match('/^[\d\s\-\+\(\)]{8,20}$/', $telefono)) {
    $errors[] = 'El formato del teléfono no es válido';
}

// Email validation (optional but must be valid if provided)
if (!empty($email) && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'El formato del email no es válido';
}

// Message validation (optional)
if (!empty($mensaje) && strlen($mensaje) > 1000) {
    $errors[] = 'El mensaje no puede exceder 1000 caracteres';
}

// Return validation errors if any
if (!empty($errors)) {
    echo json_encode([
        'success' => false, 
        'message' => implode('. ', $errors)
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Email configuration
$to = 'panes.nova@gmail.com';
$subject = 'Nuevo mensaje desde NOVA Panes - ' . $nombre;

// Create email body
$email_body = "
<!DOCTYPE html>
<html lang='es'>
<head>
    <meta charset='UTF-8'>
    <title>Nuevo mensaje desde NOVA Panes</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
        }
        .header { 
            background: linear-gradient(135deg, #F9DAB9, #B5651D); 
            padding: 30px; 
            text-align: center; 
            border-radius: 8px 8px 0 0;
        }
        .header h1 { 
            color: #fff; 
            margin: 0; 
            font-size: 24px;
        }
        .content { 
            background: #fff; 
            padding: 30px; 
            border: 1px solid #E0E0E0;
            border-radius: 0 0 8px 8px;
        }
        .field { 
            margin-bottom: 20px; 
            padding: 15px;
            background: #f9f9f9;
            border-left: 4px solid #B5651D;
            border-radius: 4px;
        }
        .label { 
            font-weight: bold; 
            color: #B5651D; 
            display: block;
            margin-bottom: 8px;
        }
        .value { 
            color: #333;
            word-wrap: break-word;
        }
        .footer { 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #eee; 
            font-size: 12px; 
            color: #666;
            text-align: center;
        }
        .logo { 
            font-weight: bold; 
            color: #B5651D;
        }
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <h1>🍞 NUEVO MENSAJE - NOVA PANES</h1>
        </div>
        <div class='content'>
            <div class='field'>
                <span class='label'>👤 Nombre:</span>
                <div class='value'>" . $nombre . "</div>
            </div>
            
            <div class='field'>
                <span class='label'>📱 Teléfono:</span>
                <div class='value'>" . $telefono . "</div>
            </div>";

if (!empty($email)) {
    $email_body .= "
            <div class='field'>
                <span class='label'>📧 Email:</span>
                <div class='value'>" . $email . "</div>
            </div>";
}

if (!empty($mensaje)) {
    $email_body .= "
            <div class='field'>
                <span class='label'>💬 Mensaje:</span>
                <div class='value' style='white-space: pre-wrap;'>" . $mensaje . "</div>
            </div>";
}

$email_body .= "
            <div class='footer'>
                <div class='logo'>NOVA PANES</div>
                Mensaje enviado desde el sitio web el " . date('d/m/Y H:i:s') . "
            </div>
        </div>
    </div>
</body>
</html>";

// Email headers
$headers = [
    'MIME-Version: 1.0',
    'Content-type: text/html; charset=UTF-8',
    'From: NOVA Panes Website <noreply@novapanes.com>',
    'Reply-To: ' . (!empty($email) ? $email : 'noreply@novapanes.com'),
    'X-Mailer: PHP/' . phpversion(),
    'X-Priority: 3',
    'Return-Path: noreply@novapanes.com'
];

// Attempt to send email
$mail_sent = @mail($to, $subject, $email_body, implode("\r\n", $headers));

if ($mail_sent) {
    // Log successful submission (optional)
    error_log("Contact form submitted successfully by: " . $nombre . " (" . $email . ")");
    
    echo json_encode([
        'success' => true, 
        'message' => '¡Mensaje enviado correctamente! Te contactaremos pronto.'
    ], JSON_UNESCAPED_UNICODE);
} else {
    // Log the error (optional)
    error_log("Failed to send contact form email from: " . $nombre . " (" . $email . ")");
    
    echo json_encode([
        'success' => false, 
        'message' => 'Error al enviar el mensaje. Por favor, inténtalo de nuevo más tarde o contáctanos directamente por WhatsApp.'
    ], JSON_UNESCAPED_UNICODE);
}
?>