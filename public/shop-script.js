document.addEventListener('DOMContentLoaded', function() {
    let products = [];
    let allCategories = [];
    let cart = [];
    const MINIMUM_PURCHASE = 15000;

    const shopProductsContainer = document.getElementById('shopProducts');
    const filterContainer = document.getElementById('filter-container');
    const searchInput = document.getElementById('searchInput');
    const logoScroller = document.getElementById('logo-scroller');
    const cartModal = document.getElementById('cartModal');
    const checkoutModal = document.getElementById('checkoutModal');
    
    //Inputs dirección
    const direccionInput = document.querySelector('input[name="direccion"]');
    const ciudadInput = document.querySelector('input[name="ciudad"]');

    // CARGA DE DATOS (URL /products según tu server.js funcional)
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
    }).catch(err => console.error(err));

    function renderLogoScroller(logos) {
        if (!logoScroller || !Array.isArray(logos)) return;
        const content = [...logos, ...logos, ...logos];
        logoScroller.innerHTML = content.map(l => `<img src="/logos/${l}" alt="Marca">`).join('');
    }

    function renderCategoryFilters() {
        if (!filterContainer) return;
        filterContainer.innerHTML = '<button class="filter-btn active" data-filter="all">Todos</button>';
        allCategories.forEach(c => {
            filterContainer.innerHTML += `<button class="filter-btn" data-filter="${c.id}">${c.name}</button>`;
        });
    }

    function renderProducts() {
        const filter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
        const search = searchInput?.value.toLowerCase().trim() || '';
        const filtered = filter === 'all' ? products : products.filter(p => p.category === filter);
        const final = search ? filtered.filter(p => p.name.toLowerCase().includes(search)) : filtered;

        if (shopProductsContainer) {
            shopProductsContainer.innerHTML = '';
            const grouped = final.reduce((acc, p) => { (acc[p.category] = acc[p.category] || []).push(p); return acc; }, {});
            
            allCategories.forEach(cat => {
                if (grouped[cat.id]) {
                    let html = `<div class="category-group reveal active"><h2 class="category-group-title">${cat.name}</h2><div class="shop-products">`;
                    html += grouped[cat.id].map(p => `
                        <div class="product-item">
                            <img src="/${p.image}" class="product-image" onclick="openProductModal('/${p.image}', '${p.name}')">
                            <div class="product-info">
                                <h3 class="product-title" style="font-family:Lora; font-size:1.3rem;">${p.name}</h3>
                                <p style="font-size:0.8rem; color:#666; margin-bottom:15px; flex-grow:1;">${p.description}</p>
                                <div class="product-price">$${p.price.toLocaleString()}</div>
                                <button class="add-to-cart-btn" onclick="addToCart(event, ${p.id})">AGREGAR</button>
                            </div>
                        </div>`).join('');
                    html += `</div></div>`;
                    shopProductsContainer.innerHTML += html;
                }
            });
            initReveal();
        }
    }

    function initReveal() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('active');
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }

    function setupEventListeners() {
        filterContainer?.addEventListener('click', e => {
            if (e.target.classList.contains('filter-btn')) {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                renderProducts();
            }
        });
        searchInput?.addEventListener('input', renderProducts);

        const deliveryRadios = document.querySelectorAll('input[name="metodoEntrega"]');
        deliveryRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isDelivery = e.target.value === 'Envío a Domicilio';
                document.getElementById('deliveryAddressContainer').style.display = isDelivery ? 'block' : 'none';
                if(direccionInput) direccionInput.required = isDelivery;
                if(ciudadInput) ciudadInput.required = isDelivery;
                document.getElementById('deliveryTimeSelect').required = isDelivery;
            });
        });

        document.getElementById('paymentMethodSelect')?.addEventListener('change', e => {
            document.getElementById('transferInfo').style.display = e.target.value === 'transferencia' ? 'block' : 'none';
        });

        document.getElementById('headerCartIcon')?.addEventListener('click', () => cartModal.style.display = 'flex');
        document.querySelector('.close-cart')?.addEventListener('click', () => cartModal.style.display = 'none');
        document.getElementById('checkout')?.addEventListener('click', () => { cartModal.style.display = 'none'; checkoutModal.style.display = 'flex'; renderOrderSummary(); });
        document.querySelector('.close-checkout')?.addEventListener('click', () => checkoutModal.style.display = 'none');
        document.querySelector('.close-checkout-btn')?.addEventListener('click', () => checkoutModal.style.display = 'none');
        document.getElementById('checkoutForm')?.addEventListener('submit', handleCheckout);
    }

    window.addToCart = (event, id) => {
        const p = products.find(prod => prod.id === id);
        const price = (p.promo_price && p.promo_price < p.price) ? p.promo_price : p.price;
        const item = cart.find(i => i.id === id);
        if (item) item.quantity++; else cart.push({...p, price, quantity: 1});
        updateCartDisplay();
        const btn = event.target; btn.textContent = '¡LISTO!'; 
        setTimeout(() => btn.textContent = 'AGREGAR', 1000);
    };

    function updateCartDisplay() {
        const count = cart.reduce((s, i) => s + i.quantity, 0);
        const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        document.getElementById('cartCount').textContent = count;
        document.getElementById('cartTotal').textContent = total.toLocaleString();
        const checkoutBtn = document.getElementById('checkout');
        const minMsg = document.getElementById('minPurchaseMessage');
        if (total < MINIMUM_PURCHASE && cart.length > 0) {
            minMsg.textContent = `Monto mínimo: $${MINIMUM_PURCHASE.toLocaleString()}. Faltan $${(MINIMUM_PURCHASE - total).toLocaleString()}.`;
            checkoutBtn.disabled = true; checkoutBtn.style.opacity = '0.5';
        } else {
            minMsg.textContent = ''; checkoutBtn.disabled = false; checkoutBtn.style.opacity = '1';
        }
        localStorage.setItem('novaPanesCart', JSON.stringify(cart));
        renderCartItems();
    }

    function renderCartItems() {
        const el = document.getElementById('cartItems');
        if (cart.length === 0) { el.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">Vacío</p>'; return; }
        el.innerHTML = cart.map(i => `
            <div class="cart-item-row">
                <img src="${i.image}">
                <div class="cart-item-info"><b>${i.name}</b><span>$${i.price.toLocaleString()} x ${i.quantity}</span></div>
                <button onclick="removeFromCart(${i.id})" style="background:none; border:none; color:#DDD; cursor:pointer; font-size:1.5rem;">&times;</button>
            </div>`).join('');
    }

    window.removeFromCart = (id) => { cart = cart.filter(i => i.id !== id); updateCartDisplay(); };

    function renderOrderSummary() {
        const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        document.getElementById('orderItems').innerHTML = cart.map(i => `<div style="display:flex; justify-content:space-between"><span>${i.name} x${i.quantity}</span><span>$${(i.price*i.quantity).toLocaleString()}</span></div>`).join('');
        document.getElementById('orderTotal').textContent = total.toLocaleString();
    }

    async function handleCheckout(e) {
        e.preventDefault();
        const fData = new FormData(e.target);
        const pMethod = fData.get('metodoPago');
        const customerData = { nombre: fData.get('nombre'), telefono: fData.get('telefono'), email: fData.get('email'), metodoEntrega: fData.get('metodoEntrega'), direccion: fData.get('direccion') || 'Retiro', ciudad: fData.get('ciudad') || '-', horarioEntrega: fData.get('horarioEntrega') || 'N/A' };
        const orderData = { customer: customerData, metodoPago: pMethod, items: cart, total: cart.reduce((s, i) => s + (i.price * i.quantity), 0) };

        if (pMethod === 'mercadopago') {
            const res = await fetch('/create-preference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart.map(i => ({ id: i.id, title: i.name, quantity: i.quantity, unit_price: i.price })), payer: { name: customerData.nombre, email: customerData.email } }) });
            const pref = await res.json();
            window.location.href = pref.init_point;
        } else {
            await fetch('/api/submit-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderData) });
            window.open(`https://wa.me/5491140882236?text=${encodeURIComponent('🍞 PEDIDO NOVA PANES de ' + customerData.nombre + ' por $' + orderData.total.toLocaleString())}`, '_blank');
            cart = []; updateCartDisplay(); checkoutModal.style.display = 'none';
            alert('¡Pedido enviado! Te redirigimos a WhatsApp.');
        }
    }

    function updateCartDisplayFromStorage() { const saved = localStorage.getItem('novaPanesCart'); if (saved) { cart = JSON.parse(saved); updateCartDisplay(); } }

    window.openProductModal = (src, title) => {
        const m = document.createElement('div');
        m.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(5px);";
        m.onclick = () => m.remove();
        m.innerHTML = `<div style="background:white; padding:30px; border-radius:35px; max-width:500px; width:100%; text-align:center;"><img src="${src}" style="width:100%; border-radius:20px;"><h3 style="font-family:Lora; margin-top:20px;">${title}</h3></div>`;
        document.body.appendChild(m);
    };
});