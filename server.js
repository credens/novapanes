// ===================================================
//      ARCHIVO server.js (COMPLETO - VERSIÓN FINAL)
// ===================================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();
const session = require('express-session');
const nodemailer = require('nodemailer');
const multer = require('multer');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Captura de errores globales para evitar caídas del servidor
process.on('uncaughtException', (err) => {
    console.error('ERROR INESPERADO EN EL SERVIDOR:', err);
});

const port = process.env.PORT || 3000;
const app = express();

// CONFIGURACIÓN DE MERCADO PAGO
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || ''
});

// CONFIGURACIÓN DE ALMACENAMIENTO DE IMÁGENES (MULTER)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'productos');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10 MB
});

// MIDDLEWARES GENERALES
app.use(express.json({ limit: '10mb' }));
app.use(cors({ origin: 'https://novapanes.com.ar' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuración de Sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'novapanes-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', 
        httpOnly: true, 
        maxAge: 1000 * 60 * 60 * 24 
    }
}));

// RUTAS DE ARCHIVOS DE DATOS (JSON)
const DATA_DIR = path.join(__dirname, 'public', 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const PRODUCTS_FILE = path.join(__dirname, 'public', 'products.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const VISITS_FILE = path.join(DATA_DIR, 'visits.json');

// FUNCIONES HELPER PARA MANEJO DE JSON
function readDatabase(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '[]');
            return [];
        }
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error(`Error de lectura en ${filePath}:`, error);
        return [];
    }
}

function writeDatabase(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error de escritura en ${filePath}:`, error);
    }
}

// --- SERVICIO DE ARCHIVOS ESTÁTICOS ---

// SEO TÉCNICO: Evitar indexación de la carpeta admin mediante Header
app.use('/admin', (req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
}, express.static(path.join(__dirname, 'admin')));

app.use(express.static(path.join(__dirname, 'public')));

// --- RATE LIMITERS ---
const contactLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, message: { success: false, error: 'Demasiados intentos. Esperá un minuto.' } });
const visitLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { success: false } });
const orderLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { success: false, error: 'Demasiados pedidos. Esperá un minuto.' } });

// --- API PÚBLICA ---

// Obtener productos para la tienda
app.get('/products', (req, res) => {
    res.json(readDatabase(PRODUCTS_FILE));
});

// Registro de visitas (SEO Analytics Interno)
app.post('/api/track-visit', visitLimiter, (req, res) => {
    try {
        let visits = readDatabase(VISITS_FILE);
        visits.push({
            date: new Date().toISOString(),
            userAgent: req.headers['user-agent']
        });
        if (visits.length > 10000) visits = visits.slice(-10000);
        writeDatabase(VISITS_FILE, visits);
        res.status(200).json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// Formulario de Contacto (Nodemailer)
app.post('/api/contact', contactLimiter, [
    body('nombre').trim().notEmpty().escape(),
    body('email').isEmail().normalizeEmail(),
    body('telefono').trim().notEmpty().escape(),
    body('mensaje').trim().notEmpty().escape()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Datos inválidos.' });
    const { nombre, email, telefono, mensaje } = req.body;
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'panes.nova@gmail.com',
        subject: `Nueva Consulta Web: ${nombre}`,
        html: `<h2>Detalle de Contacto</h2>
               <p><b>Nombre:</b> ${nombre}</p>
               <p><b>Email:</b> ${email}</p>
               <p><b>Teléfono:</b> ${telefono}</p>
               <p><b>Mensaje:</b> ${mensaje}</p>`
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Consulta enviada correctamente.' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Procesar Pedido (WhatsApp + Email + Registro)
app.post('/api/submit-order', orderLimiter, [
    body('items').isArray({ min: 1 }),
    body('items.*.name').trim().notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('customer.nombre').trim().notEmpty().escape(),
    body('total').isFloat({ min: 0 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Datos del pedido inválidos.' });
    try {
        const orderData = req.body;
        const orders = readDatabase(ORDERS_FILE);
        const newOrder = {
            id: `ORD-${Date.now()}`,
            ...orderData,
            date: new Date().toISOString(),
            status: 'pending'
        };
        orders.unshift(newOrder);
        writeDatabase(ORDERS_FILE, orders);

        // Envío de notificación por correo al administrador
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD }
        });

        const itemsList = orderData.items.map(i => `<li>${i.name} x${i.quantity}</li>`).join('');
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: 'panes.nova@gmail.com',
            subject: `🍞 Nuevo Pedido Recibido: ${orderData.customer.nombre}`,
            html: `<h3>Resumen del Pedido</h3><ul>${itemsList}</ul><p>Total: $${orderData.total}</p>`
        });

        res.json({ success: true, orderId: newOrder.id });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// --- INTEGRACIÓN MERCADO PAGO ---

app.post('/create-preference', [
    body('items').isArray({ min: 1 }),
    body('items.*.title').trim().notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('items.*.unit_price').isFloat({ min: 0 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Items inválidos.' });
    try {
        const preference = new Preference(client);
        const body = {
            items: req.body.items.map(item => ({
                title: item.title,
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
                currency_id: 'ARS'
            })),
            back_urls: {
                success: "https://novapanes.com.ar/shop.html?payment=success",
                failure: "https://novapanes.com.ar/shop.html?payment=failure",
                pending: "https://novapanes.com.ar/shop.html?payment=pending"
            },
            auto_return: "approved",
        };

        const result = await preference.create({ body });
        res.json({ init_point: result.init_point });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- API DE ADMINISTRACIÓN (PROTEGIDA) ---

// Verificar password de admin
app.post('/api/admin/verify', async (req, res) => {
    const { password } = req.body;
    try {
        const hash = process.env.ADMIN_PASSWORD_HASH;
        const match = await bcrypt.compare(password, hash);
        res.json({ success: match });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

const adminRouter = express.Router();

// Middleware de seguridad para el Router de Admin
adminRouter.use(async (req, res, next) => {
    const auth = req.headers['authorization'];
    if (!auth) return res.status(401).json({ message: "No autorizado" });
    
    const match = await bcrypt.compare(auth, process.env.ADMIN_PASSWORD_HASH || "");
    if (match) {
        // SEO TÉCNICO: Las respuestas de la API de admin no deben ser indexadas
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        next();
    } else {
        res.status(403).json({ message: "Acceso denegado" });
    }
});

// Endpoints de Administración
adminRouter.get('/visits', (req, res) => res.json(readDatabase(VISITS_FILE)));
adminRouter.get('/orders', (req, res) => res.json(readDatabase(ORDERS_FILE)));
adminRouter.get('/categories', (req, res) => res.json(readDatabase(CATEGORIES_FILE)));
adminRouter.get('/products', (req, res) => res.json(readDatabase(PRODUCTS_FILE)));

// Crear Producto
adminRouter.post('/products', upload.single('image'), (req, res) => {
    const products = readDatabase(PRODUCTS_FILE);
    const newProduct = {
        id: Date.now(),
        name: req.body.name,
        description: req.body.description,
        price: parseFloat(req.body.price),
        promo_price: req.body.promo_price ? parseFloat(req.body.promo_price) : null,
        stock: parseInt(req.body.stock),
        category: req.body.category,
        image: req.file ? `productos/${req.file.filename}` : 'productos/default.png'
    };
    products.push(newProduct);
    writeDatabase(PRODUCTS_FILE, products);
    res.status(201).json(newProduct);
});

// Editar Producto
adminRouter.put('/products/:id', upload.single('image'), (req, res) => {
    let products = readDatabase(PRODUCTS_FILE);
    const index = products.findIndex(p => p.id == req.params.id);
    if (index !== -1) {
        const updatedProduct = { ...products[index], ...req.body };
        if (req.body.price) updatedProduct.price = parseFloat(req.body.price);
        if (req.body.stock) updatedProduct.stock = parseInt(req.body.stock);
        if (req.body.promo_price) updatedProduct.promo_price = parseFloat(req.body.promo_price);
        if (req.file) updatedProduct.image = `productos/${req.file.filename}`;
        products[index] = updatedProduct;
        writeDatabase(PRODUCTS_FILE, products);
        res.json(updatedProduct);
    } else {
        res.status(404).json({ message: "Producto no encontrado" });
    }
});

// Eliminar Producto
adminRouter.delete('/products/:id', (req, res) => {
    let products = readDatabase(PRODUCTS_FILE);
    products = products.filter(p => p.id != req.params.id);
    writeDatabase(PRODUCTS_FILE, products);
    res.json({ success: true });
});

// Crear Categoría
adminRouter.post('/categories', (req, res) => {
    const categories = readDatabase(CATEGORIES_FILE);
    const newCategory = {
        id: req.body.name.toLowerCase().trim().replace(/\s+/g, '-'),
        name: req.body.name
    };
    categories.push(newCategory);
    writeDatabase(CATEGORIES_FILE, categories);
    res.status(201).json(newCategory);
});

// Eliminar Categoría
adminRouter.delete('/categories/:id', (req, res) => {
    let categories = readDatabase(CATEGORIES_FILE);
    categories = categories.filter(c => c.id !== req.params.id);
    writeDatabase(CATEGORIES_FILE, categories);
    res.json({ success: true });
});

// Actualizar Estado de Pedido
adminRouter.put('/orders/:id', (req, res) => {
    let orders = readDatabase(ORDERS_FILE);
    const index = orders.findIndex(o => o.id === req.params.id);
    if (index !== -1) {
        orders[index].status = req.body.status;
        writeDatabase(ORDERS_FILE, orders);
        res.json({ success: true });
    } else {
        res.status(404).json({ message: "Pedido no encontrado" });
    }
});

app.use('/api/admin', adminRouter);

// LANZAMIENTO DEL SERVIDOR
app.listen(port, () => {
    console.log(`\n--- NOVA PANES SERVER ---`);
    console.log(`Servidor activo en: http://localhost:${port}`);
    console.log(`Área administrativa: http://localhost:${port}/admin/admin.html`);
    console.log(`--------------------------\n`);
});