// ===================================================
//      ARCHIVO server.js (CON LÓGICA DE OFERTAS)
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

process.on('uncaughtException', (err) => {
    console.error('ERROR INESPERADO (UNCAUGHT EXCEPTION):', err);
    process.exit(1);
});

const port = process.env.PORT || 3000;
const app = express();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'productos')),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({
    storage: storage
});

const {
    MercadoPagoConfig,
    Preference
} = require('mercadopago');
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({
    extended: true
}));
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

const PRODUCTS_FILE_PATH = path.join(__dirname, 'public', 'products.json');
const CATEGORIES_FILE_PATH = path.join(__dirname, 'public', 'data', 'categories.json');
const ORDERS_FILE_PATH = path.join(__dirname, 'public', 'data', 'orders.json');

function readJsonFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '[]');
            return [];
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        throw new Error(`Error al leer archivo: ${path.basename(filePath)}`);
    }
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        throw new Error(`Error al escribir archivo: ${path.basename(filePath)}`);
    }
}

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.post('/api/admin/verify', express.json(), async (req, res) => {
    const {
        password
    } = req.body;
    const hashFromEnv = process.env.ADMIN_PASSWORD_HASH;
    if (!password) return res.status(400).json({
        success: false,
        message: 'No se proporcionó contraseña.'
    });
    try {
        const match = await bcrypt.compare(password, hashFromEnv || "");
        res.json({
            success: match
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error del servidor.'
        });
    }
});

const adminRouter = express.Router();
adminRouter.use(async (req, res, next) => {
    const plainTextPassword = req.headers['authorization'];
    if (!plainTextPassword) return res.status(401).json({
        message: 'Contraseña de API no proporcionada.'
    });
    try {
        const match = await bcrypt.compare(plainTextPassword, process.env.ADMIN_PASSWORD_HASH || "");
        if (match) next();
        else res.status(403).json({
            message: 'Acceso denegado.'
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error de servidor en autenticación.'
        });
    }
});
app.use('/api/admin', adminRouter);

adminRouter.get('/products', (req, res) => {
    try {
        res.json(readJsonFile(PRODUCTS_FILE_PATH));
    } catch (e) {
        res.status(500).json({
            message: e.message
        });
    }
});

// --- MODIFICADO para incluir promo_price ---
adminRouter.post('/products', upload.single('image'), (req, res) => {
    try {
        if (!req.file || !req.body.name) return res.status(400).json({
            message: 'Faltan campos o imagen.'
        });
        const products = readJsonFile(PRODUCTS_FILE_PATH);
        const newProduct = {
            id: products.length > 0 ? Math.max(0, ...products.map(p => p.id)) + 1 : 1,
            name: req.body.name,
            description: req.body.description,
            price: parseFloat(req.body.price),
            promo_price: req.body.promo_price ? parseFloat(req.body.promo_price) : null, // <-- AÑADIDO
            stock: parseInt(req.body.stock),
            category: req.body.category,
            image: `productos/${req.file.filename}`
        };
        products.push(newProduct);
        writeJsonFile(PRODUCTS_FILE_PATH, products);
        res.status(201).json(newProduct);
    } catch (e) {
        res.status(500).json({
            message: e.message
        });
    }
});

// --- MODIFICADO para incluir promo_price ---
adminRouter.put('/products/:id', upload.single('image'), (req, res) => {
    try {
        let products = readJsonFile(PRODUCTS_FILE_PATH);
        const index = products.findIndex(p => p.id === parseInt(req.params.id));
        if (index === -1) return res.status(404).json({
            message: 'Producto no encontrado.'
        });
        const oldProduct = products[index];
        const updatedProduct = {
            ...oldProduct,
            name: req.body.name,
            description: req.body.description,
            price: parseFloat(req.body.price),
            promo_price: req.body.promo_price ? parseFloat(req.body.promo_price) : null, // <-- AÑADIDO
            stock: parseInt(req.body.stock),
            category: req.body.category
        };
        if (req.file) {
            if (oldProduct.image) {
                const oldPath = path.join(__dirname, 'public', oldProduct.image);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            updatedProduct.image = `productos/${req.file.filename}`;
        }
        products[index] = updatedProduct;
        writeJsonFile(PRODUCTS_FILE_PATH, products);
        res.json(updatedProduct);
    } catch (e) {
        res.status(500).json({
            message: e.message
        });
    }
});

adminRouter.delete('/products/:id', (req, res) => {
    try {
        let products = readJsonFile(PRODUCTS_FILE_PATH);
        const product = products.find(p => p.id === parseInt(req.params.id));
        if (!product) return res.status(404).json({
            message: 'Producto no encontrado.'
        });
        if (product.image) {
            const imgPath = path.join(__dirname, 'public', product.image);
            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        }
        products = products.filter(p => p.id !== parseInt(req.params.id));
        writeJsonFile(PRODUCTS_FILE_PATH, products);
        res.status(200).json({
            message: 'Producto eliminado.'
        });
    } catch (e) {
        res.status(500).json({
            message: e.message
        });
    }
});
adminRouter.get('/categories', (req, res) => {
    try {
        res.json(readJsonFile(CATEGORIES_FILE_PATH));
    } catch (e) {
        res.status(500).json({
            message: e.message
        });
    }
});
adminRouter.post('/categories', (req, res) => {
    try {
        const categories = readJsonFile(CATEGORIES_FILE_PATH);
        const newCategory = {
            id: req.body.name.toLowerCase().replace(/\s+/g, '-').normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
            name: req.body.name
        };
        if (categories.some(c => c.id === newCategory.id)) return res.status(400).json({
            message: 'La categoría ya existe.'
        });
        categories.push(newCategory);
        writeJsonFile(CATEGORIES_FILE_PATH, categories);
        res.status(201).json(newCategory);
    } catch (e) {
        res.status(500).json({
            message: e.message
        });
    }
});
adminRouter.delete('/categories/:id', (req, res) => {
    try {
        const products = readJsonFile(PRODUCTS_FILE_PATH);
        if (products.some(p => p.category === req.params.id)) return res.status(400).json({
            message: 'Categoría en uso por productos.'
        });
        let categories = readJsonFile(CATEGORIES_FILE_PATH);
        categories = categories.filter(c => c.id !== req.params.id);
        writeJsonFile(CATEGORIES_FILE_PATH, categories);
        res.status(200).json({
            message: 'Categoría eliminada.'
        });
    } catch (e) {
        res.status(500).json({
            message: e.message
        });
    }
});
adminRouter.get('/orders', (req, res) => {
    try {
        res.json(readJsonFile(ORDERS_FILE_PATH));
    } catch (e) {
        res.status(500).json({
            message: e.message
        });
    }
});
adminRouter.put('/orders/:id', (req, res) => {
    try {
        let orders = readJsonFile(ORDERS_FILE_PATH);
        const orderIndex = orders.findIndex(o => o.id === req.params.id);
        if (orderIndex === -1) return res.status(404).json({
            message: 'Pedido no encontrado.'
        });
        orders[orderIndex].status = req.body.status;
        writeJsonFile(ORDERS_FILE_PATH, orders);
        res.json(orders[orderIndex]);
    } catch (e) {
        res.status(500).json({
            message: e.message
        });
    }
});

app.get('/products', (req, res) => {
    try {
        res.json(readJsonFile(PRODUCTS_FILE_PATH));
    } catch (e) {
        res.status(500).json({
            message: e.message
        });
    }
});
app.post('/api/contact', async (req, res) => {
    const {
        nombre,
        email,
        telefono,
        mensaje
    } = req.body;
    if (!nombre || !telefono) {
        return res.status(400).json({
            success: false,
            message: 'El nombre y el teléfono son obligatorios.'
        });
    }
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD,
        },
    });
    const emailBody = `<h1>📬 Nueva Consulta desde el Sitio Web 📬</h1><h2>Detalles del Contacto:</h2><ul><li><strong>Nombre:</strong> ${nombre}</li><li><strong>Teléfono:</strong> ${telefono}</li>${email ? `<li><strong>Email:</strong> ${email}</li>` : ''}</ul><h3>Mensaje:</h3><p style="background-color:#f4f4f4; padding: 15px; border-radius: 5px;">${mensaje || 'No se ha escrito ningún mensaje.'}</p>`;
    const mailOptions = {
        from: `"NOVA Panes Web" <${process.env.EMAIL_USER}>`,
        to: 'panes.nova@gmail.com',
        subject: `Nueva consulta de: ${nombre}`,
        html: emailBody,
    };
    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({
            success: true,
            message: '¡Gracias! Nos pondremos en contacto contigo pronto.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Hubo un error al enviar el mensaje.'
        });
    }
});
app.post('/api/submit-order', async (req, res) => {
    const orderData = req.body;
    try {
        const orders = readJsonFile(ORDERS_FILE_PATH);
        const newOrder = {
            id: `order_${Date.now()}`,
            customer: orderData.customer,
            items: orderData.items,
            total: orderData.total,
            paymentMethod: orderData.metodoPago,
            date: new Date().toISOString(),
            status: 'pending'
        };
        orders.unshift(newOrder);
        writeJsonFile(ORDERS_FILE_PATH, orders);
    } catch (error) {
        console.error("Error al guardar el pedido:", error);
    }
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD
        }
    });
    const emailBody = `<h1>🍞 Pedido Recibido</h1><h2>Cliente: ${orderData.customer.nombre}</h2><ul><li>Email: ${orderData.customer.email}</li><li>Teléfono: ${orderData.customer.telefono}</li><li>Dirección: ${orderData.customer.direccion}, ${orderData.customer.ciudad}</li></ul><h2>Pedido:</h2><table border="1" cellpadding="5" cellspacing="0" style="width:100%; border-collapse:collapse;"><thead><tr style="background-color:#f2f2f2;"><th>Producto</th><th>Cant.</th><th>Subtotal</th></tr></thead><tbody>${orderData.items.map(i => `<tr><td>${i.name}</td><td style="text-align:center;">${i.quantity}</td><td style="text-align:right;">$${(i.price * i.quantity).toLocaleString('es-AR')}</td></tr>`).join('')}</tbody></table><h3 style="text-align:right;">Total: $${orderData.total.toLocaleString('es-AR')}</h3><p><strong>Pago:</strong> ${orderData.metodoPago}</p>`;
    const mailOptions = {
        from: `"NOVA Panes Web" <${process.env.EMAIL_USER}>`,
        to: 'panes.nova@gmail.com',
        subject: `Pedido de ${orderData.customer.nombre}`,
        html: emailBody
    };
    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({
            message: 'OK'
        });
    } catch (e) {
        console.error("Error al enviar email:", e);
        res.status(500).json({
            message: 'Error en email.'
        });
    }
});
app.post('/create-preference', async (req, res) => {
    try {
        const {
            items,
            payer
        } = req.body;
        const serverProducts = readJsonFile(PRODUCTS_FILE_PATH);
        const finalItems = items.map(i => {
            const p = serverProducts.find(sp => sp.id === i.id);
            if (!p || i.quantity > p.stock) throw new Error('Producto o stock no válido');
            return {
                id: p.id.toString(),
                title: p.name,
                quantity: i.quantity,
                unit_price: p.price,
                currency_id: 'ARS'
            };
        });
        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: finalItems,
                payer,
                back_urls: {
                    success: "https://novapanes.com.ar/shop.html?payment=success",
                    failure: "https://novapanes.com.ar/shop.html?payment=failure"
                },
                auto_return: "approved"
            }
        });
        res.status(201).json({
            id: result.id,
            init_point: result.init_point
        });
    } catch (e) {
        res.status(500).json({
            message: e.message
        });
    }
});

try {
    app.listen(port, () => {
        console.log(`Servidor de NOVA Panes corriendo en http://localhost:${port}`);
        if (!process.env.ADMIN_PASSWORD_HASH) console.warn('ADVERTENCIA: ADMIN_PASSWORD_HASH no está configurado en .env.');
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`\n🚨 Error: El puerto ${port} ya está en uso. 🚨`);
        } else {
            console.error('Error al iniciar el servidor:', err);
        }
        process.exit(1);
    });
} catch (error) {
    console.error('Error fatal al configurar el servidor:', error);
    process.exit(1);
}