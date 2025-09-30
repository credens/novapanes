// ===================================================
//      ARCHIVO server.js (VERSIÓN CON ADMIN MEJORADO)
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

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'productos')),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

const { MercadoPagoConfig, Preference } = require('mercadopago');
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN });

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PRODUCTS_FILE_PATH = path.join(__dirname, 'public', 'products.json');
const CATEGORIES_FILE_PATH = path.join(__dirname, 'public', 'data', 'categories.json');

// ==========================================
//      RUTAS DE API PARA ADMIN - Requieren autenticación
// ==========================================
const adminRouter = express.Router();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// Middleware de autenticación para todas las rutas bajo /api/admin
adminRouter.use(async (req, res, next) => {
    const plainTextPassword = req.headers['authorization']; 
    if (!plainTextPassword) return res.status(401).json({ message: 'Contraseña de API no proporcionada.' });
    if (!ADMIN_PASSWORD_HASH) {
        if (plainTextPassword === 'superadmin') return next();
        else return res.status(403).json({ message: 'Acceso denegado.' });
    }
    try {
        const match = await bcrypt.compare(plainTextPassword, ADMIN_PASSWORD_HASH);
        if (match) next();
        else res.status(403).json({ message: 'Acceso denegado.' });
    } catch (error) {
        res.status(500).json({ message: 'Error de servidor en autenticación.' });
    }
});

app.use('/api/admin', adminRouter);

// --- CRUD PARA PRODUCTOS ---
adminRouter.get('/products', (req, res) => { try { res.json(JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8'))); } catch (e) { res.status(500).json({ message: 'Error al obtener productos.' }); } });
adminRouter.post('/products', upload.single('image'), (req, res) => { if (!req.file || !req.body.name) return res.status(400).json({ message: 'Faltan campos o imagen.' }); try { const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8')); const newProduct = { id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1, name: req.body.name, description: req.body.description, price: parseFloat(req.body.price), stock: parseInt(req.body.stock), category: req.body.category, image: `productos/${req.file.filename}` }; products.push(newProduct); fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2)); res.status(201).json(newProduct); } catch (e) { console.error(e); res.status(500).json({ message: 'Error al añadir producto.' }); } });
adminRouter.put('/products/:id', upload.single('image'), (req, res) => { try { let products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8')); const index = products.findIndex(p => p.id === parseInt(req.params.id)); if (index === -1) return res.status(404).json({ message: 'Producto no encontrado.' }); const oldProduct = products[index]; const updatedProduct = { ...oldProduct, name: req.body.name, description: req.body.description, price: parseFloat(req.body.price), stock: parseInt(req.body.stock), category: req.body.category }; if (req.file) { if (oldProduct.image) { const oldPath = path.join(__dirname, 'public', oldProduct.image); if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } updatedProduct.image = `productos/${req.file.filename}`; } products[index] = updatedProduct; fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2)); res.json(updatedProduct); } catch (e) { console.error(e); res.status(500).json({ message: 'Error al actualizar producto.' }); } });
adminRouter.delete('/products/:id', (req, res) => { try { let products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8')); const product = products.find(p => p.id === parseInt(req.params.id)); if (!product) return res.status(404).json({ message: 'Producto no encontrado.' }); if (product.image) { const imgPath = path.join(__dirname, 'public', product.image); if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath); } products = products.filter(p => p.id !== parseInt(req.params.id)); fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2)); res.status(200).json({ message: 'Producto eliminado.' }); } catch (e) { res.status(500).json({ message: 'Error al eliminar producto.' }); } });

// --- CRUD PARA CATEGORÍAS ---
adminRouter.get('/categories', (req, res) => { try { res.json(JSON.parse(fs.readFileSync(CATEGORIES_FILE_PATH, 'utf-8'))); } catch (e) { res.status(500).json({ message: 'Error al obtener categorías.' }); } });
adminRouter.post('/categories', (req, res) => { try { const categories = JSON.parse(fs.readFileSync(CATEGORIES_FILE_PATH, 'utf-8')); const newCategory = { id: req.body.name.toLowerCase().replace(/\s+/g, '-').normalize("NFD").replace(/[\u0300-\u036f]/g, ""), name: req.body.name }; if (categories.some(c => c.id === newCategory.id)) return res.status(400).json({ message: 'La categoría ya existe.' }); categories.push(newCategory); fs.writeFileSync(CATEGORIES_FILE_PATH, JSON.stringify(categories, null, 2)); res.status(201).json(newCategory); } catch (e) { res.status(500).json({ message: 'Error al crear la categoría.' }); } });
adminRouter.delete('/categories/:id', (req, res) => { try { const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8')); if (products.some(p => p.category === req.params.id)) return res.status(400).json({ message: 'Categoría en uso por productos.' }); let categories = JSON.parse(fs.readFileSync(CATEGORIES_FILE_PATH, 'utf-8')); categories = categories.filter(c => c.id !== req.params.id); fs.writeFileSync(CATEGORIES_FILE_PATH, JSON.stringify(categories, null, 2)); res.status(200).json({ message: 'Categoría eliminada.' }); } catch (e) { res.status(500).json({ message: 'Error al eliminar la categoría.' }); } });

// ==========================================
//      ENDPOINT DE VERIFICACIÓN DE CONTRASEÑA
// ==========================================
app.post('/api/admin/verify', express.json(), async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'No se proporcionó contraseña.' });
    try {
        if (!ADMIN_PASSWORD_HASH) {
            return res.json({ success: password === 'superadmin' });
        }
        const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
        res.json({ success: match });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error del servidor.' });
    }
});

// ==========================================
//      RUTAS PÚBLICAS (shop, email, etc.)
// ==========================================
app.get('/products', (req, res) => { try { res.json(JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8'))); } catch (e) { res.status(500).json({ message: 'Error al obtener productos.' }); } });

app.post('/api/submit-order', async (req, res) => {
    const orderData = req.body;
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD } });
    const emailBody = `<h1>🍞 Nuevo Pedido Recibido - NOVA Panes 🍞</h1><h2>Detalles del Cliente:</h2><ul><li><strong>Nombre:</strong> ${orderData.customer.nombre}</li><li><strong>Email:</strong> ${orderData.customer.email}</li><li><strong>Teléfono:</strong> ${orderData.customer.telefono}</li><li><strong>Dirección:</strong> ${orderData.customer.direccion}, ${orderData.customer.ciudad}</li>${orderData.customer.codigoPostal ? `<li><strong>CP:</strong> ${orderData.customer.codigoPostal}</li>` : ''}${orderData.customer.referencias ? `<li><strong>Referencias:</strong> ${orderData.customer.referencias}</li>` : ''}</ul><h2>Detalles del Pedido:</h2><table border="1" cellpadding="10" cellspacing="0" style="width: 100%; border-collapse: collapse;"><thead><tr style="background-color: #f2f2f2;"><th>Producto</th><th>Cantidad</th><th>Subtotal</th></tr></thead><tbody>${orderData.items.map(item => `<tr><td>${item.name}</td><td style="text-align: center;">${item.quantity}</td><td style="text-align: right;">$${(item.price * item.quantity).toLocaleString('es-AR')}</td></tr>`).join('')}</tbody></table><h3 style="text-align: right;"><strong>Total del Pedido: $${orderData.total.toLocaleString('es-AR')}</strong></h3><p><strong>Método de pago seleccionado:</strong> ${orderData.metodoPago}</p><hr><p style="font-size: 0.9em; color: #777;">Este es un correo automático generado desde el sitio web.</p>`;
    const mailOptions = { from: `"NOVA Panes Web" <${process.env.EMAIL_USER}>`, to: 'panes.nova@gmail.com', subject: `Nuevo Pedido de ${orderData.customer.nombre}`, html: emailBody };
    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Pedido recibido y correo enviado.' });
    } catch (error) {
        res.status(500).json({ message: 'Error al procesar el pedido por email.' });
    }
});

app.post('/create-preference', async (req, res) => {
    try {
        const serverProducts = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8'));
        const { items, payer } = req.body;
        if (!items || items.length === 0) return res.status(400).json({ message: 'El carrito está vacío.' });
        const finalItems = items.map(item => { const p = serverProducts.find(sp => sp.id === item.id); if (!p) throw new Error(`Producto ID ${item.id} no encontrado.`); if (item.quantity > p.stock) throw new Error(`Stock insuficiente para ${p.name}.`); return { id: p.id.toString(), title: p.name, quantity: item.quantity, unit_price: p.price, currency_id: 'ARS' }; });
        const body = { items: finalItems, payer, back_urls: { success: "https://novapanes.com.ar/shop.html?payment=success", failure: "https://novapanes.com.ar/shop.html?payment=failure", pending: "https://novapanes.com.ar/shop.html?payment=pending" }, auto_return: "approved", statement_descriptor: "NOVAPANES" };
        const preference = new Preference(client);
        const result = await preference.create({ body });
        res.status(201).json({ id: result.id, init_point: result.init_point });
    } catch (error) {
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