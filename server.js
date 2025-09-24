// ===================================================
//      ARCHIVO server.js (VERSIÓN CORREGIDA PARA PRODUCCIÓN)
// ===================================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
require('dotenv').config();
const session = require('express-session');

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
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-2704302134467517-090918-811730b9fe1b3c013dfe9480874e87d9-2683089128' });

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

// Servir archivos estáticos (frontend, imágenes, css, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Servir la carpeta de admin
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});

// Ruta principal para la tienda
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PRODUCTS_FILE_PATH = path.join(__dirname, 'products.json');

// ==========================================
//      RUTAS DE API PARA PRODUCTOS (CRUD)
// ==========================================
const adminRouter = express.Router();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

adminRouter.use(async (req, res, next) => {
    const plainTextPassword = req.headers['authorization'];
    if (!plainTextPassword || !ADMIN_PASSWORD_HASH) {
        return res.status(401).json({ message: 'Contraseña no proporcionada.' });
    }
    try {
        const match = await bcrypt.compare(plainTextPassword, ADMIN_PASSWORD_HASH);
        if (match) {
            next();
        } else {
            res.status(403).json({ message: 'Acceso denegado.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: true, 
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 1 día
    }
}));

adminRouter.get('/products', (req, res) => {
    const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH));
    res.json(products);
});

adminRouter.get('/products/:id', (req, res) => {
    const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH));
    const product = products.find(p => p.id === parseInt(req.params.id));
    if (product) res.json(product);
    else res.status(404).json({ message: 'Producto no encontrado' });
});

adminRouter.post('/products', upload.single('image'), (req, res) => {
    const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH));
    const newProduct = {
        id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
        name: req.body.name,
        description: req.body.description,
        price: parseFloat(req.body.price),
        image: `productos/${req.file.filename}`,
        category: req.body.category,
        stock: parseInt(req.body.stock)
    };
    products.push(newProduct);
    fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2));
    res.status(201).json(newProduct);
});

adminRouter.put('/products/:id', upload.single('image'), (req, res) => {
    const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH));
    const productIndex = products.findIndex(p => p.id === parseInt(req.params.id));
    if (productIndex === -1) return res.status(404).json({ message: 'Producto no encontrado' });
    const updatedProduct = { ...products[productIndex], ...req.body };
    updatedProduct.price = parseFloat(req.body.price);
    updatedProduct.stock = parseInt(req.body.stock);
    if (req.file) {
        updatedProduct.image = `productos/${req.file.filename}`;
    }
    products[productIndex] = updatedProduct;
    fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2));
    res.json(updatedProduct);
});

adminRouter.delete('/products/:id', (req, res) => {
    let products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH));
    const updatedProducts = products.filter(p => p.id !== parseInt(req.params.id));
    if (products.length === updatedProducts.length) {
        return res.status(404).json({ message: 'Producto no encontrado' });
    }
    fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(updatedProducts, null, 2));
    res.status(200).json({ message: 'Producto eliminado' });
});

app.use('/api', adminRouter);

// ==========================================
//      RUTA DE MERCADO PAGO
// ==========================================
const createPreferenceValidationRules = () => [ /* ... reglas ... */ ];

app.post('/create-preference', createPreferenceValidationRules(), async (req, res) => {
    // ... tu lógica de mercado pago ...
    try {
        const serverProducts = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH));
        const clientItems = req.body.items;
        const finalItems = clientItems.map(clientItem => {
            const productFromServer = serverProducts.find(p => p.id === clientItem.id);
            if (!productFromServer) throw new Error(`Producto con ID ${clientItem.id} no encontrado.`);
            return {
                id: productFromServer.id,
                title: productFromServer.name,
                quantity: clientItem.quantity,
                unit_price: productFromServer.price,
            };
        });

        const bodyRequest = {
            items: finalItems,
            payer: req.body.payer,
            back_urls: {
                success: "https://novapanes.com.ar/shop.html",
                failure: "https://novapanes.com.ar/shop.html",
                pending: "https://novapanes.com.ar/shop.html",
            },
            auto_return: "approved",
            statement_descriptor: "NOVAPANES",
        };

        const preference = new Preference(client);
        const result = await preference.create({ body: bodyRequest });
        res.status(201).json({ id: result.id, init_point: result.init_point });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.listen(port, () => {
    console.log(`Servidor de NOVA Panes corriendo en el puerto ${port}`);
});