// ===================================================
//      ARCHIVO server.js (COMPLETO Y CORREGIDO)
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
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    } // 10 MB
});

const {
    MercadoPagoConfig,
    Preference
} = require('mercadopago');
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

const limitSize = '10mb';
app.use(express.json({
    limit: limitSize
}));
app.use(cors());
app.use(express.urlencoded({
    extended: true,
    limit: limitSize
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

const DATA_DIR = path.join(__dirname, 'public', 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
    console.log(`Directorio de datos creado en: ${DATA_DIR}`);
}

const PRODUCTS_FILE_PATH = path.join(__dirname, 'public', 'products.json');
const CATEGORIES_FILE_PATH = path.join(DATA_DIR, 'categories.json');
const ORDERS_FILE_PATH = path.join(DATA_DIR, 'orders.json');
const VISITS_FILE_PATH = path.join(DATA_DIR, 'visits.json');

function readJsonFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '[]');
            return [];
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        console.error(`Error al leer el archivo ${filePath}:`, error);
        throw new Error(`Error al leer archivo: ${path.basename(filePath)}`);
    }
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error al escribir el archivo ${filePath}:`, error);
        throw new Error(`Error al escribir archivo: ${path.basename(filePath)}`);
    }
}

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.post('/api/track-visit', (req, res) => {
    try {
        const visits = readJsonFile(VISITS_FILE_PATH);
        visits.push({
            date: new Date().toISOString()
        });
        writeJsonFile(VISITS_FILE_PATH, visits);
        res.status(200).json({
            success: true
        });
    } catch (error) {
        console.error('Error al registrar visita:', error);
        res.status(500).json({
            success: false
        });
    }
});

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

adminRouter.get('/visits', (req, res) => {
    try {
        res.json(readJsonFile(VISITS_FILE_PATH));
    } catch (e) {
        res.status(500).json({
            message: e.message
        });
    }
});

adminRouter.get('/products', (req, res) => {
    try {
        res.json(readJsonFile(PRODUCTS_FILE_PATH));
    } catch (e) {
        res.status(500).json({
            message: e.message
        });
    }
});
adminRouter.post('/products', upload.single('image'), (req, res) => {
    try {
        if (!req.file || !req.body.name) return res.status(400).json({
            message: 'Faltan campos o imagen.'
        });
        const products = readJsonFile(PRODUCTS_FILE_PATH);
        const newProduct = {
            id: products.length > 0 ? Math.max(0, ...products.map(p => p.id || 0)) + 1 : 1,
            name: req.body.name,
            description: req.body.description,
            price: parseFloat(req.body.price),
            promo_price: req.body.promo_price ? parseFloat(req.body.promo_price) : null,
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
            promo_price: (req.body.promo_price && req.body.promo_price !== 'null') ? parseFloat(req.body.promo_price) : null,
            stock: parseInt(req.body.stock),
            category: req.body.category
        };
        if (req.file) {
            if (oldProduct.image && typeof oldProduct.image === 'string') {
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
        if (product.image && typeof product.image === 'string') {
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
    if (email) {
        mailOptions.replyTo = email;
    }
    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({
            success: true,
            message: '¡Gracias! Nos pondremos en contacto contigo pronto.'
        });
    } catch (error) {
        console.error("Error al enviar email de contacto:", error);
        res.status(500).json({
            success: false,
            message: 'Hubo un error al enviar el mensaje.'
        });
    }
});

// ===================================================
// ENDPOINT CORREGIDO: /api/submit-order
// ===================================================
app.post('/api/submit-order', async (req, res) => {
    console.log('📦 Pedido recibido:', req.body);
    
    const orderData = req.body;
    
    if (!orderData || !orderData.customer || !orderData.items) {
        return res.status(400).json({
            success: false,
            message: 'Datos de pedido incompletos'
        });
    }

    try {
        // 1. GUARDAR EL PEDIDO EN EL ARCHIVO orders.json
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
        console.log('✅ Pedido guardado con ID:', newOrder.id);

        // 2. ENVIAR EMAIL DE NOTIFICACIÓN
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_APP_PASSWORD
            }
        });

        let deliveryDetails = `<li><strong>Método de Entrega:</strong> ${orderData.customer.metodoEntrega}</li>`;
        if (orderData.customer.metodoEntrega === 'Envío a Domicilio') {
            deliveryDetails += `
                <li><strong>Dirección:</strong> ${orderData.customer.direccion}, ${orderData.customer.ciudad}</li>
                ${orderData.customer.codigoPostal ? `<li><strong>Código Postal:</strong> ${orderData.customer.codigoPostal}</li>` : ''}
                ${orderData.customer.referencias ? `<li><strong>Referencias:</strong> ${orderData.customer.referencias}</li>` : ''}
                <li><strong>Horario Preferido:</strong> ${orderData.customer.horarioEntrega}</li>
            `;
        }

        const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="background-color: #B5651D; color: white; padding: 20px; text-align: center;">
                    🍞 Nuevo Pedido - NOVA Panes
                </h1>
                <div style="padding: 20px; background-color: #f9f9f9;">
                    <h2 style="color: #B5651D;">Información del Cliente</h2>
                    <ul style="list-style: none; padding: 0;">
                        <li><strong>Nombre:</strong> ${orderData.customer.nombre}</li>
                        <li><strong>Email:</strong> ${orderData.customer.email}</li>
                        <li><strong>Teléfono:</strong> ${orderData.customer.telefono}</li>
                        ${deliveryDetails}
                    </ul>
                    
                    <h2 style="color: #B5651D; margin-top: 30px;">Detalle del Pedido</h2>
                    <table border="1" cellpadding="10" cellspacing="0" style="width:100%; border-collapse:collapse; background-color: white;">
                        <thead>
                            <tr style="background-color:#B5651D; color: white;">
                                <th>Producto</th>
                                <th>Cantidad</th>
                                <th>Precio Unit.</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orderData.items.map(i => `
                                <tr>
                                    <td>${i.name}</td>
                                    <td style="text-align:center;">${i.quantity}</td>
                                    <td style="text-align:right;">$${i.price.toLocaleString('es-AR')}</td>
                                    <td style="text-align:right;">$${(i.price * i.quantity).toLocaleString('es-AR')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div style="text-align: right; margin-top: 20px; font-size: 1.2em;">
                        <strong>TOTAL: $${orderData.total.toLocaleString('es-AR')}</strong>
                    </div>
                    
                    <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107;">
                        <strong>Método de Pago:</strong> ${orderData.metodoPago}
                    </div>
                    
                    <div style="margin-top: 20px; padding: 15px; background-color: #d1ecf1; border-left: 4px solid #0c5460;">
                        <strong>ID del Pedido:</strong> ${newOrder.id}
                    </div>
                </div>
            </div>
        `;

        const mailOptions = {
            from: `"NOVA Panes Web" <${process.env.EMAIL_USER}>`,
            to: 'panes.nova@gmail.com',
            subject: `🍞 Nuevo Pedido de ${orderData.customer.nombre} - ${orderData.metodoPago}`,
            html: emailBody
        };

        await transporter.sendMail(mailOptions);
        console.log('✅ Email enviado correctamente');

        res.status(200).json({
            success: true,
            message: 'Pedido registrado correctamente',
            orderId: newOrder.id
        });

    } catch (error) {
        console.error('❌ Error al procesar el pedido:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar el pedido'
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
                unit_price: p.promo_price || p.price,
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