const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();
const session = require('express-session');
const nodemailer = require('nodemailer');
const multer = require('multer');

process.on('uncaughtException', (err) => {
    console.error('ERROR INESPERADO:', err);
    process.exit(1);
});

const port = process.env.PORT || 3000;
const app = express();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'productos')),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

const { MercadoPagoConfig, Preference } = require('mercadopago');
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 1000 * 60 * 60 * 24 }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

const DATA_DIR = path.join(__dirname, 'public', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const PRODUCTS_FILE_PATH = path.join(__dirname, 'public', 'products.json');
const CATEGORIES_FILE_PATH = path.join(DATA_DIR, 'categories.json');
const ORDERS_FILE_PATH = path.join(DATA_DIR, 'orders.json');
const VISITS_FILE_PATH = path.join(DATA_DIR, 'visits.json');

function readJsonFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) { fs.writeFileSync(filePath, '[]'); return []; }
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) { return []; }
}

function writeJsonFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

app.post('/api/track-visit', (req, res) => {
    try {
        const visits = readJsonFile(VISITS_FILE_PATH);
        visits.push({ date: new Date().toISOString() });
        writeJsonFile(VISITS_FILE_PATH, visits);
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/verify', async (req, res) => {
    const { password } = req.body;
    try {
        const match = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH || "");
        res.json({ success: match });
    } catch (error) { res.status(500).json({ success: false }); }
});

const adminRouter = express.Router();
adminRouter.use(async (req, res, next) => {
    const auth = req.headers['authorization'];
    if (!auth) return res.status(401).send();
    const match = await bcrypt.compare(auth, process.env.ADMIN_PASSWORD_HASH || "");
    if (match) next(); else res.status(403).send();
});
app.use('/api/admin', adminRouter);

adminRouter.get('/visits', (req, res) => res.json(readJsonFile(VISITS_FILE_PATH)));
adminRouter.get('/products', (req, res) => res.json(readJsonFile(PRODUCTS_FILE_PATH)));
adminRouter.post('/products', upload.single('image'), (req, res) => {
    const products = readJsonFile(PRODUCTS_FILE_PATH);
    const newProduct = { id: Date.now(), ...req.body, price: parseFloat(req.body.price), image: `productos/${req.file.filename}` };
    products.push(newProduct);
    writeJsonFile(PRODUCTS_FILE_PATH, products);
    res.status(201).json(newProduct);
});
adminRouter.get('/orders', (req, res) => res.json(readJsonFile(ORDERS_FILE_PATH)));
adminRouter.put('/orders/:id', (req, res) => {
    const orders = readJsonFile(ORDERS_FILE_PATH);
    const idx = orders.findIndex(o => o.id === req.params.id);
    if (idx !== -1) { orders[idx].status = req.body.status; writeJsonFile(ORDERS_FILE_PATH, orders); }
    res.json({ success: true });
});

app.get('/products', (req, res) => res.json(readJsonFile(PRODUCTS_FILE_PATH)));

app.post('/api/contact', async (req, res) => {
    const { nombre, email, telefono, mensaje } = req.body;
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD }
    });
    const body = `<h2>Nueva Consulta</h2><p><b>Nombre:</b> ${nombre}</p><p><b>Email:</b> ${email}</p><p><b>Tel:</b> ${telefono}</p><p><b>Mensaje:</b> ${mensaje}</p>`;
    try {
        await transporter.sendMail({ from: process.env.EMAIL_USER, to: 'panes.nova@gmail.com', subject: `Consulta Web: ${nombre}`, html: body });
        res.json({ success: true, message: '¡Gracias! Te contactaremos pronto.' });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/submit-order', async (req, res) => {
    try {
        const orders = readJsonFile(ORDERS_FILE_PATH);
        const newOrder = { id: `order_${Date.now()}`, ...req.body, date: new Date().toISOString(), status: 'pending' };
        orders.unshift(newOrder);
        writeJsonFile(ORDERS_FILE_PATH, orders);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/create-preference', async (req, res) => {
    try {
        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: req.body.items.map(i => ({ title: i.title, quantity: i.quantity, unit_price: i.price, currency_id: 'ARS' })),
                payer: req.body.payer,
                back_urls: { success: "https://novapanes.com.ar/shop.html?payment=success" },
                auto_return: "approved"
            }
        });
        res.status(201).json({ init_point: result.init_point });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.listen(port, () => console.log(`Servidor activo en puerto ${port}`));