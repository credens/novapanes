// ===================================================
//      ARCHIVO shop-script.js (COMPLETO Y FINAL)
// ===================================================

document.addEventListener('DOMContentLoaded', function() {
    let products = [];
    let allCategories = [];
    let cart = [];
    const MINIMUM_PURCHASE = 15000;

    // Elementos del DOM
    const shopProductsContainer = document.getElementById('shopProducts');
    const filterContainer = document.getElementById('filter-container');
    const searchInput = document.getElementById('searchInput');
    const logoScroller = document.getElementById('logo-scroller');
    const cartModal = document.getElementById('cartModal');
    const checkoutModal = document.getElementById('checkoutModal');
    
    const deliveryAddressContainer = document.getElementById('deliveryAddressContainer');
    const deliveryTimeSelect = document.getElementById('deliveryTimeSelect');
    const deliveryMethodRadios = document.querySelectorAll('input[name="metodoEntrega"]');
    const paymentMethodSelect = document.getElementById('paymentMethodSelect');
    const transferInfo = document.getElementById('transferInfo');
    const headerCartIcon = document.getElementById('headerCartIcon');
    
    // Inputs de dirección para validación dinámica
    const direccionInput = document.querySelector('input[name="direccion"]');
    const ciudadInput = document.querySelector('input[name="ciudad"]');

    // 1. CARGA DE DATOS INICIALES
    Promise.all([
        fetch('/products').then(res => res.json()),
        fetch('/data/categories.json').then(res => res.json()),
        fetch('/data/logos.json').then(res => res.json())
    ]).then(([productsData, categoriesData, logosData]) => {
        products = productsData;
        allCategories = categoriesData;
        renderLogoScroller(logosData);
        renderCategoryFilters();
        renderProducts();
        setupEventListeners();
        updateCartDisplayFromStorage();
    }).catch(error => {
        console.error('Error fatal al cargar los datos:', error);
        if (shopProductsContainer) shopProductsContainer.innerHTML = '<p style="text-align: center; color: red; padding: 40px;">Error al cargar la tienda.</p>';
    });

    // 2. RENDERIZADO DE COMPONENTES
    function renderLogoScroller(logos) {
        if (!logoScroller || !Array.isArray(logos)) return;
        const logosToRender = [...logos, ...logos, ...logos];
        logoScroller.innerHTML = logosToRender.map(l => `<img src="/logos/${l}" alt="Marca">`).join('');
    }

    function renderCategoryFilters() {
        if (!filterContainer) return;
        filterContainer.innerHTML = '<button class="filter-btn active" data-filter="all">Todos</button>';
        allCategories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.dataset.filter = category.id;
            button.textContent = category.name;
            filterContainer.appendChild(button);
        });
    }

    function renderProducts() {
        const categoryFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
        const searchTerm = searchInput.value.toLowerCase().trim();
        const filtered = categoryFilter === 'all' ? products : products.filter(p => p.category === categoryFilter);
        const finalProducts = searchTerm ? filtered.filter(p => p.name.toLowerCase().includes(searchTerm)) : filtered;

        shopProductsContainer.innerHTML = '';
        if (finalProducts.length === 0) {
            shopProductsContainer.innerHTML = '<p style="text-align: center; padding: 40px 0; color: #999;">No se encontraron productos.</p>';
            return;
        }

        const productsByCategory = finalProducts.reduce((acc, product) => {
            (acc[product.category] = acc[product.category] || []).push(product);
            return acc;
        }, {});

        allCategories.forEach(category => {
            if (productsByCategory[category.id]) {
                let productsHTML = productsByCategory[category.id].map(p => generateProductCardHTML(p)).join('');
                shopProductsContainer.innerHTML += `
                    <div class="category-group reveal active">
                        <h2 class="category-group-title">${category.name}</h2>
                        <div class="shop-products">${productsHTML}</div>
                    </div>`;
            }
        });
        initReveal();
    }

    function generateProductCardHTML(p) {
        const currentPrice = (p.promo_price && p.promo_price < p.price) ? p.promo_price : p.price;
        return `
            <div id="product-${p.id}" class="product-item">
                <img src="/${p.image}" alt="${p.name}" class="product-image" onclick="openProductModal('/${p.image}', '${p.name}')">
                <div class="product-info">
                    <h3 class="product-title">${p.name}</h3>
                    <p class="product-description">${p.description}</p>
                    <div class="product-price">$${currentPrice.toLocaleString()}</div>
                    
                    <div class="product-controls">
                        <div class="quantity-selector">
                            <button class="qty-btn" onclick="changeQty(${p.id}, -1)">-</button>
                            <input type="number" id="qty-input-${p.id}" class="qty-input" value="1" min="1" readonly>
                            <button class="qty-btn" onclick="changeQty(${p.id}, 1)">+</button>
                        </div>
                        <button class="add-to-cart-btn" onclick="addToCart(event, ${p.id})">AGREGAR</button>
                    </div>
                </div>
            </div>`;
    }

    // FUNCIÓN PARA CAMBIAR CANTIDAD EN LA TARJETA
    window.changeQty = (id, delta) => {
        const input = document.getElementById(`qty-input-${id}`);
        let newVal = parseInt(input.value) + delta;
        if (newVal < 1) newVal = 1;
        input.value = newVal;
    };

    // 3. LOGICA DE ANIMACIONES (REVEAL)
    function initReveal() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('active');
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }

    // 4. LOGICA DEL CARRITO
    window.addToCart = (event, id) => {
        const p = products.find(prod => prod.id === id);
        const qtyInput = document.getElementById(`qty-input-${id}`);
        const quantityToAdd = parseInt(qtyInput.value);
        const price = (p.promo_price && p.promo_price < p.price) ? p.promo_price : p.price;
        
        const item = cart.find(i => i.id === id);
        if (item) {
            item.quantity += quantityToAdd;
        } else {
            cart.push({...p, price, quantity: quantityToAdd});
        }
        
        updateCartDisplay();
        qtyInput.value = 1; // Resetear selector

        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '¡LISTO!'; btn.style.background = '#4CAF50';
        setTimeout(() => { btn.textContent = originalText; btn.style.background = ''; }, 1000);
    };

    window.removeFromCart = (id) => {
        cart = cart.filter(i => i.id !== id);
        updateCartDisplay();
    };

    function renderCartItems() {
        const cItemsEl = document.getElementById('cartItems');
        if (!cItemsEl) return;
        if (cart.length === 0) {
            cItemsEl.innerHTML = '<p style="text-align:center; padding:30px; color:#999;">Tu carrito está vacío</p>';
            return;
        }
        cItemsEl.innerHTML = cart.map(item => `
            <div class="cart-item-row">
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-info">
                    <b>${item.name}</b>
                    <span>$${item.price.toLocaleString()} x ${item.quantity}</span>
                </div>
                <button onclick="removeFromCart(${item.id})" style="background:none; border:none; color:#DDD; cursor:pointer; font-size: 1.5rem;">&times;</button>
            </div>`).join('');
    }

    function updateCartDisplay() {
        const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
        const totalPrice = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        
        const countEl = document.getElementById('cartCount');
        const totalEl = document.getElementById('cartTotal');
        const orderTotalEl = document.getElementById('orderTotal');
        
        if (countEl) countEl.textContent = totalItems;
        if (totalEl) totalEl.textContent = totalPrice.toLocaleString();
        if (orderTotalEl) orderTotalEl.textContent = totalPrice.toLocaleString();
        
        const checkoutBtn = document.getElementById('checkout');
        const minMsg = document.getElementById('minPurchaseMessage');
        
        if (totalPrice < MINIMUM_PURCHASE && cart.length > 0) {
            if (minMsg) minMsg.textContent = `Monto mínimo: $${MINIMUM_PURCHASE.toLocaleString()}. Faltan $${(MINIMUM_PURCHASE - totalPrice).toLocaleString()}.`;
            if (checkoutBtn) {
                checkoutBtn.disabled = true;
                checkoutBtn.style.opacity = '0.5';
            }
        } else {
            if (minMsg) minMsg.textContent = '';
            if (checkoutBtn) {
                checkoutBtn.disabled = false;
                checkoutBtn.style.opacity = '1';
            }
        }
        
        localStorage.setItem('novaPanesCart', JSON.stringify(cart));
        renderCartItems();
    }

    // 5. EVENT LISTENERS
    function setupEventListeners() {
        filterContainer?.addEventListener('click', e => {
            if (e.target.classList.contains('filter-btn')) {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                renderProducts();
            }
        });

        searchInput?.addEventListener('input', renderProducts);

        headerCartIcon?.addEventListener('click', (e) => {
            e.preventDefault();
            cartModal.style.display = 'flex';
        });

        document.querySelector('.close-cart')?.addEventListener('click', () => cartModal.style.display = 'none');
        
        document.getElementById('checkout')?.addEventListener('click', () => {
            cartModal.style.display = 'none';
            checkoutModal.style.display = 'flex';
            renderOrderSummary();
        });

        document.querySelector('.close-checkout')?.addEventListener('click', () => checkoutModal.style.display = 'none');
        document.querySelector('.close-checkout-btn')?.addEventListener('click', () => checkoutModal.style.display = 'none');
        document.getElementById('clearCart')?.addEventListener('click', () => {
            if(confirm('¿Vaciar el carrito?')) { cart = []; updateCartDisplay(); }
        });

        deliveryMethodRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isDelivery = e.target.value === 'Envío a Domicilio';
                deliveryAddressContainer.style.display = isDelivery ? 'block' : 'none';
                
                deliveryTimeSelect.required = isDelivery;
                if (direccionInput) direccionInput.required = isDelivery;
                if (ciudadInput) ciudadInput.required = isDelivery;
            });
        });

        paymentMethodSelect?.addEventListener('change', e => {
            transferInfo.style.display = e.target.value === 'transferencia' ? 'block' : 'none';
        });

        document.getElementById('checkoutForm')?.addEventListener('submit', handleCheckout);

        window.onclick = (event) => {
            if (event.target == cartModal) cartModal.style.display = 'none';
            if (event.target == checkoutModal) checkoutModal.style.display = 'none';
        };
    }

    // 6. FINALIZAR COMPRA
    function renderOrderSummary() {
        const orderItemsEl = document.getElementById('orderItems');
        if (orderItemsEl) {
            orderItemsEl.innerHTML = cart.map(i => `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span>${i.name} x ${i.quantity}</span>
                    <span>$${(i.price * i.quantity).toLocaleString()}</span>
                </div>
            `).join('');
        }
    }

    async function handleCheckout(e) {
        e.preventDefault();
        const fData = new FormData(e.target);
        const pMethod = fData.get('metodoPago');
        const btn = e.target.querySelector('button[type="submit"]');
        
        btn.textContent = 'Procesando...'; btn.disabled = true;

        const customerData = {
            nombre: fData.get('nombre'),
            email: fData.get('email'),
            telefono: fData.get('telefono'),
            metodoEntrega: fData.get('metodoEntrega'),
            direccion: fData.get('direccion') || 'Retiro en fábrica',
            ciudad: fData.get('ciudad') || '-',
            horarioEntrega: fData.get('horarioEntrega') || 'N/A'
        };

        const orderData = { 
            customer: customerData, 
            metodoPago: pMethod, 
            items: cart, 
            total: cart.reduce((s, i) => s + (i.price * i.quantity), 0) 
        };

        if (pMethod === 'mercadopago') {
            try {
                const res = await fetch('/create-preference', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ 
                        items: cart.map(i => ({ id: i.id, title: i.name, quantity: i.quantity, unit_price: i.price })), 
                        payer: { name: customerData.nombre, email: customerData.email } 
                    }) 
                });
                const pref = await res.json();
                cart = []; updateCartDisplay();
                window.location.href = pref.init_point;
            } catch (err) { 
                alert('Error con Mercado Pago'); 
                btn.textContent = 'Confirmar Pedido'; btn.disabled = false;
            }
        } else {
            try {
                await fetch('/api/submit-order', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(orderData) 
                });

                let deliveryText = `🚚 *Método:* ${customerData.metodoEntrega}`;
                if (customerData.metodoEntrega === 'Envío a Domicilio') {
                    deliveryText += `\n📍 *Dirección:* ${customerData.direccion}, ${customerData.ciudad}\n⏰ *Horario:* ${customerData.horarioEntrega}`;
                }

                const wMsg = `🍞 *NUEVO PEDIDO - NOVA PANES* 🍞\n\n👤 *Cliente:* ${customerData.nombre}\n📱 *WhatsApp:* ${customerData.telefono}\n\n${deliveryText}\n\n💳 *Pago:* ${pMethod}\n\n💰 *TOTAL: $${orderData.total.toLocaleString()}*`;
                
                window.open(`https://wa.me/5491140882236?text=${encodeURIComponent(wMsg)}`, '_blank');
                
                cart = []; updateCartDisplay();
                checkoutModal.style.display = 'none';
                alert('¡Pedido enviado! Te redirigimos a WhatsApp para confirmar.');
            } catch (err) {
                alert('Error al enviar el pedido');
                btn.textContent = 'Confirmar Pedido'; btn.disabled = false;
            }
        }
    }

    // 7. UTILIDADES
    function updateCartDisplayFromStorage() {
        const saved = localStorage.getItem('novaPanesCart');
        if (saved) {
            cart = JSON.parse(saved);
            updateCartDisplay();
        }
    }

    window.openProductModal = (src, title) => {
        const m = document.createElement('div');
        m.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter: blur(5px); cursor: pointer;";
        m.onclick = () => m.remove();
        m.innerHTML = `
            <div style="background:white; padding:30px; border-radius:35px; max-width:500px; width:100%; text-align:center; animation: modalSlideUp 0.3s ease;">
                <img src="${src}" style="width:100%; border-radius:20px; margin-bottom:20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                <h3 style="font-family:Lora; font-size:1.8rem; color:var(--primary-red);">${title}</h3>
                <p style="color: #666; margin-top: 10px; font-size: 0.9rem;">Presiona en cualquier lugar para cerrar</p>
            </div>`;
        document.body.appendChild(m);
    };
});