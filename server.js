// ===================================================
//      ARCHIVO server.js (VERSIÓN FINAL CORREGIDA)
// ===================================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
require('dotenv').config();
const session = require('express-session');
const nodemailer = require('nodemailer');

const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Guardamos las imágenes en la carpeta 'public/productos'
        cb(null, path.join(__dirname, 'public', 'productos'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const { MercadoPagoConfig, Preference } = require('mercadopago');
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || 'APP_USR-2704302134467517-090918-811730b9fe1b3c013dfe9480874e87d9-2683089128' });

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Configuración de la sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 1 día
    }
}));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Rutas a los archivos HTML principales
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PRODUCTS_FILE_PATH = path.join(__dirname, 'public', 'products.json');

// ==========================================
//      RUTAS DE API PARA PRODUCTOS (CRUD) - Requieren autenticación
// ==========================================
const adminRouter = express.Router();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// Middleware de autenticación para todas las rutas bajo /api/admin
adminRouter.use(async (req, res, next) => {
    const plainTextPassword = req.headers['authorization']; 
    if (!plainTextPassword) return res.status(401).json({ message: 'Contraseña de API no proporcionada.' });
    if (!ADMIN_PASSWORD_HASH) {
        console.warn('ADMIN_PASSWORD_HASH no está configurado en .env. Usando contraseña de desarrollo "superadmin".');
        if (plainTextPassword === 'superadmin') return next();
        else return res.status(403).json({ message: 'Acceso denegado. Contraseña de desarrollo incorrecta o ADMIN_PASSWORD_HASH no configurado.' });
    }
    try {
        const match = await bcrypt.compare(plainTextPassword, ADMIN_PASSWORD_HASH);
        if (match) next();
        else res.status(403).json({ message: 'Acceso denegado. Contraseña de administrador incorrecta.' });
    } catch (error) {
        console.error('Error en autenticación de administrador:', error);
        res.status(500).json({ message: 'Error interno del servidor durante la autenticación.' });
    }
});

app.use('/api/admin', adminRouter);

// Obtener todos los productos (admin)
adminRouter.get('/products', (req, res) => { try { res.json(JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8'))); } catch (error) { res.status(500).json({ message: 'Error al obtener productos.' }); } });

// Obtener un producto por ID (admin)
adminRouter.get('/products/:id', (req, res) => { try { const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8')); const product = products.find(p => p.id === parseInt(req.params.id)); if (product) res.json(product); else res.status(404).json({ message: 'Producto no encontrado.' }); } catch (error) { res.status(500).json({ message: 'Error al obtener producto por ID.' }); } });

// Añadir un nuevo producto (admin)
adminRouter.post('/products', upload.single('image'), (req, res) => { if (!req.file || !req.body.name || !req.body.description || !req.body.price || !req.body.category || !req.body.stock) return res.status(400).json({ message: 'Faltan campos o imagen.' }); try { const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8')); const newProduct = { id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1, name: req.body.name, description: req.body.description, price: parseFloat(req.body.price), image: `productos/${req.file.filename}`, category: req.body.category, stock: parseInt(req.body.stock) }; products.push(newProduct); fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2)); res.status(201).json(newProduct); } catch (error) { res.status(500).json({ message: 'Error al añadir producto.' }); } });

// Actualizar un producto (admin)
adminRouter.put('/products/:id', upload.single('image'), (req, res) => { try { let products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8')); const productIndex = products.findIndex(p => p.id === parseInt(req.params.id)); if (productIndex === -1) return res.status(404).json({ message: 'Producto no encontrado.' }); const oldProduct = products[productIndex]; const updatedProduct = { ...oldProduct, name: req.body.name || oldProduct.name, description: req.body.description || oldProduct.description, price: req.body.price ? parseFloat(req.body.price) : oldProduct.price, category: req.body.category || oldProduct.category, stock: req.body.stock ? parseInt(req.body.stock) : oldProduct.stock }; if (req.file) { if (oldProduct.image) { const oldImagePath = path.join(__dirname, 'public', oldProduct.image); if (fs.existsSync(oldImagePath)) fs.unlink(oldImagePath, (err) => { if (err) console.error('Error al eliminar imagen antigua:', err); }); } updatedProduct.image = `productos/${req.file.filename}`; } products[productIndex] = updatedProduct; fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2)); res.json(updatedProduct); } catch (error) { res.status(500).json({ message: 'Error al actualizar producto.' }); } });

// Eliminar un producto (admin)
adminRouter.delete('/products/:id', (req, res) => { try { let products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8')); const productIdToDelete = parseInt(req.params.id); const productToDelete = products.find(p => p.id === productIdToDelete); if (!productToDelete) return res.status(404).json({ message: 'Producto no encontrado.' }); if (productToDelete.image) { const imagePath = path.join(__dirname, 'public', productToDelete.image); if (fs.existsSync(imagePath)) fs.unlink(imagePath, (err) => { if (err) console.error('Error al eliminar imagen:', err); }); } products = products.filter(p => p.id !== productIdToDelete); fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2)); res.status(200).json({ message: 'Producto eliminado.' }); } catch (error) { res.status(500).json({ message: 'Error al eliminar producto.' }); } });


// ==========================================
//      RUTAS PÚBLICAS
// ==========================================

// Ruta pública para que el shop obtenga los productos
app.get('/products', (req, res) => {
    try {
        res.json(JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8')));
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener productos para el frontend.' });
    }
});

// Ruta para procesar pedidos y enviar notificaciones por email
app.post('/api/submit-order', async (req, res) => {
    const orderData = req.body;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD,
        },
    });

    const emailBody = `
        <h1>🍞 Nuevo Pedido Recibido - NOVA Panes 🍞</h1>
        <h2>Detalles del Cliente:</h2>
        <ul>
            <li><strong>Nombre:</strong> ${orderData.customer.nombre}</li>
            <li><strong>Email:</strong> ${orderData.customer.email}</li>
            <li><strong>Teléfono:</strong> ${orderData.customer.telefono}</li>
            <li><strong>Dirección:</strong> ${orderData.customer.direccion}, ${orderData.customer.ciudad}</li>
            ${orderData.customer.codigoPostal ? `<li><strong>CP:</strong> ${orderData.customer.codigoPostal}</li>` : ''}
            ${orderData.customer.referencias ? `<li><strong>Referencias:</strong> ${orderData.customer.referencias}</li>` : ''}
        </ul>
        <h2>Detalles del Pedido:</h2>
        <table border="1" cellpadding="10" cellspacing="0" style="width: 100%; border-collapse: collapse;">
            <thead><tr style="background-color: #f2f2f2;"><th>Producto</th><th>Cantidad</th><th>Subtotal</th></tr></thead>
            <tbody>
                ${orderData.items.map(item => `
                    <tr>
                        <td>${item.name}</td>
                        <td style="text-align: center;">${item.quantity}</td>
                        <td style="text-align: right;">$${(item.price * item.quantity).toLocaleString('es-AR')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <h3 style="text-align: right;"><strong>Total del Pedido: $${orderData.total.toLocaleString('es-AR')}</strong></h3>
        <p><strong>Método de pago seleccionado:</strong> ${orderData.metodoPago}</p>
        <hr>
        <p style="font-size: 0.9em; color: #777;">Este es un correo automático generado desde el sitio web.</p>
    `;

    const mailOptions = {
        from: `"NOVA Panes Web" <${process.env.EMAIL_USER}>`,
        // ======================= CAMBIO REALIZADO AQUÍ =======================
        to: 'panes.nova@gmail.com', // Correo de destino corregido
        // ======================= FIN DEL CAMBIO ============================
        subject: `Nuevo Pedido de ${orderData.customer.nombre}`,
        html: emailBody,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Correo de pedido enviado exitosamente.');
        res.status(200).json({ message: 'Pedido recibido y correo enviado.' });
    } catch (error) {
        console.error('Error al enviar el correo del pedido:', error);
        res.status(500).json({ message: 'Error interno al procesar el pedido por email.' });
    }
});


// ==========================================
//      RUTA DE MERCADO PAGO
// ==========================================
app.post('/create-preference', async (req, res) => {
    try {
        const serverProducts = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8'));
        const clientItems = req.body.items;

        if (!clientItems || clientItems.length === 0) {
            return res.status(400).json({ message: 'El carrito está vacío.' });
        }

        const finalItems = clientItems.map(clientItem => {
            const productFromServer = serverProducts.find(p => p.id === clientItem.id);
            if (!productFromServer) throw new Error(`Producto con ID ${clientItem.id} no encontrado.`);
            if (clientItem.quantity > productFromServer.stock) throw new Error(`Cantidad para "${productFromServer.name}" excede el stock.`);
            return {
                id: productFromServer.id.toString(),
                title: productFromServer.name,
                quantity: clientItem.quantity,
                unit_price: productFromServer.price,
                currency_id: 'ARS',
            };
        });
        
        const payer = req.body.payer;
        if (!payer || !payer.name || !payer.email || !payer.phone || !payer.phone.number) {
            return res.status(400).json({ message: 'Faltan datos del comprador.' });
        }

        const bodyRequest = {
            items: finalItems,
            payer: { name: payer.name, email: payer.email, phone: { number: payer.phone.number } },
            back_urls: {
                success: "https://novapanes.com.ar/shop.html?payment=success",
                failure: "https://novapanes.com.ar/shop.html?payment=failure",
                pending: "https://novapanes.com.ar/shop.html?payment=pending",
            },
            auto_return: "approved",
            statement_descriptor: "NOVAPANES",
        };

        const preference = new Preference(client);
        const result = await preference.create({ body: bodyRequest });
        res.status(201).json({ id: result.id, init_point: result.init_point });
    } catch (error) {
        console.error('Error al crear preferencia de Mercado Pago:', error.message);
        res.status(500).json({ message: error.message || 'Error al procesar el pago.' });
    }
});


app.listen(port, () => {
    console.log(`Servidor de NOVA Panes corriendo en el puerto ${port}`);
    if (!process.env.ADMIN_PASSWORD_HASH) console.warn('ADVERTENCIA: ADMIN_PASSWORD_HASH no está configurado en .env.');
    if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) console.warn('ADVERTENCIA: MERCADO_PAGO_ACCESS_TOKEN no está configurado en .env.');
    if (!process.env.SESSION_SECRET) console.warn('ADVERTENCIA: SESSION_SECRET no está configurado en .env.');
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) console.warn('ADVERTENCIA: Credenciales de EMAIL no configuradas en .env.');
});