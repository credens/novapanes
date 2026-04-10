document.addEventListener('DOMContentLoaded', function() {
    fetch('/api/track-visit', { method: 'POST' }).catch(() => {});
    // ===================================================
    //      ESTADO GLOBAL Y CONFIGURACIÓN
    // ===================================================
    let products = []; let allCategories = []; let cart = [];
    const FREE_SHIPPING_MIN = 75000;
    const MINIMUM_PURCHASE = 15000;

    const filterContainer = document.getElementById('filter-container');
    const shopProductsContainer = document.getElementById('shopProducts');
    const searchInput = document.getElementById('searchInput');
    const cartModal = document.getElementById('cartModal');
    const checkoutModal = document.getElementById('checkoutModal');
    const paymentMethodSelect = document.getElementById('paymentMethodSelect');
    const deliveryMethodRadios = document.querySelectorAll('input[name="metodoEntrega"]');
    const deliveryAddressContainer = document.getElementById('deliveryAddressContainer');

    const categoryIcons = { 'panificados': '🍞', 'hamburguesas': '🍔', 'salchichas': '🌭', 'quesos': '🧀', 'combos': '🎁', 'salsas': '🥫', 'papas': '🍟' };

    // ===================================================
    //      CARGA DE DATOS
    // ===================================================
    // Verificar retorno de MercadoPago
    checkMercadoPagoReturn();

    Promise.all([
        fetch('/products').then(res => res.json()),
        fetch('/data/categories.json').then(res => res.json()),
        fetch('/data/logos.json').then(res => res.json())
    ]).then(([pData, cData, lData]) => {
        products = pData; allCategories = cData;
        renderLogoScroller(lData); renderCategoryFilters(); renderProducts(); setupEventListeners(); updateCartDisplayFromStorage(); initInfiniteScrollFilters();
    }).catch(err => console.error("Error cargando:", err));

    function renderLogoScroller(logos) {
        const s = document.getElementById('shopLogoScroller');
        if(s && logos) s.innerHTML = [...logos, ...logos, ...logos].map(l => `<img src="/logos/${l}" alt="Marca">`).join('');
    }

    function renderCategoryFilters() {
        if (!filterContainer) return;
        const urlCat = new URLSearchParams(window.location.search).get('category');
        const initial = allCategories.some(c => c.id === urlCat) ? urlCat : 'all';
        let html = `<button class="filter-btn ${initial==='all'?'active':''}" data-filter="all"><span>✨</span> Todos</button>`;
        allCategories.forEach(c => { html += `<button class="filter-btn ${initial===c.id?'active':''}" data-filter="${c.id}"><span>${categoryIcons[c.id]||'🥖'}</span> ${c.name}</button>`; });
        filterContainer.innerHTML = html;
    }

    function initInfiniteScrollFilters() {
        if (!filterContainer) return;
        [...filterContainer.children].forEach(item => filterContainer.appendChild(item.cloneNode(true)));
        filterContainer.addEventListener('scroll', () => {
            const maxScroll = filterContainer.scrollWidth / 2;
            if (filterContainer.scrollLeft >= maxScroll) filterContainer.scrollLeft = 1;
            else if (filterContainer.scrollLeft <= 0) filterContainer.scrollLeft = maxScroll - 1;
        });
    }

    function renderProducts() {
        const f = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
        const s = searchInput.value.toLowerCase().trim();
        const filtered = f === 'all' ? products : products.filter(p => p.category === f);
        const final = s ? filtered.filter(p => p.name.toLowerCase().includes(s)) : filtered;
        shopProductsContainer.innerHTML = '';
        const grouped = final.reduce((acc, p) => { (acc[p.category] = acc[p.category] || []).push(p); return acc; }, {});
        allCategories.forEach(cat => {
            if (grouped[cat.id]) {
                let html = `<section class="category-group reveal active"><h2 class="category-group-title">${cat.name}</h2><div class="shop-products">`;
                html += grouped[cat.id].map(p => {
                    const out = p.stock <= 0;
                    // Lógica Opción 1: Detección de combos para clase CSS especial
                    const comboClass = p.category === 'combos' ? 'is-combo' : '';
                    
                    return `<article class="product-item ${comboClass}" style="${out?'opacity: 0.8;':''}">
                        ${p.badge?`<div class="product-badge">${p.badge}</div>`:''}
                        <img src="/${p.image}" class="product-image" onclick="${out?'':`openQuickView(${p.id})`}" alt="${p.name} artesanal" style="${out?'filter: grayscale(1);':''}">
                        <div class="product-info">
                            <h3 class="product-title">${p.name}</h3>
                            <p class="product-description">${p.description}</p>
                            <div class="premium-price"><small>$</small>${p.price.toLocaleString()}</div>
                            <div class="product-controls">
                                <div class="quantity-selector" style="${out?'opacity: 0.5;pointer-events: none;':''}">
                                    <button class="qty-btn" onclick="changeQty(${p.id},-1)">-</button>
                                    <input type="number" id="qty-input-${p.id}" class="qty-input" value="1" readonly>
                                    <button class="qty-btn" onclick="changeQty(${p.id},1)">+</button>
                                </div>
                                <button onclick="${out?'':`addToCart(event,${p.id})`}" class="add-to-cart-btn ${out?'btn-disabled':''}" ${out?'disabled' : ''}>${out?'SIN STOCK':'AGREGAR'}</button>
                            </div>
                        </div>
                    </article>`;
                }).join('');
                shopProductsContainer.innerHTML += html + `</div></section>`;
            }
        });
    }

    window.changeQty = (id, delta) => {
        const input = document.getElementById(`qty-input-${id}`);
        if(input) { let v = parseInt(input.value) + delta; if (v < 1) v = 1; input.value = v; }
    };

    window.addToCart = (e, id) => {
        const p = products.find(prod => prod.id === id);
        if (p.stock <= 0) return;
        const input = document.getElementById(`qty-input-${id}`);
        const qty = input ? parseInt(input.value) : 1;
        const item = cart.find(i => i.id === id);
        if (item) item.quantity += qty; else cart.push({...p, quantity: qty});
        updateCartDisplay();
        const icon = document.getElementById('headerCartIcon');
        if(icon) { icon.classList.remove('cart-pop-active'); void icon.offsetWidth; icon.classList.add('cart-pop-active'); }
        if(e) { e.target.textContent = '¡LISTO!'; setTimeout(() => { e.target.textContent = 'AGREGAR'; if(input) input.value = 1; }, 1000); }
    };

    function updateCartDisplay() {
        const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        const count = cart.reduce((s, i) => s + i.quantity, 0);
        document.getElementById('cartCount').textContent = count;
        document.getElementById('cartTotal').textContent = total.toLocaleString();
        if(document.getElementById('checkoutTotal')) document.getElementById('checkoutTotal').textContent = total.toLocaleString();
        const fill = document.getElementById('shippingFill');
        const msg = document.getElementById('shippingMsg');
        if(fill && msg) {
            if(total >= FREE_SHIPPING_MIN) { msg.innerHTML = "¡Tenés ENVÍO GRATIS! 🚚"; fill.style.width = "100%"; fill.style.background = "#4CAF50"; }
            else { const perc = (total / FREE_SHIPPING_MIN) * 100; msg.innerHTML = `Te faltan $${(FREE_SHIPPING_MIN - total).toLocaleString()} para envío gratis`; fill.style.width = perc + "%"; fill.style.background = "var(--accent-yellow)"; }
        }
        localStorage.setItem('novaPanesCart', JSON.stringify(cart));
        renderCartItems();
        updateMobileBar(count, total);
    }

    // --- STICKY BAR MOBILE ---
    function updateMobileBar(count, total) {
        const bar = document.getElementById('mobileCartBar');
        if (!bar) return;
        const mCount = document.getElementById('mobileCartCount');
        const mTotal = document.getElementById('mobileCartTotal');
        if (mCount) mCount.textContent = count;
        if (mTotal) mTotal.textContent = total.toLocaleString();
        if (count > 0) {
            bar.classList.add('visible');
            document.body.classList.add('has-cart-items');
        } else {
            bar.classList.remove('visible');
            document.body.classList.remove('has-cart-items');
        }
    }

    // --- UP-SELLING INTELIGENTE ---
    const upsellRules = [
        { if: 'panificados', suggest: 'queso', msg: '¿Te faltó el queso para las burgers? 🧀' },
        { if: 'hamburguesas', suggest: 'panificados', msg: '¿Sumamos el pan artesanal? 🍞' },
        { if: 'panificados', suggest: 'salsas', msg: '¿Una salsa para completar? 🥫' },
        { if: 'hamburguesas', suggest: 'salsas', msg: '¿Una salsa para tus burgers? 🥫' },
        { if: null, suggest: 'combos', msg: '¡Ahorrá con un combo! 🎁' }
    ];

    function renderUpsell() {
        const upsellDiv = document.getElementById('upsellSection');
        if (!upsellDiv || cart.length === 0) { if (upsellDiv) upsellDiv.innerHTML = ''; return; }

        const cartCategories = new Set(cart.map(i => i.category));

        for (const rule of upsellRules) {
            const matches = rule.if === null || cartCategories.has(rule.if);
            const alreadyHas = cartCategories.has(rule.suggest);
            if (matches && !alreadyHas) {
                const suggested = products.find(p => p.category === rule.suggest && p.stock > 0);
                if (suggested) {
                    upsellDiv.innerHTML = `
                        <div class="upsell-card">
                            <img src="/${suggested.image}" alt="${suggested.name}" class="upsell-img">
                            <div class="upsell-text">
                                <p>${rule.msg}</p>
                                <span class="upsell-product-name">${suggested.name} — $${suggested.price.toLocaleString()}</span>
                            </div>
                            <button class="btn-upsell" onclick="addToCart(null,${suggested.id})">+ Sumar</button>
                        </div>`;
                    return;
                }
            }
        }
        upsellDiv.innerHTML = '';
    }

    function renderCartItems() {
        const el = document.getElementById('cartItems');
        if (cart.length === 0) el.innerHTML = '<p style="text-align:center;">Tu carrito está vacío</p>';
        else el.innerHTML = cart.map(i => `
            <div class="cart-item-row">
                <img src="${i.image}" alt="${i.name}">
                <div style="flex:1"><b>${i.name}</b><br>$${i.price.toLocaleString()}</div>
                <div class="cart-qty-selector">
                    <button onclick="cartQtyChange(${i.id},-1)">-</button>
                    <span>${i.quantity}</span>
                    <button onclick="cartQtyChange(${i.id},1)">+</button>
                </div>
                <button class="remove-btn" onclick="removeFromCart(${i.id})">&times;</button>
            </div>`).join('');
        renderUpsell();
    }

    window.cartQtyChange = (id, delta) => {
        const item = cart.find(i => i.id === id);
        if (!item) return;
        const newQty = item.quantity + delta;
        if (newQty < 1) return;
        item.quantity = newQty;
        updateCartDisplay();
    };

    window.removeFromCart = (id) => { cart = cart.filter(i => i.id !== id); updateCartDisplay(); };

    // --- OCULTAR/MOSTRAR WHATSAPP EN MODALES ---
    function hideWaBtn() { document.querySelector('.wa-floating-btn')?.classList.add('hidden'); }
    function showWaBtn() { document.querySelector('.wa-floating-btn')?.classList.remove('hidden'); }

    function setupEventListeners() {
        filterContainer?.addEventListener('click', e => {
            const btn = e.target.closest('.filter-btn');
            if (btn) { document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderProducts(); }
        });
        searchInput?.addEventListener('input', renderProducts);
        document.getElementById('headerCartIcon').addEventListener('click', (e) => { e.preventDefault(); cartModal.style.display='flex'; setTimeout(() => cartModal.classList.add('active'), 10); document.getElementById('mobileCartBar')?.classList.remove('visible'); hideWaBtn(); });
        document.getElementById('mobileCheckoutBtn')?.addEventListener('click', () => { cartModal.style.display='flex'; setTimeout(() => cartModal.classList.add('active'), 10); document.getElementById('mobileCartBar')?.classList.remove('visible'); hideWaBtn(); });
        document.querySelector('.close-cart').addEventListener('click', () => { cartModal.classList.remove('active'); setTimeout(() => cartModal.style.display='none', 400); if (cart.length > 0) document.getElementById('mobileCartBar')?.classList.add('visible'); showWaBtn(); });
        document.querySelector('.close-checkout').addEventListener('click', () => { checkoutModal.classList.remove('active'); setTimeout(() => checkoutModal.style.display='none', 400); showWaBtn(); });
        document.getElementById('goToCheckout').addEventListener('click', () => {
            cartModal.classList.remove('active'); setTimeout(() => { cartModal.style.display = 'none'; checkoutModal.style.display = 'flex'; setTimeout(() => checkoutModal.classList.add('active'), 10); }, 400);
            document.getElementById('orderItemsSummary').innerHTML = cart.map(i => `<div style="display:flex; justify-content:space-between;"><span>${i.name} x${i.quantity}</span><span>$${(i.price*i.quantity).toLocaleString()}</span></div>`).join('');
            const isEnvio = document.querySelector('input[name="metodoEntrega"]:checked').value === 'Envío a Domicilio';
            const ef = paymentMethodSelect?.querySelector('option[value="efectivo"]');
            if (ef && isEnvio) { ef.disabled = true; if (paymentMethodSelect.value === 'efectivo') paymentMethodSelect.value = 'transferencia'; }
        });
        document.getElementById('clearCart').addEventListener('click', () => { if(confirm('¿Vaciar carrito?')) { cart=[]; updateCartDisplay(); } });
        deliveryMethodRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isEnvio = e.target.value === 'Envío a Domicilio';
                deliveryAddressContainer.style.display = isEnvio ? 'block' : 'none';
                const ef = paymentMethodSelect?.querySelector('option[value="efectivo"]');
                if (ef) { if (isEnvio) { ef.disabled = true; if (paymentMethodSelect.value === 'efectivo') paymentMethodSelect.value = 'transferencia'; } else { ef.disabled = false; } }
            });
        });
        // Toggle datos bancarios según método de pago
        paymentMethodSelect?.addEventListener('change', () => {
            const bankInfo = document.getElementById('bankInfoContainer');
            if (bankInfo) bankInfo.style.display = paymentMethodSelect.value === 'transferencia' ? 'block' : 'none';
        });

        document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fData = new FormData(e.target);
            const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
            const nombre = fData.get('nombre');
            const telefono = fData.get('telefono');
            const entrega = fData.get('metodoEntrega');
            const direccion = fData.get('direccion') || '';
            const ciudad = fData.get('ciudad') || '';
            const pago = fData.get('metodoPago');

            const orderData = {
                customer: { nombre, telefono },
                metodoEntrega: entrega,
                direccion, ciudad,
                metodoPago: pago,
                items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
                total
            };

            // --- FLUJO MERCADO PAGO ---
            if (pago === 'mercadopago') {
                try {
                    const btn = e.target.querySelector('button[type="submit"]');
                    btn.disabled = true; btn.textContent = 'Conectando con Mercado Pago...';
                    const mpRes = await fetch('/create-preference', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            items: cart.map(i => ({ title: i.name, quantity: i.quantity, unit_price: i.price }))
                        })
                    });
                    const mpData = await mpRes.json();
                    if (mpData.init_point) {
                        // Guardar pedido pendiente para enviar después del pago
                        localStorage.setItem('novaPanesPendingOrder', JSON.stringify(orderData));
                        localStorage.setItem('novaPanesPendingCart', JSON.stringify(cart));
                        window.location.href = mpData.init_point;
                        return;
                    } else {
                        alert('Error al conectar con Mercado Pago. Probá de nuevo.');
                        btn.disabled = false; btn.textContent = 'CONFIRMAR PEDIDO';
                    }
                } catch (err) {
                    console.error('Error MP:', err);
                    alert('Error al conectar con Mercado Pago.');
                    e.target.querySelector('button[type="submit"]').disabled = false;
                    e.target.querySelector('button[type="submit"]').textContent = 'CONFIRMAR PEDIDO';
                }
                return;
            }

            // --- FLUJO TRANSFERENCIA / EFECTIVO ---
            // Enviar pedido al servidor
            try {
                await fetch('/api/submit-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderData)
                });
            } catch (err) { console.error('Error guardando pedido:', err); }

            // Enviar comprobante si existe
            const comprobanteFile = document.getElementById('comprobanteInput')?.files[0];
            if (comprobanteFile && pago === 'transferencia') {
                try {
                    const compData = new FormData();
                    compData.append('comprobante', comprobanteFile);
                    compData.append('nombre', nombre);
                    compData.append('telefono', telefono);
                    compData.append('total', total);
                    await fetch('/api/upload-comprobante', { method: 'POST', body: compData });
                } catch (err) { console.error('Error subiendo comprobante:', err); }
            }

            // Mensaje completo de WhatsApp
            sendWhatsAppOrder(orderData, cart);

            cart = []; updateCartDisplay(); checkoutModal.classList.remove('active');
            setTimeout(() => checkoutModal.style.display = 'none', 400); showWaBtn();
        });
        window.onclick = (event) => { if (event.target == cartModal) { cartModal.classList.remove('active'); setTimeout(() => cartModal.style.display="none", 400); showWaBtn(); if (cart.length > 0) document.getElementById('mobileCartBar')?.classList.add('visible'); } if (event.target == checkoutModal) { checkoutModal.classList.remove('active'); setTimeout(() => checkoutModal.style.display="none", 400); showWaBtn(); } }
    }

    function updateCartDisplayFromStorage() { const s = localStorage.getItem('novaPanesCart'); if (s) { cart = JSON.parse(s); updateCartDisplay(); } }

    function sendWhatsAppOrder(orderData, cartItems) {
        let msg = `*🍞 NUEVO PEDIDO - NOVA PANES*\n\n`;
        msg += `*Cliente:* ${orderData.customer.nombre}\n`;
        msg += `*WhatsApp:* ${orderData.customer.telefono}\n`;
        msg += `*Entrega:* ${orderData.metodoEntrega}\n`;
        if (orderData.metodoEntrega === 'Envío a Domicilio' && orderData.direccion) msg += `*Dirección:* ${orderData.direccion}, ${orderData.ciudad}\n`;
        msg += `*Pago:* ${orderData.metodoPago}\n`;
        msg += `\n----------\n`;
        cartItems.forEach(i => msg += `• ${i.name} x${i.quantity} — $${(i.price * i.quantity).toLocaleString()}\n`);
        msg += `----------\n*TOTAL: $${orderData.total.toLocaleString()}*`;
        window.open(`https://wa.me/5491164372200?text=${encodeURIComponent(msg)}`, '_blank');
    }

    function checkMercadoPagoReturn() {
        const params = new URLSearchParams(window.location.search);
        const paymentStatus = params.get('payment') || params.get('status');
        const pendingOrder = localStorage.getItem('novaPanesPendingOrder');

        if (paymentStatus === 'success' && pendingOrder) {
            const orderData = JSON.parse(pendingOrder);
            const pendingCart = JSON.parse(localStorage.getItem('novaPanesPendingCart') || '[]');

            // Limpiar datos pendientes
            localStorage.removeItem('novaPanesPendingOrder');
            localStorage.removeItem('novaPanesPendingCart');
            localStorage.removeItem('novaPanesCart');

            // Guardar pedido en el servidor
            fetch('/api/submit-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            }).catch(err => console.error('Error guardando pedido:', err));

            // Enviar WhatsApp con datos completos
            orderData.metodoPago = 'Mercado Pago ✅ PAGADO';
            sendWhatsAppOrder(orderData, pendingCart);

            // Limpiar URL
            window.history.replaceState({}, '', '/shop.html');

            // Mostrar confirmación
            setTimeout(() => alert('¡Pago recibido! Tu pedido fue enviado por WhatsApp.'), 500);
        } else if (paymentStatus === 'failure' && pendingOrder) {
            localStorage.removeItem('novaPanesPendingOrder');
            localStorage.removeItem('novaPanesPendingCart');
            window.history.replaceState({}, '', '/shop.html');
            alert('El pago no se completó. Podés intentar de nuevo.');
        } else if (paymentStatus === 'pending' && pendingOrder) {
            const orderData = JSON.parse(pendingOrder);
            const pendingCart = JSON.parse(localStorage.getItem('novaPanesPendingCart') || '[]');
            localStorage.removeItem('novaPanesPendingOrder');
            localStorage.removeItem('novaPanesPendingCart');
            localStorage.removeItem('novaPanesCart');

            fetch('/api/submit-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            }).catch(err => console.error('Error guardando pedido:', err));

            orderData.metodoPago = 'Mercado Pago ⏳ PENDIENTE';
            sendWhatsAppOrder(orderData, pendingCart);
            window.history.replaceState({}, '', '/shop.html');
            setTimeout(() => alert('Tu pago está pendiente de confirmación. El pedido fue enviado por WhatsApp.'), 500);
        }
    }

    window.openQuickView = (id) => {
        const p = products.find(prod => prod.id === id);
        const m = document.createElement('div'); m.className = "cart-modal"; m.style.display = "flex";
        setTimeout(() => m.classList.add('active'), 10);
        m.onclick = (e) => { if(e.target === m) { m.classList.remove('active'); setTimeout(() => m.remove(), 400); } };
        m.innerHTML = `<div class="cart-modal-content" style="text-align:center;"><span onclick="this.parentElement.parentElement.classList.remove('active'); setTimeout(()=>this.parentElement.parentElement.remove(), 400);" style="position:absolute;top:20px;right:25px;font-size:2rem;cursor:pointer;">&times;</span><img src="/${p.image}" style="width:100%;max-height:250px;object-fit:contain;margin-bottom:20px;" alt="${p.name}"><h2>${p.name}</h2><p>${p.description}</p><div class="premium-price"><small>$</small>${p.price.toLocaleString()}</div><button onclick="addToCart(null, ${p.id}); this.textContent='¡AGREGADO!'; setTimeout(()=>{ this.parentElement.parentElement.classList.remove('active'); setTimeout(()=>this.parentElement.parentElement.remove(), 400); }, 800);" class="btn-primary" style="width:100%;">AGREGAR AL CARRITO</button></div>`;
        document.body.appendChild(m);
    };
});