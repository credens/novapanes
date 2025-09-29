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
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || 'APP_USR-2704302134467517-090918-811730b9fe1b3c013dfe9480874e87d9-2683089128' });

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Configuración de la sesión (para el futuro si se necesita persistencia de login)
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

// Servir la carpeta 'public' para el frontend (index.html, shop.html, estilos, scripts, imágenes de productos)
// Esto debe ir ANTES de cualquier ruta específica para HTML o subdirectorios de 'public'.
app.use(express.static(path.join(__dirname, 'public')));

// Servir la carpeta 'admin' para el panel de administración y sus assets (CSS, JS)
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Ruta específica para el archivo admin.html
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});

// Ruta principal para la tienda
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- CAMBIO CLAVE AQUÍ ---
// Define la ruta a products.json, ahora apuntando DENTRO de la carpeta 'public'
const PRODUCTS_FILE_PATH = path.join(__dirname, 'public', 'products.json');
// -------------------------

// ==========================================
//      RUTAS DE API PARA PRODUCTOS (CRUD) - Requieren autenticación de administrador
// ==========================================
const adminRouter = express.Router();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// Middleware de autenticación para todas las rutas bajo /api/admin
adminRouter.use(async (req, res, next) => {
    const plainTextPassword = req.headers['authorization']; 
    
    if (!plainTextPassword) {
        return res.status(401).json({ message: 'Contraseña de API no proporcionada.' });
    }
    
    if (!ADMIN_PASSWORD_HASH) {
        console.warn('ADMIN_PASSWORD_HASH no está configurado en .env. Acceso de administrador deshabilitado o con contraseña de desarrollo "superadmin".');
        if (plainTextPassword === 'superadmin') { 
            return next();
        } else {
            return res.status(403).json({ message: 'Acceso denegado. Contraseña de desarrollo incorrecta o ADMIN_PASSWORD_HASH no configurado.' });
        }
    }

    try {
        const match = await bcrypt.compare(plainTextPassword, ADMIN_PASSWORD_HASH);
        if (match) {
            next();
        } else {
            res.status(403).json({ message: 'Acceso denegado. Contraseña de administrador incorrecta.' });
        }
    } catch (error) {
        console.error('Error en el middleware de autenticación del administrador:', error);
        res.status(500).json({ message: 'Error interno del servidor durante la autenticación.' });
    }
});

// Todas las rutas de CRUD de productos ahora están bajo '/api/admin' y requieren autenticación
app.use('/api/admin', adminRouter);

// Obtener todos los productos (admin)
adminRouter.get('/products', (req, res) => {
    try {
        const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8'));
        res.json(products);
    } catch (error) {
        console.error('Error al leer products.json en adminRouter.get /products:', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener productos para admin.' });
    }
});

// Obtener un producto por ID (admin)
adminRouter.get('/products/:id', (req, res) => {
    try {
        const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8'));
        const product = products.find(p => p.id === parseInt(req.params.id));
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: 'Producto no encontrado.' });
        }
    } catch (error) {
        console.error('Error al leer products.json en adminRouter.get /products/:id:', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener el producto por ID.' });
    }
});

// Añadir un nuevo producto (admin)
adminRouter.post('/products', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Se requiere una imagen para el producto.' });
    }
    if (!req.body.name || !req.body.description || !req.body.price || !req.body.category || !req.body.stock) {
        return res.status(400).json({ message: 'Faltan campos requeridos para el producto.' });
    }

    try {
        const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8'));
        const newProduct = {
            id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
            name: req.body.name,
            description: req.body.description,
            price: parseFloat(req.body.price),
            // La imagen se guarda con la ruta relativa desde 'public'
            image: `productos/${req.file.filename}`, 
            category: req.body.category,
            stock: parseInt(req.body.stock)
        };
        products.push(newProduct);
        fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2));
        res.status(201).json(newProduct);
    } catch (error) {
        console.error('Error al añadir producto:', error);
        res.status(500).json({ message: 'Error interno del servidor al añadir el producto.' });
    }
});

// Actualizar un producto existente (admin)
adminRouter.put('/products/:id', upload.single('image'), (req, res) => {
    try {
        let products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8'));
        const productIndex = products.findIndex(p => p.id === parseInt(req.params.id));

        if (productIndex === -1) {
            return res.status(404).json({ message: 'Producto no encontrado para actualizar.' });
        }

        const oldProduct = products[productIndex];
        const updatedProduct = {
            ...oldProduct,
            name: req.body.name || oldProduct.name,
            description: req.body.description || oldProduct.description,
            price: req.body.price ? parseFloat(req.body.price) : oldProduct.price,
            category: req.body.category || oldProduct.category,
            stock: req.body.stock ? parseInt(req.body.stock) : oldProduct.stock,
        };

        if (req.file) {
            // Si hay una nueva imagen, eliminar la anterior si existe y es diferente
            if (oldProduct.image && oldProduct.image !== `productos/${req.file.filename}`) {
                const oldImagePath = path.join(__dirname, 'public', oldProduct.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlink(oldImagePath, (err) => {
                        if (err) console.error('Error al eliminar la imagen antigua:', oldImagePath, err);
                    });
                }
            }
            updatedProduct.image = `productos/${req.file.filename}`;
        }

        products[productIndex] = updatedProduct;
        fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2));
        res.json(updatedProduct);
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ message: 'Error interno del servidor al actualizar el producto.' });
    }
});

// Eliminar un producto (admin)
adminRouter.delete('/products/:id', (req, res) => {
    try {
        let products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8'));
        const productIdToDelete = parseInt(req.params.id);
        const productToDelete = products.find(p => p.id === productIdToDelete);

        if (!productToDelete) {
            return res.status(404).json({ message: 'Producto no encontrado para eliminar.' });
        }

        // Eliminar la imagen asociada si existe
        if (productToDelete.image) {
            const imagePath = path.join(__dirname, 'public', productToDelete.image);
            if (fs.existsSync(imagePath)) {
                fs.unlink(imagePath, (err) => {
                    if (err) console.error('Error al eliminar la imagen del producto:', imagePath, err);
                });
            }
        }

        products = products.filter(p => p.id !== productIdToDelete);
        fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2));
        res.status(200).json({ message: 'Producto eliminado correctamente.' });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ message: 'Error interno del servidor al eliminar el producto.' });
    }
});

// ==========================================
//      RUTAS PÚBLICAS (sin autenticación)
// ==========================================

// Ruta pública para obtener productos (para shop.html)
// DEBE IR FUERA del adminRouter para que shop.html pueda acceder sin contraseña.
app.get('/products', (req, res) => {
    try {
        const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8'));
        res.json(products);
    } catch (error) {
        console.error('Error al leer products.json para el frontend:', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener productos para el frontend.' });
    }
});

// ==========================================
//      RUTA DE MERCADO PAGO
// ==========================================
const createPreferenceValidationRules = () => []; 

app.post('/create-preference', createPreferenceValidationRules(), async (req, res) => {
    try {
        const serverProducts = JSON.parse(fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8'));
        const clientItems = req.body.items;

        if (!clientItems || clientItems.length === 0) {
            return res.status(400).json({ message: 'El carrito está vacío o los ítems no son válidos.' });
        }

        const finalItems = clientItems.map(clientItem => {
            const productFromServer = serverProducts.find(p => p.id === clientItem.id);
            if (!productFromServer) {
                throw new Error(`Producto con ID ${clientItem.id} no encontrado en el servidor.`);
            }
            
            // Validación de stock
            if (clientItem.quantity > productFromServer.stock) {
                throw new Error(`Cantidad solicitada (${clientItem.quantity}) para "${productFromServer.name}" excede el stock disponible (${productFromServer.stock}).`);
            }

            return {
                id: productFromServer.id.toString(), // MP prefiere ID como string
                title: productFromServer.name,
                quantity: clientItem.quantity,
                unit_price: productFromServer.price,
                currency_id: 'ARS', // Asumiendo pesos argentinos
            };
        });

        // Validación de datos del comprador
        const payer = req.body.payer;
        if (!payer || !payer.name || !payer.email || !payer.phone || !payer.phone.number) {
            return res.status(400).json({ message: 'Faltan datos requeridos del comprador para Mercado Pago.' });
        }

        const bodyRequest = {
            items: finalItems,
            payer: {
                name: payer.name,
                surname: payer.surname || '', // Opcional, pero bueno incluirlo si está disponible
                email: payer.email,
                phone: {
                    area_code: payer.phone.area_code || '', // Opcional
                    number: payer.phone.number,
                },
                address: {
                    zip_code: payer.address && payer.address.zip_code ? payer.address.zip_code : '',
                    street_name: payer.address && payer.address.street_name ? payer.address.street_name : '',
                    street_number: payer.address && payer.address.street_number ? payer.address.street_number : '',
                }
            },
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
        console.error('Error al crear la preferencia de Mercado Pago:', error.message);
        res.status(500).json({ message: error.message || 'Error interno del servidor al procesar el pago.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor de NOVA Panes corriendo en el puerto ${port}`);
    if (!process.env.ADMIN_PASSWORD_HASH) {
        console.warn('ADVERTENCIA: ADMIN_PASSWORD_HASH no está configurado en el archivo .env. El acceso de administrador usará "superadmin" (solo para desarrollo).');
    }
    if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
        console.warn('ADVERTENCIA: MERCADO_PAGO_ACCESS_TOKEN no está configurado en el archivo .env. Mercado Pago usará un token de ejemplo (solo para desarrollo).');
    }
    if (!process.env.SESSION_SECRET) {
        console.warn('ADVERTENCIA: SESSION_SECRET no está configurado en el archivo .env. La sesión usará una clave de ejemplo.');
    }
});