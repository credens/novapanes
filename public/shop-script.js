// ===================================================
//      ARCHIVO shop-script.js (CON LÓGICA DE OFERTAS)
// ===================================================

document.addEventListener('DOMContentLoaded', function() {
    let products = [];
    let categories = [];
    let cart = [];

    const shopProducts = document.getElementById('shopProducts');
    const filterContainer = document.getElementById('filter-container');
    const logoScroller = document.getElementById('logo-scroller');
    const cartFloating = document.getElementById('cartFloating');
    const cartModal = document.getElementById('cartModal');
    const checkoutModal = document.getElementById('checkoutModal');
    
    Promise.all([
        fetch('/products.json').then(res => res.json()),
        fetch('/data/categories.json').then(res => res.json()),
        fetch('/data/logos.json').then(res => res.json())
    ]).then(([productsData, categoriesData, logosData]) => {
        products = productsData;
        categories = categoriesData;
        const logos = logosData;

        renderLogoScroller(logos);
        renderCategoryFilters();
        renderProducts();
        setupEventListeners();
        updateCartDisplayFromStorage();
    }).catch(error => {
        console.error('Error fatal al cargar los datos iniciales:', error);
        if(shopProducts) shopProducts.innerHTML = '<p style="text-align: center; color: red; padding: 40px;">Error: No se pudieron cargar los datos de la tienda. Por favor, intente más tarde.</p>';
    });

    function renderLogoScroller(logos) { if (!logoScroller) return; const logosToRender = [...logos, ...logos]; logoScroller.innerHTML = logosToRender.map(logoFilename => `<img src="/logos/${logoFilename}" alt="Logo de marca">`).join(''); }
    function renderCategoryFilters() { if (!filterContainer) return; filterContainer.innerHTML = '<button class="filter-btn active" data-filter="all">Todos</button>'; categories.forEach(category => { const button = document.createElement('button'); button.className = 'filter-btn'; button.dataset.filter = category.id; button.textContent = category.name; filterContainer.appendChild(button); }); }
    
    // ===============================================
    // === FUNCIÓN RENDERPRODUCTS MODIFICADA PARA OFERTAS ===
    // ===============================================
    function renderProducts(filter = 'all') {
        if (!shopProducts) return;
        shopProducts.innerHTML = '';
        const filteredProducts = filter === 'all' ? products : products.filter(p => p.category === filter);
        
        if (filteredProducts.length === 0) {
            shopProducts.innerHTML = '<p style="text-align: center; padding: 40px 0;">No hay productos en esta categoría.</p>';
            return;
        }

        filteredProducts.forEach(product => {
            const isOnSale = product.promo_price && product.promo_price < product.price;
            const currentPrice = isOnSale ? product.promo_price : product.price;

            const priceHTML = isOnSale
                ? `<div class="product-price sale">$${currentPrice.toLocaleString()} <span class="original-price">$${product.price.toLocaleString()}</span></div>`
                : `<div class="product-price">$${currentPrice.toLocaleString()}</div>`;

            const productHTML = `
                <div class="product-item ${isOnSale ? 'on-sale' : ''}" data-category="${product.category}">
                    <script type="application/ld+json">
                    {
                      "@context": "https://schema.org/",
                      "@type": "Product",
                      "name": "${product.name.replace(/"/g, '\\"')}",
                      "image": "https://novapanes.com.ar/${product.image}",
                      "description": "${product.description.replace(/"/g, '\\"')}",
                      "sku": "NOVA-${product.id}",
                      "brand": { "@type": "Brand", "name": "NOVA Panes" },
                      "offers": {
                        "@type": "Offer",
                        "url": "https://novapanes.com.ar/shop.html",
                        "priceCurrency": "ARS",
                        "price": "${currentPrice}",
                        ${isOnSale ? `"priceSpecification": { "@type": "PriceSpecification", "price": "${product.price}", "priceCurrency": "ARS" },` : ''}
                        "availability": "${product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'}"
                      }
                    }
                    </script>
                    ${isOnSale ? '<div class="sale-badge">OFERTA</div>' : ''}
                    <img src="${product.image}" alt="${product.name}" class="product-image" onclick="openProductModal('${product.image}', '${product.name}')" loading="lazy">
                    <div class="product-info">
                        <h3 class="product-title">${product.name}</h3>
                        <p class="product-description">${product.description}</p>
                        ${priceHTML}
                        <div class="product-actions">
                            <div class="quantity-controls">
                                <button class="qty-btn" onclick="changeQuantity(${product.id}, -1)">-</button>
                                <input type="number" class="qty-input" id="qty-${product.id}" value="1" min="1" max="${product.stock}">
                                <button class="qty-btn" onclick="changeQuantity(${product.id}, 1)">+</button>
                            </div>
                            <button class="add-to-cart-btn" onclick="addToCart(event, ${product.id})">Agregar al Carrito</button>
                        </div>
                    </div>
                </div>`;
            shopProducts.innerHTML += productHTML;
        });
    }

    function setupEventListeners() {
        document.querySelector('.shop-filters').addEventListener('click', function(e) { if (e.target.classList.contains('filter-btn')) { document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); e.target.classList.add('active'); renderProducts(e.target.dataset.filter); } });
        if (cartFloating) cartFloating.addEventListener('click', openCartModal);
        document.querySelector('.close-cart')?.addEventListener('click', closeCartModal);
        document.querySelector('.close-checkout')?.addEventListener('click', closeCheckout);
        document.getElementById('clearCart')?.addEventListener('click', clearCart);
        document.getElementById('checkout')?.addEventListener('click', openCheckout);
        document.getElementById('checkoutForm')?.addEventListener('submit', handleCheckout);
        if (cartModal) cartModal.addEventListener('click', e => { if (e.target === cartModal) closeCartModal(); });
        if (checkoutModal) checkoutModal.addEventListener('click', e => { if (e.target === checkoutModal) closeCheckout(); });
    }

    window.changeQuantity = (id, change) => { const input = document.getElementById(`qty-${id}`); if (!input) return; let val = parseInt(input.value) + change; const p = products.find(prod => prod.id === id); if (!p) return; if (val < 1) val = 1; if (val > p.stock) val = p.stock; input.value = val; };
    window.addToCart = (event, id) => {
        const p = products.find(prod => prod.id === id);
        if (!p) return;
        const q = parseInt(document.getElementById(`qty-${id}`).value);
        
        // Al agregar al carrito, usamos el precio de oferta si existe
        const priceToUse = (p.promo_price && p.promo_price < p.price) ? p.promo_price : p.price;

        const itemInCart = cart.find(i => i.id === id);
        if (itemInCart) {
            if (itemInCart.quantity + q <= p.stock) {
                itemInCart.quantity += q;
            } else {
                return alert(`Stock insuficiente. Solo quedan ${p.stock} unidades.`);
            }
        } else {
            if (q > p.stock) {
                return alert(`Stock insuficiente. Solo quedan ${p.stock} unidades.`);
            }
            // Guardamos el producto en el carrito con el precio correcto (sea promo o no)
            cart.push({ ...p, price: priceToUse, quantity: q });
        }
        updateCartDisplay();
        const btn = event.target; btn.textContent = '¡Agregado!'; btn.style.background = '#4CAF50'; setTimeout(() => { btn.textContent = 'Agregar al Carrito'; btn.style.background = '#B5651D'; }, 1000);
    };
    window.updateCartItemQuantity = (id, newQ) => { const item = cart.find(i => i.id === id); if (!item) return; if (newQ <= 0) { removeFromCart(id); return; } const p = products.find(prod => prod.id === id); if (newQ > p.stock) return alert(`Stock insuficiente`); item.quantity = newQ; updateCartDisplay(); };
    window.removeFromCart = (id) => { cart = cart.filter(i => i.id !== id); updateCartDisplay(); };
    window.openProductModal = (src, title) => { const m = document.createElement('div'); m.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;" onclick="this.remove()"><div style="max-width:90%;max-height:90%;background:white;border-radius:12px;overflow:hidden;animation:modalAppear .3s;" onclick="event.stopPropagation()"><img src="${src}" style="width:100%;height:auto;display:block;"><div style="padding:20px;text-align:center;font-family:'Lora',serif;font-size:1.2rem;">${title}</div></div></div>`; document.body.appendChild(m); };
    
    function updateCartDisplay() { const totalItems = cart.reduce((s, i) => s + i.quantity, 0); const totalPrice = cart.reduce((s, i) => s + (i.price * i.quantity), 0); const cCount = document.getElementById('cartCount'); if (cCount) cCount.textContent = totalItems; const cTotal = document.getElementById('cartTotal'); if (cTotal) cTotal.textContent = totalPrice.toLocaleString(); if (cartFloating) cartFloating.style.display = totalItems > 0 ? 'block' : 'none'; localStorage.setItem('novaPanesCart', JSON.stringify(cart)); renderCartItems(); }
    function renderCartItems() { const cItemsEl = document.getElementById('cartItems'); if (!cItemsEl) return; if (cart.length === 0) { cItemsEl.innerHTML = '<div class="empty-cart-message">Tu carrito está vacío</div>'; return; } cItemsEl.innerHTML = cart.map(item => `<div class="cart-item"><img src="${item.image}" alt="${item.name}" class="cart-item-image"><div class="cart-item-info"><div class="cart-item-title">${item.name}</div><div class="cart-item-price">$${item.price.toLocaleString()}</div></div><div class="cart-item-quantity"><button class="cart-qty-btn" onclick="updateCartItemQuantity(${item.id}, ${item.quantity - 1})">-</button><span class="cart-qty-display">${item.quantity}</span><button class="cart-qty-btn" onclick="updateCartItemQuantity(${item.id}, ${item.quantity + 1})">+</button></div><button class="remove-item" onclick="removeFromCart(${item.id})">×</button></div>`).join(''); }
    function clearCart() { if (confirm('¿Vaciar el carrito?')) { cart = []; updateCartDisplay(); } }
    function openCartModal() { if (cartModal) { cartModal.style.display = 'block'; renderCartItems(); } }
    function closeCartModal() { if (cartModal) cartModal.style.display = 'none'; }
    function openCheckout() { if (cart.length === 0) return alert('Tu carrito está vacío'); closeCartModal(); if (checkoutModal) { checkoutModal.style.display = 'block'; renderOrderSummary(); } }
    function closeCheckout() { if (checkoutModal) checkoutModal.style.display = 'none'; }
    function renderOrderSummary() { const oItems = document.getElementById('orderItems'); const oTotal = document.getElementById('orderTotal'); const tPrice = cart.reduce((s, i) => s + (i.price * i.quantity), 0); if (oItems) oItems.innerHTML = cart.map(i => `<div class="order-item"><span>${i.name} x ${i.quantity}</span><span>$${(i.price * i.quantity).toLocaleString()}</span></div>`).join(''); if (oTotal) oTotal.textContent = tPrice.toLocaleString(); }
    function updateCartDisplayFromStorage() { const savedCart = localStorage.getItem('novaPanesCart'); if (savedCart) { cart = JSON.parse(savedCart); } updateCartDisplay(); }
    async function handleCheckout(e) { e.preventDefault(); const form = e.target; const fData = new FormData(form); const pMethod = fData.get('metodoPago'); const btn = form.querySelector('button[type="submit"]'); btn.textContent = 'Procesando...'; btn.disabled = true; if (pMethod === 'mercadopago') { try { const oData = { items: cart.map(i => ({ id: i.id, title: i.name, quantity: i.quantity, unit_price: i.price })), payer: { name: fData.get('nombre'), email: fData.get('email'), phone: { number: fData.get('telefono') } } }; const res = await fetch('/create-preference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(oData), }); if (!res.ok) { throw new Error((await res.json()).message || 'Error al generar link de pago.'); } const pref = await res.json(); window.location.href = pref.init_point; } catch (err) { alert(`Error: ${err.message}`); btn.textContent = 'Confirmar Pedido'; btn.disabled = false; } } else { const oData = { customer: { nombre: fData.get('nombre'), email: fData.get('email'), telefono: fData.get('telefono'), direccion: fData.get('direccion'), ciudad: fData.get('ciudad'), codigoPostal: fData.get('codigoPostal'), referencias: fData.get('referencias') }, metodoPago: pMethod, items: cart, total: cart.reduce((s, i) => s + (i.price * i.quantity), 0) }; const wMsg = `🍞 *NUEVO PEDIDO - NOVA PANES* 🍞\n\n👤 *Cliente:* ${oData.customer.nombre}\n📧 *Email:* ${oData.customer.email}\n📱 *Teléfono:* ${oData.customer.telefono}\n📍 *Dirección:* ${oData.customer.direccion}, ${oData.customer.ciudad}\n\n💳 *Método de pago:* ${oData.metodoPago}\n\n🛒 *PRODUCTOS:*\n${oData.items.map(item => `• ${item.name} x${item.quantity} - $${(item.price * item.quantity).toLocaleString()}`).join('\n')}\n\n💰 *TOTAL: $${oData.total.toLocaleString()}*`; window.open(`https://wa.me/5491164372200?text=${encodeURIComponent(wMsg)}`, '_blank'); fetch('/api/submit-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(oData), }).catch(err => console.error('Error de red al enviar email:', err)); alert('¡Pedido enviado! Te hemos redirigido a WhatsApp para confirmar.'); cart = []; updateCartDisplay(); closeCheckout(); btn.textContent = 'Confirmar Pedido'; btn.disabled = false; } }
});