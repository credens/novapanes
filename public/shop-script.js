document.addEventListener('DOMContentLoaded', function() {
    let products = [];
    let allCategories = [];
    let cart = [];
    const MINIMUM_PURCHASE = 15000;

    const shopProductsContainer = document.getElementById('shopProducts');
    const filterContainer = document.getElementById('filter-container');
    const searchInput = document.getElementById('searchInput');
    const logoScroller = document.getElementById('logo-scroller');
    
    // CARGA DE DATOS (Usando /products que confirmaste que funciona)
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
        if (!logoScroller) return;
        const content = [...logos, ...logos, ...logos];
        logoScroller.innerHTML = content.map(l => `<img src="/logos/${l}" alt="Marca">`).join('');
    }

    function renderCategoryFilters() {
        if (!filterContainer) return;
        filterContainer.innerHTML = '<button class="filter-btn active" data-filter="all" style="margin:5px; padding:10px 20px; border-radius:20px; border:1px solid #DDD; cursor:pointer;">Todos</button>';
        allCategories.forEach(c => {
            filterContainer.innerHTML += `<button class="filter-btn" data-filter="${c.id}" style="margin:5px; padding:10px 20px; border-radius:20px; border:1px solid #DDD; cursor:pointer;">${c.name}</button>`;
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
                    let html = `<div class="category-group reveal"><h2 class="category-group-title" style="font-family:Lora; margin:40px 0 20px; font-size:2rem;">${cat.name}</h2><div class="shop-products">`;
                    html += grouped[cat.id].map(p => `
                        <div class="product-item">
                            <img src="/${p.image}" class="product-image" onclick="openProductModal('/${p.image}', '${p.name}')">
                            <div class="product-info">
                                <h3 class="product-title">${p.name}</h3>
                                <p style="font-size:0.85rem; color:#666;">${p.description}</p>
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

    // --- LOGICA DE CHECKOUT (Mantenida intacta para que no falle) ---
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
                document.querySelector('input[name="direccion"]').required = isDelivery;
                document.querySelector('input[name="ciudad"]').required = isDelivery;
                document.getElementById('deliveryTimeSelect').required = isDelivery;
            });
        });

        document.getElementById('paymentMethodSelect')?.addEventListener('change', e => {
            document.getElementById('transferInfo').style.display = e.target.value === 'transferencia' ? 'block' : 'none';
        });

        document.getElementById('headerCartIcon')?.addEventListener('click', () => document.getElementById('cartModal').style.display = 'block');
        document.querySelector('.close-cart')?.addEventListener('click', () => document.getElementById('cartModal').style.display = 'none');
        document.getElementById('checkout')?.addEventListener('click', () => {
            document.getElementById('cartModal').style.display = 'none';
            document.getElementById('checkoutModal').style.display = 'block';
            renderOrderSummary();
        });
        document.querySelector('.close-checkout')?.addEventListener('click', () => document.getElementById('checkoutModal').style.display = 'none');
        document.querySelector('.close-checkout-btn')?.addEventListener('click', () => document.getElementById('checkoutModal').style.display = 'none');
        document.getElementById('checkoutForm')?.addEventListener('submit', handleCheckout);
    }

    // El resto de funciones (addToCart, updateCartDisplay, handleCheckout) se mantienen igual que en tu versión funcional
    window.addToCart = (event, id) => {
        const p = products.find(prod => prod.id === id);
        const item = cart.find(i => i.id === id);
        if (item) item.quantity++; else cart.push({...p, quantity: 1});
        const btn = event.target; btn.textContent = '¡LISTO!'; 
        setTimeout(() => btn.textContent = 'AGREGAR', 1000);
        updateCart();
    };

    function updateCart() {
        document.getElementById('cartCount').textContent = cart.reduce((s, i) => s + i.quantity, 0);
        document.getElementById('cartTotal').textContent = cart.reduce((s, i) => s + (i.price * i.quantity), 0).toLocaleString();
        localStorage.setItem('novaPanesCart', JSON.stringify(cart));
    }

    async function handleCheckout(e) {
        e.preventDefault();
        const fData = new FormData(e.target);
        const pMethod = fData.get('metodoPago');
        const customerData = {
            nombre: fData.get('nombre'), telefono: fData.get('telefono'), 
            metodoEntrega: fData.get('metodoEntrega'), direccion: fData.get('direccion') || 'Retiro'
        };
        const orderData = { customer: customerData, metodoPago: pMethod, items: cart, total: cart.reduce((s, i) => s + (i.price * i.quantity), 0) };

        if (pMethod === 'mercadopago') {
            const res = await fetch('/create-preference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart.map(i => ({ id: i.id, title: i.name, quantity: i.quantity, unit_price: i.price })), payer: { name: customerData.nombre } }) });
            const pref = await res.json();
            window.location.href = pref.init_point;
        } else {
            await fetch('/api/submit-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderData) });
            const wMsg = `🍞 *NUEVO PEDIDO*\nCliente: ${customerData.nombre}\nTotal: $${orderData.total.toLocaleString()}`;
            window.open(`https://wa.me/5491164372200?text=${encodeURIComponent(wMsg)}`, '_blank');
            cart = []; updateCart(); location.reload();
        }
    }

    function renderOrderSummary() {
        const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        document.getElementById('orderItems').innerHTML = cart.map(i => `<div style="display:flex; justify-content:space-between"><span>${i.name} x${i.quantity}</span><span>$${(i.price*i.quantity).toLocaleString()}</span></div>`).join('');
        document.getElementById('orderTotal').textContent = total.toLocaleString();
    }

    function updateCartDisplayFromStorage() { const saved = localStorage.getItem('novaPanesCart'); if (saved) { cart = JSON.parse(saved); updateCart(); } }

    window.openProductModal = (src, title) => {
        const m = document.createElement('div');
        m.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;";
        m.onclick = () => m.remove();
        m.innerHTML = `<div style="background:white; padding:30px; border-radius:20px; max-width:500px; width:100%; text-align:center;"><img src="${src}" style="width:100%; border-radius:10px;"><h3 style="font-family:Lora; margin-top:20px;">${title}</h3></div>`;
        document.body.appendChild(m);
    };
});