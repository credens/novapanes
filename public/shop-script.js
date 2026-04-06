document.addEventListener('DOMContentLoaded', function() {
    // ===================================================
    //      ESTADO GLOBAL Y CONFIGURACIÓN
    // ===================================================
    let products = []; 
    let allCategories = []; 
    let cart = [];
    const FREE_SHIPPING_MIN = 75000;
    const MINIMUM_PURCHASE = 15000;

    // Elementos del DOM
    const filterContainer = document.getElementById('filter-container');
    const shopProductsContainer = document.getElementById('shopProducts');
    const searchInput = document.getElementById('searchInput');
    const cartModal = document.getElementById('cartModal');
    const checkoutModal = document.getElementById('checkoutModal');
    const paymentMethodSelect = document.getElementById('paymentMethodSelect');
    const deliveryMethodRadios = document.querySelectorAll('input[name="metodoEntrega"]');
    const deliveryAddressContainer = document.getElementById('deliveryAddressContainer');

    const categoryIcons = { 
        'panificados': '🍞', 'hamburguesas': '🍔', 'salchichas': '🌭', 
        'quesos': '🧀', 'combos': '🎁', 'salsas': '🥫', 'papas': '🍟',
        'papelera': '📦', 'congelados': '❄️', 'helados': '🍦'
    };

    // ===================================================
    //      CARGA DE DATOS
    // ===================================================
    Promise.all([
        fetch('/products').then(res => res.json()),
        fetch('/data/categories.json').then(res => res.json()),
        fetch('/data/logos.json').then(res => res.json())
    ]).then(([pData, cData, lData]) => {
        products = pData; 
        allCategories = cData;
        renderLogoScroller(lData); 
        renderCategoryFilters(); 
        renderProducts(); 
        setupEventListeners(); 
        updateCartDisplayFromStorage(); 
        initInfiniteScrollFilters();
    }).catch(err => console.error("Error cargando la tienda:", err));

    // ===================================================
    //      FUNCIONES DE RENDERIZADO
    // ===================================================

    function renderLogoScroller(logos) {
        const s = document.getElementById('shopLogoScroller');
        if(s && logos) {
            s.innerHTML = [...logos, ...logos, ...logos].map(l => `<img src="/logos/${l}" alt="Marca">`).join('');
        }
    }

    function renderCategoryFilters() {
        if (!filterContainer) return;
        const urlParams = new URLSearchParams(window.location.search);
        const urlCat = urlParams.get('category');
        const initial = allCategories.some(c => c.id === urlCat) ? urlCat : 'all';

        let html = `<button class="filter-btn ${initial === 'all' ? 'active' : ''}" data-filter="all"><span>✨</span> Todos</button>`;
        allCategories.forEach(c => {
            const icon = categoryIcons[c.id] || '🥖';
            html += `<button class="filter-btn ${initial === c.id ? 'active' : ''}" data-filter="${c.id}"><span>${icon}</span> ${c.name}</button>`;
        });
        filterContainer.innerHTML = html;
    }

    function initInfiniteScrollFilters() {
        if (!filterContainer) return;
        const items = [...filterContainer.children];
        items.forEach(item => {
            const clone = item.cloneNode(true);
            filterContainer.appendChild(clone);
        });
        filterContainer.addEventListener('scroll', () => {
            const maxScroll = filterContainer.scrollWidth / 2;
            if (filterContainer.scrollLeft >= maxScroll) {
                filterContainer.scrollLeft = 1;
            } else if (filterContainer.scrollLeft <= 0) {
                filterContainer.scrollLeft = maxScroll - 1;
            }
        });
    }

    function renderProducts() {
        const activeBtn = document.querySelector('.filter-btn.active');
        const filter = activeBtn ? activeBtn.dataset.filter : 'all';
        const search = searchInput.value.toLowerCase().trim();
        
        const filtered = filter === 'all' ? products : products.filter(p => p.category === filter);
        const final = search ? filtered.filter(p => p.name.toLowerCase().includes(search)) : filtered;

        shopProductsContainer.innerHTML = '';
        const grouped = final.reduce((acc, p) => { (acc[p.category] = acc[p.category] || []).push(p); return acc; }, {});

        allCategories.forEach(cat => {
            if (grouped[cat.id]) {
                let html = `<div class="category-group reveal active"><h2 class="category-group-title">${cat.name}</h2><div class="shop-products">`;
                html += grouped[cat.id].map(p => {
                    // Lógica Sin Stock
                    const isOutOfStock = p.stock <= 0;
                    
                    return `
                    <div class="product-item" style="${isOutOfStock ? 'opacity: 0.8;' : ''}">
                        ${p.badge ? `<div class="product-badge">${p.badge}</div>` : ''}
                        <img src="/${p.image}" class="product-image" onclick="${isOutOfStock ? '' : `openQuickView(${p.id})`}" style="${isOutOfStock ? 'filter: grayscale(1); cursor: default;' : ''}">
                        <div class="product-info">
                            <h3 class="product-title">${p.name}</h3>
                            <p class="product-description">${p.description}</p>
                            <div class="premium-price"><small>$</small>${p.price.toLocaleString()}</div>
                            <div class="product-controls">
                                <div class="quantity-selector" style="${isOutOfStock ? 'opacity: 0.5; pointer-events: none;' : ''}">
                                    <button class="qty-btn" onclick="changeQty(${p.id}, -1)">-</button>
                                    <input type="number" id="qty-input-${p.id}" class="qty-input" value="1" readonly>
                                    <button class="qty-btn" onclick="changeQty(${p.id}, 1)">+</button>
                                </div>
                                <button onclick="${isOutOfStock ? '' : `addToCart(event, ${p.id})`}" 
                                        class="add-to-cart-btn ${isOutOfStock ? 'btn-disabled' : ''}" 
                                        ${isOutOfStock ? 'disabled' : ''}>
                                    ${isOutOfStock ? 'SIN STOCK' : 'AGREGAR'}
                                </button>
                            </div>
                        </div>
                    </div>`;
                }).join('');
                shopProductsContainer.innerHTML += html + `</div></div>`;
            }
        });
    }

    // ===================================================
    //      LÓGICA DEL CARRITO
    // ===================================================

    window.changeQty = (id, delta) => {
        const input = document.getElementById(`qty-input-${id}`);
        if(input) { let v = parseInt(input.value) + delta; if (v < 1) v = 1; input.value = v; }
    };

    window.addToCart = (event, id) => {
        const p = products.find(prod => prod.id === id);
        if (p.stock <= 0) return;

        const input = document.getElementById(`qty-input-${id}`);
        const qty = input ? parseInt(input.value) : 1;
        const item = cart.find(i => i.id === id);
        if (item) item.quantity += qty; else cart.push({...p, quantity: qty});
        
        updateCartDisplay();

        const icon = document.getElementById('headerCartIcon');
        if(icon) { icon.classList.remove('cart-pop-active'); void icon.offsetWidth; icon.classList.add('cart-pop-active'); }
        
        if(event) {
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = '¡LISTO!';
            setTimeout(() => { btn.textContent = originalText; if(input) input.value = 1; }, 1000);
        }
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
            if(total >= FREE_SHIPPING_MIN) {
                msg.innerHTML = "¡Tenés <strong>ENVÍO GRATIS</strong>! 🚚"; fill.style.width = "100%"; fill.style.background = "#4CAF50";
            } else {
                const perc = (total / FREE_SHIPPING_MIN) * 100;
                msg.innerHTML = `Te faltan <strong>$${(FREE_SHIPPING_MIN - total).toLocaleString()}</strong> para el envío gratis`;
                fill.style.width = perc + "%"; fill.style.background = "var(--accent-yellow)";
            }
        }
        localStorage.setItem('novaPanesCart', JSON.stringify(cart));
        renderCartItems();
    }

    function renderCartItems() {
        const el = document.getElementById('cartItems');
        if (cart.length === 0) { el.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">Tu carrito está vacío</p>'; return; }
        el.innerHTML = cart.map(i => `
            <div class="cart-item-row">
                <img src="${i.image}">
                <div style="flex:1;"><b>${i.name}</b><br><span style="color:var(--primary-red); font-weight:700;">$${i.price.toLocaleString()} x ${i.quantity}</span></div>
                <button class="remove-btn" onclick="removeFromCart(${i.id})">&times;</button>
            </div>`).join('');
    }

    window.removeFromCart = (id) => { cart = cart.filter(i => i.id !== id); updateCartDisplay(); };

    // ===================================================
    //      EVENTOS Y MODALES
    // ===================================================

    function setupEventListeners() {
        filterContainer?.addEventListener('click', e => {
            const btn = e.target.closest('.filter-btn');
            if (btn) {
                const f = btn.dataset.filter;
                document.querySelectorAll('.filter-btn').forEach(b => { if(b.dataset.filter === f) b.classList.add('active'); else b.classList.remove('active'); });
                renderProducts();
            }
        });

        searchInput?.addEventListener('input', renderProducts);

        document.getElementById('headerCartIcon').addEventListener('click', (e) => {
            e.preventDefault(); cartModal.style.display='flex'; setTimeout(() => cartModal.classList.add('active'), 10);
        });

        document.querySelector('.close-cart').addEventListener('click', () => {
            cartModal.classList.remove('active'); setTimeout(() => cartModal.style.display='none', 400);
        });

        document.querySelector('.close-checkout').addEventListener('click', () => {
            checkoutModal.classList.remove('active'); setTimeout(() => checkoutModal.style.display='none', 400);
        });
        
        document.getElementById('goToCheckout').addEventListener('click', () => {
            cartModal.classList.remove('active');
            setTimeout(() => {
                cartModal.style.display = 'none';
                checkoutModal.style.display = 'flex';
                setTimeout(() => checkoutModal.classList.add('active'), 10);
            }, 400);
            
            document.getElementById('orderItemsSummary').innerHTML = cart.map(i => `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span>${i.name} x${i.quantity}</span>
                    <span>$${(i.price*i.quantity).toLocaleString()}</span>
                </div>`).join('');
            
            const isEnvio = document.querySelector('input[name="metodoEntrega"]:checked').value === 'Envío a Domicilio';
            const ef = paymentMethodSelect?.querySelector('option[value="efectivo"]');
            if (ef && isEnvio) {
                ef.disabled = true; ef.textContent = "Efectivo (Solo Retiro)";
                if (paymentMethodSelect.value === 'efectivo') paymentMethodSelect.value = 'transferencia';
            }
        });

        document.getElementById('clearCart').addEventListener('click', () => {
            if(confirm('¿Vaciar carrito?')) { cart=[]; updateCartDisplay(); }
        });

        deliveryMethodRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isEnvio = e.target.value === 'Envío a Domicilio';
                deliveryAddressContainer.style.display = isEnvio ? 'block' : 'none';
                const ef = paymentMethodSelect?.querySelector('option[value="efectivo"]');
                if (ef) {
                    if (isEnvio) {
                        ef.disabled = true; ef.textContent = "Efectivo (Solo Retiro)";
                        if (paymentMethodSelect.value === 'efectivo') paymentMethodSelect.value = 'transferencia';
                    } else {
                        ef.disabled = false; ef.textContent = "Efectivo al recibir";
                    }
                }
            });
        });

        document.getElementById('checkoutForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const fData = new FormData(e.target);
            const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
            let msg = `*🍞 NUEVO PEDIDO - NOVA PANES*\n*Cliente:* ${fData.get('nombre')}\n----------\n`;
            cart.forEach(i => msg += `• ${i.name} (x${i.quantity})\n`);
            msg += `----------\n*TOTAL: $${total.toLocaleString()}*`;
            window.open(`https://wa.me/5491164372200?text=${encodeURIComponent(msg)}`, '_blank');
            cart = []; updateCartDisplay(); checkoutModal.classList.remove('active'); setTimeout(() => checkoutModal.style.display='none', 400);
        });

        window.onclick = (event) => {
            if (event.target == cartModal) { cartModal.classList.remove('active'); setTimeout(() => cartModal.style.display="none", 400); }
            if (event.target == checkoutModal) { checkoutModal.classList.remove('active'); setTimeout(() => checkoutModal.style.display="none", 400); }
        }
    }

    function updateCartDisplayFromStorage() { const s = localStorage.getItem('novaPanesCart'); if (s) { cart = JSON.parse(s); updateCartDisplay(); } }

    window.openQuickView = (id) => {
        const p = products.find(prod => prod.id === id);
        const m = document.createElement('div'); m.className = "cart-modal"; m.style.display = "flex";
        setTimeout(() => m.classList.add('active'), 10);
        m.onclick = (e) => { if(e.target === m) { m.classList.remove('active'); setTimeout(() => m.remove(), 400); } };
        m.innerHTML = `
            <div class="cart-modal-content" style="text-align:center;">
                <span onclick="this.parentElement.parentElement.classList.remove('active'); setTimeout(()=>this.parentElement.parentElement.remove(), 400);" style="position:absolute; top:20px; right:25px; font-size:2rem; cursor:pointer;">&times;</span>
                <img src="/${p.image}" style="width:100%; max-height:280px; object-fit:contain; margin-bottom:20px;">
                <h2>${p.name}</h2><p>${p.description}</p><div class="premium-price"><small>$</small>${p.price.toLocaleString()}</div>
                <button onclick="addToCart(null, ${p.id}); this.textContent='¡AGREGADO!'; setTimeout(()=>{ this.parentElement.parentElement.classList.remove('active'); setTimeout(()=>this.parentElement.parentElement.remove(), 400); }, 800);" class="btn-primary" style="width:100%;">AGREGAR AL CARRITO</button>
            </div>`;
        document.body.appendChild(m);
    };
});