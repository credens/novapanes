// ===================================================
//      ARCHIVO server.js (VERSIÓN LIMPIA Y FINAL)
// ===================================================

const express = require('express');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const cors = require('cors');

const app = express();
const port = 3000;

// --- MIDDLEWARE ---
app.use(express.json());
app.use(cors());

// --- CONFIGURACIÓN DE MERCADO PAGO ---
// Pega tu Access Token de prueba DENTRO de las comillas simples
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-2704302134467517-090918-811730b9fe1b3c013dfe9480874e87d9-2683089128' });

// --- RUTA PARA CREAR LA PREFERENCIA DE PAGO ---
app.post('/create-preference', async (req, res) => {
    try {
        console.log("Recibiendo pedido:", req.body);

        const body = {
            items: req.body.items,
            payer: req.body.payer,
            back_urls: {
                success: "https://tupagina.github.io/shop.html", // Reemplaza con la URL real de tu tienda
                failure: "https://tupagina.github.io/shop.html",
                pending: "https://tupagina.github.io/shop.html",
            },
            auto_return: "approved",
            statement_descriptor: "NOVAPANES",
        };

        const preference = new Preference(client);
        const result = await preference.create({ body });

        console.log("Preferencia creada. Link de pago:", result.init_point);
        
        res.status(201).json({
            id: result.id,
            init_point: result.init_point,
        });

    } catch (error) {
        console.error('Error al crear la preferencia:', error);
        res.status(500).json({ message: 'Error en el servidor al crear preferencia.' });
    }
});

// --- Iniciar el servidor ---
app.listen(port, () => {
    console.log(`¡Servidor de NOVA Panes corriendo en http://localhost:${port}`);
});