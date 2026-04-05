// ===================================================
//      ARCHIVO shop-script.js (LÓGICA + ANIMACIONES)
// ===================================================

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
    
    // Carga de Datos
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
        initScrollReveal(); // Iniciar animaciones de scroll
    }).catch(err => console.error(err));

    function renderLogoScroller(logos) {
        if (!logoScroller || !Array.isArray(logos)) return;
        const content = [...logos, ...logos, ...logos];
        logoScroller.innerHTML = content.map(l => `<img src="/logos/${l}" alt="Logo">`).join('');
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
                    let html = `<div class="category-group reveal"><h2 class="category-group-title">${cat.name}</h2><div class="shop-products">`;
                    html += grouped[cat.id].map(p => `
                        <div class="product-item">
                            <div class="product-image-container">
                                <img src="/${p.image}" class="product-image" onclick="openProductModal('/${p.image}', '${p.name}')">
                            </div>
                            <div class="product-info">
                                <h3 class="product-title">${p.name}</h3>
                                <p class="product-description">${p.description}</p>
                                <div class="product-price">$${p.price.toLocaleString()}</div>
                                <button class="add-to-cart-btn" onclick="addToCart(event, ${p.id})">AGREGAR</button>
                            </div>
                        </div>`).join('');
                    html += `</div></div>`;
                    shopProductsContainer.innerHTML += html;
                }
            });
            initScrollReveal(); // Re-vincular animaciones a los nuevos productos
        }
    }

    // --- EFECTO SCROLL REVEAL (Eternal Empire style) ---
    function initScrollReveal() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }

    // --- LOGICA DE CARRITO (Igual a la funcional) ---
    window.addToCart = (event, id) => {
        const p = products.find(prod => prod.id === id);
        const item = cart.find(i => i.id === id);
        if (item) item.quantity++; else cart.push({...p, quantity: 1});
        const btn = event.target;
        btn.textContent = '¡LISTO!'; btn.style.background = '#4CAF50';
        setTimeout(() => { btn.textContent = 'AGREGAR'; btn.style.background = '#FFB300'; }, 1000);
        updateCart();
    };

    function updateCart() {
        const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        document.getElementById('cartCount').textContent = cart.reduce((s, i) => s + i.quantity, 0);
        localStorage.setItem('novaPanesCart', JSON.stringify(cart));
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
        document.getElementById('headerCartIcon')?.addEventListener('click', () => cartModal.style.display = 'block');
        document.querySelector('.close-cart')?.addEventListener('click', () => cartModal.style.display = 'none');
    }
    
    // Al cargar, recuperar carrito
    const saved = localStorage.getItem('novaPanesCart');
    if (saved) { cart = JSON.parse(saved); updateCart(); }
});