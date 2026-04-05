// ===================================================
//      ARCHIVO shop-script.js (SIN POPUP PROMO)
// ===================================================

document.addEventListener('DOMContentLoaded', function() {
    let products = [];
    let allCategories = [];
    let cart = [];
    let currentView = 'grouped';

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
    
    // Elementos para validación dinámica
    const direccionInput = document.querySelector('input[name="direccion"]');
    const ciudadInput = document.querySelector('input[name="ciudad"]');

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
    });

    function renderLogoScroller(logos) {
        if (!logoScroller || !Array.isArray(logos)) return;
        const logosToRender = [...logos, ...logos, ...logos];
        logoScroller.innerHTML = logosToRender.map(logoFilename => `<img src="/logos/${logoFilename}" alt="Marca Proveedora">`).join('');
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
            shopProductsContainer.innerHTML = '<p style="text-align: center; padding: 40px 0;">No se encontraron productos.</p>';
            return;
        }
        renderGroupedView(finalProducts);
    }

    function renderGroupedView(productsToRender) {
        const productsByCategory = productsToRender.reduce((acc, product) => {
            (acc[product.category] = acc[product.category] || []).push(product);
            return acc;
        }, {});

        allCategories.forEach(category => {
            if (productsByCategory[category.id]) {
                let productsHTML = productsByCategory[category.id].map(p => generateProductCardHTML(p)).join('');
                shopProductsContainer.innerHTML += `
                    <div class="category-group">
                        <h2 class="category-group-title">${category.name}</h2>
                        <div class="shop-products">${productsHTML}</div>
                    </div>`;
            }
        });
    }

    function generateProductCardHTML(product) {
        const currentPrice = (product.promo_price && product.promo_price < product.price) ? product.promo_price : product.price;
        return `
            <div id="product-${product.id}" class="product-item">
                <img src="/${product.image}" alt="${product.name}" class="product-image" onclick="openProductModal('/${product.image}', '${product.name}')">
                <div class="product-info">
                    <h3 class="product-title" style="font-family: Lora; font-size: 1.3rem;">${product.name}</h3>
                    <p class="product-description">${product.description}</p>
                    <div class="product-price">$${currentPrice.toLocaleString()}</div>
                    <button class="add-to-cart-btn" onclick="addToCart(event, ${product.id})">AGREGAR AL CARRITO</button>
                </div>
            </div>`;
    }

    function setupEventListeners() {
        filterContainer?.addEventListener('click', e => {
            if (e.target.classList.contains('filter-btn')) {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                renderProducts();
            }
        });
        searchInput.addEventListener('input', renderProducts);
        
        deliveryMethodRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isDelivery = e.target.value === 'Envío a Domicilio';
                deliveryAddressContainer.style.display = isDelivery ? 'block' : 'none';
                deliveryTimeSelect.required = isDelivery;
                if (direccionInput) direccionInput.required = isDelivery;
                if (ciudadInput) ciudadInput.required = isDelivery;
            });
        });

        paymentMethodSelect.addEventListener('change', e => {
            transferInfo.style.display = e.target.value === 'transferencia' ? 'block' : 'none';
        });

        headerCartIcon?.addEventListener('click', openCartModal);
        document.querySelector('.close-cart')?.addEventListener('click', closeCartModal);
        document.querySelector('.close-checkout')?.addEventListener('click', closeCheckout);
        document.querySelector('.close-checkout-btn')?.addEventListener('click', closeCheckout);
        document.getElementById('clearCart')?.addEventListener('click', clearCart);
        document.getElementById('checkout')?.addEventListener('click', openCheckout);
        document.getElementById('checkoutForm')?.addEventListener('submit', handleCheckout);
    }

    function updateCartDisplay() {
        const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
        const totalPrice = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        document.getElementById('cartCount').textContent = totalItems;
        document.getElementById('cartTotal').textContent = totalPrice.toLocaleString();
        
        const checkoutBtn = document.getElementById('checkout');
        const minMsg = document.getElementById('minPurchaseMessage');
        if (totalPrice < MINIMUM_PURCHASE && cart.length > 0) {
            minMsg.textContent = `Monto mínimo: $${MINIMUM_PURCHASE.toLocaleString()}. Faltan $${(MINIMUM_PURCHASE - totalPrice).toLocaleString()}.`;
            checkoutBtn.disabled = true;
        } else {
            minMsg.textContent = '';
            checkoutBtn.disabled = false;
        }
        localStorage.setItem('novaPanesCart', JSON.stringify(cart));
        renderCartItems();
    }

    window.addToCart = (event, id) => {
        const p = products.find(prod => prod.id === id);
        const price = (p.promo_price && p.promo_price < p.price) ? p.promo_price : p.price;
        const item = cart.find(i => i.id === id);
        if (item) item.quantity++; else cart.push({...p, price, quantity: 1});
        updateCartDisplay();
        const btn = event.target;
        btn.textContent = '¡AGREGADO!'; btn.style.background = '#4CAF50';
        setTimeout(() => { btn.textContent = 'AGREGAR AL CARRITO'; btn.style.background = '#FFB300'; }, 1000);
    };

    function renderCartItems() {
        const cItemsEl = document.getElementById('cartItems');
        if (cart.length === 0) { cItemsEl.innerHTML = '<p style="text-align:center; padding:20px;">Tu carrito está vacío</p>'; return; }
        cItemsEl.innerHTML = cart.map(i => `
            <div style="display:flex; align-items:center; padding:15px; border-bottom:1px solid #EEE;">
                <img src="${i.image}" style="width:50px; margin-right:15px; border-radius: 8px;"> 
                <div style="flex:1"><b>${i.name}</b><br>$${i.price.toLocaleString()} x ${i.quantity}</div>
                <button onclick="removeFromCart(${i.id})" style="background:none; border:none; color:#999; cursor:pointer; font-size: 1.2rem;">&times;</button>
            </div>`).join('');
    }

    window.removeFromCart = (id) => { cart = cart.filter(i => i.id !== id); updateCartDisplay(); };
    function renderOrderSummary() {
        const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        document.getElementById('orderItems').innerHTML = cart.map(i => `<div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-bottom:5px;"><span>${i.name} x${i.quantity}</span><span>$${(i.price*i.quantity).toLocaleString()}</span></div>`).join('');
        document.getElementById('orderTotal').textContent = total.toLocaleString();
    }

    async function handleCheckout(e) {
        e.preventDefault();
        const form = e.target;
        const fData = new FormData(form);
        const pMethod = fData.get('metodoPago');
        const btn = form.querySelector('button[type="submit"]');
        btn.textContent = 'Procesando...'; btn.disabled = true;

        const deliveryMethod = fData.get('metodoEntrega');

        const customerData = {
            nombre: fData.get('nombre'), email: fData.get('email'), telefono: fData.get('telefono'),
            metodoEntrega: deliveryMethod, direccion: fData.get('direccion'), ciudad: fData.get('ciudad'),
            horarioEntrega: fData.get('horarioEntrega')
        };

        if (pMethod === 'mercadopago') {
            try {
                const res = await fetch('/create-preference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart.map(i => ({ id: i.id, title: i.name, quantity: i.quantity, unit_price: i.price })), payer: { name: customerData.nombre, email: customerData.email } }) });
                const pref = await res.json();
                cart = []; updateCartDisplay();
                window.location.href = pref.init_point;
            } catch (err) { alert('Error con Mercado Pago'); btn.disabled = false; btn.textContent = 'Confirmar Pedido'; }
        } else {
            await fetch('/api/submit-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: customerData, metodoPago: pMethod, items: cart, total: cart.reduce((s, i) => s + (i.price * i.quantity), 0) }) });
            const wMsg = `🍞 *NUEVO PEDIDO*\nCliente: ${customerData.nombre}\nTotal: $${cart.reduce((s, i) => s + (i.price * i.quantity), 0).toLocaleString()}`;
            window.open(`https://wa.me/5491140882236?text=${encodeURIComponent(wMsg)}`, '_blank');
            cart = []; updateCartDisplay(); closeCheckout();
            alert('¡Pedido enviado! Te redirigimos a WhatsApp.');
        }
    }

    function clearCart() { if(confirm('¿Vaciar carrito?')) { cart = []; updateCartDisplay(); } }
    function openCartModal() { cartModal.style.display = 'block'; }
    function closeCartModal() { cartModal.style.display = 'none'; }
    function closeCheckout() { checkoutModal.style.display = 'none'; }
    function updateCartDisplayFromStorage() { const saved = localStorage.getItem('novaPanesCart'); if (saved) { cart = JSON.parse(saved); updateCartDisplay(); } }

    window.openProductModal = (src, title) => {
        const m = document.createElement('div');
        m.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;";
        m.onclick = () => m.remove();
        m.innerHTML = `<div style="background:white; padding:30px; border-radius:35px; max-width:500px; width:100%; text-align:center;">
            <img src="${src}" style="width:100%; border-radius:20px; margin-bottom:20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
            <h3 style="font-family:Lora; font-size:1.8rem; color:var(--primary-red);">${title}</h3>
        </div>`;
        document.body.appendChild(m);
    };
});