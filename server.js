// ===================================================
//      ARCHIVO server.js (VERSIÓN CON ADMIN PANEL)
// ===================================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
require('dotenv').config();
const session = require('express-session'); // <-- 1. IMPORTAR EXPRESS-SESSION


// --- 1. CONFIGURACIÓN PARA SUBIR IMÁGENES ---
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Guardamos las imágenes directamente en la carpeta de productos del frontend
        cb(null, path.join(__dirname, '../frontend/productos'));
    },
    filename: function (req, file, cb) {
        // Creamos un nombre de archivo único para evitar sobreescribir imágenes
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- (El resto de la configuración de Mercado Pago es igual) ---
const { MercadoPagoConfig, Preference } = require('mercadopago');
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-2704302134467517-090918-811730b9fe1b3c013dfe9480874e87d9-2683089128' });

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

// --- 1. SERVIR EL FRONTEND PÚBLICO ---
// Esta línea le dice a Express: "Cualquier petición que recibas, primero
// busca si hay un archivo con ese nombre en la carpeta 'public'. Si lo encuentras, sírvelo."
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. SERVIR LA CARPETA DE ADMIN ---
// Esto hará que los archivos dentro de la carpeta 'admin' sean accesibles desde el navegador.
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Luego, definimos una ruta específica para la URL '/admin' para que sirva tu archivo HTML.
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});

// --- 3. RUTA PRINCIPAL ---
// Si alguien va a la raíz de tu sitio (ej: http://localhost:3000/),
// le enviaremos el index.html de la tienda.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PRODUCTS_FILE_PATH = path.join(__dirname, 'products.json');

// ==========================================
//      RUTAS DE API PARA PRODUCTOS (CRUD) - VERSIÓN ACTUALIZADA
// ==========================================
const adminRouter = express.Router();

/// --- 3. "MIDDLEWARE" DE CONTRASEÑA MÁS SEGURO ---
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH; // <-- 3. CARGAR EL HASH DESDE .ENV

adminRouter.use(async (req, res, next) => {
    const plainTextPassword = req.headers['authorization'];

    if (!plainTextPassword || !ADMIN_PASSWORD_HASH) {
        return res.status(401).json({ message: 'Contraseña no proporcionada.' });
    }

    try {
        // <-- 4. COMPARAR LA CONTRASEÑA ENVIADA CON EL HASH GUARDADO
        const match = await bcrypt.compare(plainTextPassword, ADMIN_PASSWORD_HASH);
        if (match) {
            next(); // Contraseña correcta, continuar.
        } else {
            res.status(403).json({ message: 'Acceso denegado.' }); // Contraseña incorrecta.
        }
    } catch (error) {
        console.error("Error en la comparación de la contraseña:", error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// <-- 2. CONFIGURAR EL MIDDLEWARE DE SESIÓN -->
app.use(session({
    secret: process.env.SESSION_SECRET, // Carga el secreto desde el archivo .env
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Poner en 'true' si usas HTTPS
        httpOnly: true, // El cookie no es accesible desde JavaScript en el frontend
        maxAge: 1000 * 60 * 60 * 24 // La sesión dura 1 día
    }
}));

// GET - Obtener todos los productos (SIN CAMBIOS)
adminRouter.get('/products', (req, res) => {
    const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH));
    res.json(products);
});

// --- NUEVO: GET - Obtener un SOLO producto por su ID ---
adminRouter.get('/products/:id', (req, res) => {
    const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH));
    const product = products.find(p => p.id === parseInt(req.params.id));
    if (product) {
        res.json(product);
    } else {
        res.status(404).json({ message: 'Producto no encontrado' });
    }
});

// POST - Crear un nuevo producto (SIN CAMBIOS)
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
    fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 4));
    res.status(201).json(newProduct);
});

// --- NUEVO: PUT - Actualizar un producto existente por su ID ---
adminRouter.put('/products/:id', upload.single('image'), (req, res) => {
    const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH));
    const productId = parseInt(req.params.id);
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
        return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const updatedProduct = {
        ...products[productIndex], // Copia los datos antiguos
        name: req.body.name,
        description: req.body.description,
        price: parseFloat(req.body.price),
        stock: parseInt(req.body.stock),
        category: req.body.category,
    };
    
    // Si se subió una nueva imagen, actualizamos la ruta. Si no, mantenemos la antigua.
    if (req.file) {
        updatedProduct.image = `productos/${req.file.filename}`;
    }

    products[productIndex] = updatedProduct; // Reemplazamos el producto en el array
    fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 4));
    res.json(updatedProduct);
});

// DELETE - Borrar un producto por ID (SIN CAMBIOS)
adminRouter.delete('/products/:id', (req, res) => {
    let products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH));
    const productId = parseInt(req.params.id);
    const updatedProducts = products.filter(p => p.id !== productId);
    
    if (products.length === updatedProducts.length) {
        return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
    fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(updatedProducts, null, 4));
    res.status(200).json({ message: 'Producto eliminado' });
});

// Usamos el router con el prefijo /api y la protección de contraseña
app.use('/api', adminRouter);

// Usamos el router con el prefijo /api y la protección de contraseña
app.use('/api', adminRouter);

const createPreferenceValidationRules = () => {
    return [
        // Validar items del carrito
        body('items').isArray({ min: 1 }).withMessage('El carrito no puede estar vacío.'),
        body('items.*.id').notEmpty().withMessage('El ID del producto no puede estar vacío.'),
        body('items.*.title').notEmpty().escape().withMessage('El título del producto es requerido.'),
        body('items.*.quantity').isInt({ min: 1 }).withMessage('La cantidad debe ser un número positivo.'),
        body('items.*.unit_price').isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo.'),

        // Validar datos del comprador (payer)
        body('payer.name').notEmpty().trim().escape().withMessage('El nombre es requerido.'),
        body('payer.email').isEmail().normalizeEmail().withMessage('Debe ser un email válido.'),
        body('payer.phone.number').notEmpty().trim().escape().withMessage('El teléfono es requerido.'),
    ];
};

app.post('/create-preference', createPreferenceValidationRules(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    try {
        const clientItems = req.body.items;
        
        // --- 2. CONSTRUIMOS EL PEDIDO USANDO NUESTROS PROPIOS PRECIOS ---
        const finalItems = clientItems.map(clientItem => {
            const productFromServer = serverProducts.find(p => p.id === clientItem.id);
            if (!productFromServer) {
                // Si el producto no existe en nuestra lista, lanzamos un error.
                throw new Error(`Producto con ID ${clientItem.id} no encontrado.`);
            }
            return {
                id: productFromServer.id,
                title: productFromServer.name,
                quantity: clientItem.quantity, // La cantidad sí la aceptamos del cliente
                unit_price: productFromServer.price, // ¡USAMOS NUESTRO PRECIO, NO EL DEL CLIENTE!
            };
        });

        // --- 3. CREAMOS LA PREFERENCIA CON LOS DATOS SEGUROS ---
        const bodyRequest = {
            items: finalItems, // Usamos la lista de items que acabamos de construir
            payer: req.body.payer,
            back_urls: {
                success: "https://tupagina.github.io/tu-repositorio/shop.html",
                failure: "https://tupagina.github.io/tu-repositorio/shop.html",
                pending: "https://tupagina.github.io/tu-repositorio/shop.html",
            },
            auto_return: "approved",
            statement_descriptor: "NOVAPANES",
        };

        const preference = new Preference(client);
        const result = await preference.create({ body: bodyRequest });
        
        res.status(201).json({
            id: result.id,
            init_point: result.init_point,
        });

    } catch (error) {
        console.error('Error al procesar la preferencia:', error.message);
        res.status(500).json({ message: 'Error en el servidor al procesar el pedido.' });
    }
});

app.listen(port, () => {
    console.log(`¡Servidor unificado de NOVA Panes corriendo en http://localhost:${port}`);
    console.log(`Tienda principal disponible en -> http://localhost:${port}`);
    console.log(`Panel de Admin disponible en -> http://localhost:${port}/admin`);
});