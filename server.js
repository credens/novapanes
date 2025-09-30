// ===================================================
//      ARCHIVO server.js (VERSIÓN FINAL Y ROBUSTA)
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

// --- MANEJO DE ERRORES INESPERADOS ---
process.on('uncaughtException', (err) => {
  console.error('ERROR INESPERADO (UNCAUGHT EXCEPTION):', err);
  process.exit(1);
});

// --- CONFIGURACIONES ---
const port = process.env.PORT || 3000;
const app = express();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'productos')),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

const { MercadoPagoConfig, Preference } = require('mercadopago');
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN });

// --- MIDDLEWARES ---
app.use(express.json());
app.use(cors());
app.use(session({ secret: process.env.SESSION_SECRET || 'supersecretkey', resave: false, saveUninitialized: false, cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 1000 * 60 * 60 * 24 } }));

// --- SERVIR ARCHIVOS ESTÁTICOS ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// --- RUTAS DE ARCHIVOS DE DATOS ---
const PRODUCTS_FILE_PATH = path.join(__dirname, 'public', 'products.json');
const CATEGORIES_FILE_PATH = path.join(__dirname, 'public', 'data', 'categories.json');

function readJsonFile(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        console.error(`Error al leer el archivo JSON: ${filePath}`, error);
        throw new Error(`No se pudo leer el archivo de datos: ${path.basename(filePath)}`);
    }
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error al escribir en el archivo JSON: ${filePath}`, error);
        throw new Error(`No se pudo guardar el archivo de datos: ${path.basename(filePath)}`);
    }
}

// --- RUTAS DE PÁGINAS HTML ---
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ==========================================
//      RUTAS DE API PARA ADMIN
// ==========================================
const adminRouter = express.Router();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

adminRouter.use(async (req, res, next) => { const plainTextPassword = req.headers['authorization']; if (!plainTextPassword) return res.status(401).json({ message: 'Contraseña de API no proporcionada.' }); if (!ADMIN_PASSWORD_HASH) { if (plainTextPassword === 'superadmin') return next(); else return res.status(403).json({ message: 'Acceso denegado.' }); } try { const match = await bcrypt.compare(plainTextPassword, ADMIN_PASSWORD_HASH); if (match) next(); else res.status(403).json({ message: 'Acceso denegado.' }); } catch (error) { res.status(500).json({ message: 'Error de servidor en autenticación.' }); } });
app.use('/api/admin', adminRouter);

// CRUD de productos
adminRouter.get('/products', (req, res) => { try { res.json(readJsonFile(PRODUCTS_FILE_PATH)); } catch (e) { res.status(500).json({ message: e.message }); } });
adminRouter.post('/products', upload.single('image'), (req, res) => { try { if (!req.file || !req.body.name) return res.status(400).json({ message: 'Faltan campos o imagen.' }); const products = readJsonFile(PRODUCTS_FILE_PATH); const newProduct = { id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1, name: req.body.name, description: req.body.description, price: parseFloat(req.body.price), stock: parseInt(req.body.stock), category: req.body.category, image: `productos/${req.file.filename}` }; products.push(newProduct); writeJsonFile(PRODUCTS_FILE_PATH, products); res.status(201).json(newProduct); } catch (e) { res.status(500).json({ message: e.message }); } });
adminRouter.put('/products/:id', upload.single('image'), (req, res) => { try { let products = readJsonFile(PRODUCTS_FILE_PATH); const index = products.findIndex(p => p.id === parseInt(req.params.id)); if (index === -1) return res.status(404).json({ message: 'Producto no encontrado.' }); const oldProduct = products[index]; const updatedProduct = { ...oldProduct, name: req.body.name, description: req.body.description, price: parseFloat(req.body.price), stock: parseInt(req.body.stock), category: req.body.category }; if (req.file) { if (oldProduct.image) { const oldPath = path.join(__dirname, 'public', oldProduct.image); if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } updatedProduct.image = `productos/${req.file.filename}`; } products[index] = updatedProduct; writeJsonFile(PRODUCTS_FILE_PATH, products); res.json(updatedProduct); } catch (e) { res.status(500).json({ message: e.message }); } });
adminRouter.delete('/products/:id', (req, res) => { try { let products = readJsonFile(PRODUCTS_FILE_PATH); const product = products.find(p => p.id === parseInt(req.params.id)); if (!product) return res.status(404).json({ message: 'Producto no encontrado.' }); if (product.image) { const imgPath = path.join(__dirname, 'public', product.image); if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath); } products = products.filter(p => p.id !== parseInt(req.params.id)); writeJsonFile(PRODUCTS_FILE_PATH, products); res.status(200).json({ message: 'Producto eliminado.' }); } catch (e) { res.status(500).json({ message: e.message }); } });

// CRUD de categorías
adminRouter.get('/categories', (req, res) => { try { res.json(readJsonFile(CATEGORIES_FILE_PATH)); } catch (e) { res.status(500).json({ message: e.message }); } });
adminRouter.post('/categories', (req, res) => { try { const categories = readJsonFile(CATEGORIES_FILE_PATH); const newCategory = { id: req.body.name.toLowerCase().replace(/\s+/g, '-').normalize("NFD").replace(/[\u0300-\u036f]/g, ""), name: req.body.name }; if (categories.some(c => c.id === newCategory.id)) return res.status(400).json({ message: 'La categoría ya existe.' }); categories.push(newCategory); writeJsonFile(CATEGORIES_FILE_PATH, categories); res.status(201).json(newCategory); } catch (e) { res.status(500).json({ message: e.message }); } });
adminRouter.delete('/categories/:id', (req, res) => { try { const products = readJsonFile(PRODUCTS_FILE_PATH); if (products.some(p => p.category === req.params.id)) return res.status(400).json({ message: 'Categoría en uso por productos.' }); let categories = readJsonFile(CATEGORIES_FILE_PATH); categories = categories.filter(c => c.id !== req.params.id); writeJsonFile(CATEGORIES_FILE_PATH, categories); res.status(200).json({ message: 'Categoría eliminada.' }); } catch (e) { res.status(500).json({ message: e.message }); } });

// ==========================================
//      ENDPOINT DE VERIFICACIÓN (CON DIAGNÓSTICO)
// ==========================================
app.post('/api/admin/verify', express.json(), async (req, res) => { const { password } = req.body; const hashFromEnv = process.env.ADMIN_PASSWORD_HASH; console.log("\n\n============================================="); console.log("INICIANDO VERIFICACIÓN DE CONTRASEÑA EN VIVO"); console.log("============================================="); console.log(`1. Contraseña recibida del pop-up: [${password}]`); console.log(`   - Tipo de dato: ${typeof password}`); console.log(`   - Longitud: ${password ? password.length : 'N/A'}`); console.log(`2. Hash leído del archivo .env: [${hashFromEnv}]`); console.log(`   - Tipo de dato: ${typeof hashFromEnv}`); console.log(`   - Longitud: ${hashFromEnv ? hashFromEnv.length : 'N/A'}`); if (!password || !hashFromEnv) { console.log("ERROR: Falta la contraseña o el hash. Abortando."); console.log("=============================================\n\n"); return res.status(400).json({ success: false, message: 'Falta la contraseña o el hash.' }); } try { console.log("3. Intentando comparar con bcrypt..."); const match = await bcrypt.compare(password, hashFromEnv); console.log(`4. Resultado de bcrypt.compare: ${match}`); if (match) { console.log("✅ ¡COINCIDEN! El login debería funcionar."); } else { console.log("❌ ¡NO COINCIDEN! Este es el origen del problema."); } console.log("============================================="); console.log("FIN DE LA VERIFICACIÓN\n\n"); res.json({ success: match }); } catch (error) { console.error("🚨 ERROR CRÍTICO durante bcrypt.compare:", error); console.log("=============================================\n\n"); res.status(500).json({ success: false, message: 'Error del servidor durante la comparación.' }); } });

// ==========================================
//      RUTAS PÚBLICAS
// ==========================================
app.get('/products', (req, res) => { try { res.json(readJsonFile(PRODUCTS_FILE_PATH)); } catch (e) { res.status(500).json({ message: e.message }); } });
app.post('/api/submit-order', async (req, res) => { const { customer, items, total, metodoPago } = req.body; const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD } }); const emailBody = `<h1>🍞 Pedido Recibido</h1><h2>Cliente:</h2><ul><li>${customer.nombre}</li><li>${customer.email}</li><li>${customer.telefono}</li><li>${customer.direccion}, ${customer.ciudad}</li></ul><h2>Pedido:</h2><table border="1" cellpadding="5" cellspacing="0"><thead><tr><th>Producto</th><th>Cant.</th><th>Subtotal</th></tr></thead><tbody>${items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>$${(i.price * i.quantity).toLocaleString('es-AR')}</td></tr>`).join('')}</tbody></table><h3>Total: $${total.toLocaleString('es-AR')}</h3><p>Pago: ${metodoPago}</p>`; const mailOptions = { from: `"NOVA Panes Web" <${process.env.EMAIL_USER}>`, to: 'panes.nova@gmail.com', subject: `Pedido de ${customer.nombre}`, html: emailBody }; try { await transporter.sendMail(mailOptions); res.status(200).json({ message: 'OK' }); } catch (e) { res.status(500).json({ message: 'Error en email.' }); } });
app.post('/create-preference', async (req, res) => { try { const { items, payer } = req.body; const serverProducts = readJsonFile(PRODUCTS_FILE_PATH); const finalItems = items.map(i => { const p = serverProducts.find(sp => sp.id === i.id); if (!p || i.quantity > p.stock) throw new Error('Producto o stock no válido'); return { id: p.id.toString(), title: p.name, quantity: i.quantity, unit_price: p.price, currency_id: 'ARS' }; }); const preference = new Preference(client); const result = await preference.create({ body: { items: finalItems, payer, back_urls: { success: "https://novapanes.com.ar/shop.html?payment=success", failure: "https://novapanes.com.ar/shop.html?payment=failure" }, auto_return: "approved" } }); res.status(201).json({ id: result.id, init_point: result.init_point }); } catch (e) { res.status(500).json({ message: e.message }); } });

// --- INICIAR SERVIDOR ---
try {
    app.listen(port, () => {
        console.log(`Servidor de NOVA Panes corriendo en http://localhost:${port}`);
        if (!process.env.ADMIN_PASSWORD_HASH) console.warn('ADVERTENCIA: ADMIN_PASSWORD_HASH no está configurado en .env.');
        // ... (otras advertencias)
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Error: El puerto ${port} ya está en uso. Asegúrate de que no haya otro servidor corriendo.`);
        } else {
            console.error('Error al iniciar el servidor:', err);
        }
        process.exit(1);
    });
} catch (error) {
    console.error('Error fatal al configurar el servidor:', error);
    process.exit(1);
}