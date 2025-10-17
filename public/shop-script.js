// ===================================================
//      ARCHIVO shop-script.js (CORREGIDO Y COMPLETO)
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
    const viewGroupedBtn = document.getElementById('view-grouped');
    const viewListBtn = document.getElementById('view-list');
    const logoScroller = document.getElementById('logo-scroller');
    const cartModal = document.getElementById('cartModal');
    const checkoutModal = document.getElementById('checkoutModal');
    const promoModal = document.getElementById('promoModal');
    const promoModalOverlay = document.querySelector('.promo-modal-overlay');
    const closePromoModalBtn = document.getElementById('closePromoModal');
    const promoLink = document.getElementById('promoLink');
    const promoImage = document.getElementById('promoImage');
    const deliveryAddressContainer = document.getElementById('deliveryAddressContainer');
    const deliveryTimeSelect = document.getElementById('deliveryTimeSelect');
    const deliveryMethodRadios = document.querySelectorAll('input[name="metodoEntrega"]');
    const paymentMethodSelect = document.getElementById('paymentMethodSelect');
    const transferInfo = document.getElementById('transferInfo');
    const headerCartIcon = document.getElementById('headerCartIcon');

    Promise.all([
        fetch('/products.json').then(res => res.json()),
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
        handlePromoModal();
    }).catch(error => {
        console.error('Error fatal al cargar los datos iniciales:', error);
        if (shopProductsContainer) shopProductsContainer.innerHTML = '<p style="text-align: center; color: red; padding: 40px;">Error: No se pudieron cargar los datos de la tienda.</p>';
    });

    function handlePromoModal() {
        if (sessionStorage.getItem('promoShown')) {
            return;
        }
        const comboCategoryID = 'combos';
        const comboProducts = products.filter(p => p.category === comboCategoryID);
        if (comboProducts.length > 0 && promoModal) {
            const randomIndex = Math.floor(Math.random() * comboProducts.length);
            const promoProduct = comboProducts[randomIndex];
            promoImage.src = promoProduct.image;
            promoImage.alt = `Oferta: ${promoProduct.name}`;
            promoLink.href = `#product-${promoProduct.id}`;
            promoModal.style.display = 'flex';
            sessionStorage.setItem('promoShown', 'true');
        }
    }

    function closePromoModal() {
        if (promoModal) promoModal.style.display = 'none';
    }

    function renderLogoScroller(logos) {
        if (!logoScroller) return;
        const logosToRender = [...logos, ...logos];
        logoScroller.innerHTML = logosToRender.map(logoFilename => `<img src="/logos/${logoFilename}" alt="Logo de marca">`).join('');
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
        const searchTerm = searchInput.value;
        const filteredByCategory = categoryFilter === 'all' ? products : products.filter(p => p.category === categoryFilter);
        const searchTermLower = searchTerm.toLowerCase().trim();
        const finalProducts = searchTermLower ? filteredByCategory.filter(p => p.name.toLowerCase().includes(searchTermLower)) : filteredByCategory;

        shopProductsContainer.innerHTML = '';

        if (finalProducts.length === 0) {
            shopProductsContainer.innerHTML = '<p style="text-align: center; padding: 40px 0;">No se encontraron productos con esos criterios.</p>';
            return;
        }

        if (currentView === 'grouped') {
            renderGroupedView(finalProducts);
        } else {
            renderListView(finalProducts);
        }
    }

    function renderGroupedView(productsToRender) {
        const productsByCategory = productsToRender.reduce((acc, product) => {
            (acc[product.category] = acc[product.category] || []).push(product);
            return acc;
        }, {});

        const comboCategoryID = 'combos';
        const comboCategory = allCategories.find(c => c.id === comboCategoryID);
        const otherCategories = allCategories.filter(c => c.id !== comboCategoryID).sort((a, b) => a.name.localeCompare(b.name));
        const sortedCategories = comboCategory ? [comboCategory, ...otherCategories] : otherCategories;

        sortedCategories.forEach(category => {
            const categoryId = category.id;
            if (productsByCategory[categoryId]) {
                const categoryProducts = productsByCategory[categoryId];
                let productsHTML = '';
                categoryProducts.forEach(product => {
                    productsHTML += generateProductCardHTML(product);
                });

                shopProductsContainer.innerHTML += `
                    <div class="category-group">
                        <h2 class="category-group-title">${category.name}</h2>
                        <div class="shop-products">
                            ${productsHTML}
                        </div>
                    </div>
                `;
            }
        });
    }

    function renderListView(productsToRender) {
        productsToRender.sort((a, b) => {
            const categoryNameA = allCategories.find(c => c.id === a.category)?.name || 'ZZZ';
            const categoryNameB = allCategories.find(c => c.id === b.category)?.name || 'ZZZ';
            const categoryComparison = categoryNameA.localeCompare(categoryNameB);
            if (categoryComparison !== 0) return categoryComparison;
            return a.name.localeCompare(b.name);
        });

        let productsHTML = '';
        productsToRender.forEach(product => {
            productsHTML += generateProductCardHTML(product);
        });

        shopProductsContainer.innerHTML = `<div class="shop-products">${productsHTML}</div>`;
    }

    function generateProductCardHTML(product) {
        const isOnSale = product.promo_price && product.promo_price < product.price;
        const currentPrice = isOnSale ? product.promo_price : product.price;
        const priceHTML = isOnSale ? `<div class="product-price sale">$${currentPrice.toLocaleString()} <span class="original-price">$${product.price.toLocaleString()}</span></div>` : `<div class="product-price">$${currentPrice.toLocaleString()}</div>`;
        const imageUrl = product.image;
        const safeProductName = product.name.replace(/"/g, '&quot;');

        return `
            <div id="product-${product.id}" class="product-item ${isOnSale ? 'on-sale' : ''}" data-category="${product.category}">
                ${isOnSale ? '<div class="sale-badge">OFERTA</div>' : ''}
                <img src="/${imageUrl}" alt="${safeProductName}" class="product-image" onclick="openProductModal('/${imageUrl}', '${safeProductName}')" loading="lazy">
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
                        <button class="add-to-cart-btn" onclick="addToCart(event, ${product.id})">Agregar</button>
                    </div>
                </div>
            </div>`;
    }

    function setupEventListeners() {
        viewGroupedBtn.addEventListener('click', () => {
            if (currentView !== 'grouped') {
                currentView = 'grouped';
                viewGroupedBtn.classList.add('active');
                viewListBtn.classList.remove('active');
                renderProducts();
            }
        });
        viewListBtn.addEventListener('click', () => {
            if (currentView !== 'list') {
                currentView = 'list';
                viewListBtn.classList.add('active');
                viewGroupedBtn.classList.remove('active');
                renderProducts();
            }
        });
        document.querySelector('.shop-filters').addEventListener('click', function(e) {
            if (e.target.classList.contains('filter-btn')) {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                renderProducts();
            }
        });
        searchInput.addEventListener('input', () => {
            renderProducts();
        });
        deliveryMethodRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'Envío a Domicilio') {
                    deliveryAddressContainer.style.display = 'block';
                    deliveryTimeSelect.required = true;
                } else {
                    deliveryAddressContainer.style.display = 'none';
                    deliveryTimeSelect.required = false;
                    deliveryTimeSelect.value = '';
                }
            });
        });
        paymentMethodSelect.addEventListener('change', (e) => {
            if (e.target.value === 'transferencia') {
                transferInfo.style.display = 'block';
            } else {
                transferInfo.style.display = 'none';
            }
        });
        if (promoModal) {
            closePromoModalBtn.addEventListener('click', closePromoModal);
            promoModalOverlay.addEventListener('click', closePromoModal);
            promoLink.addEventListener('click', (e) => {
                e.preventDefault();
                closePromoModal();
                const targetId = promoLink.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                    targetElement.classList.add('highlight');
                    setTimeout(() => {
                        targetElement.classList.remove('highlight');
                    }, 3000);
                }
            });
        }

        headerCartIcon?.addEventListener('click', openCartModal);

        document.querySelector('.close-cart')?.addEventListener('click', closeCartModal);
        document.querySelector('.close-checkout')?.addEventListener('click', closeCheckout);
        document.querySelector('.close-checkout-btn')?.addEventListener('click', closeCheckout); // Listener para el botón "Cancelar"
        document.getElementById('clearCart')?.addEventListener('click', clearCart);
        document.getElementById('checkout')?.addEventListener('click', openCheckout);
        document.getElementById('checkoutForm')?.addEventListener('submit', handleCheckout);
        cartModal?.addEventListener('click', e => {
            if (e.target === cartModal) closeCartModal();
        });
        checkoutModal?.addEventListener('click', e => {
            if (e.target === checkoutModal) closeCheckout();
        });
    }

    function updateCartDisplay() {
        const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
        const totalPrice = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        const cartCount = document.getElementById('cartCount');
        if (cartCount) cartCount.textContent = totalItems;
        const cartTotal = document.getElementById('cartTotal');
        if (cartTotal) cartTotal.textContent = totalPrice.toLocaleString();

        const checkoutBtn = document.getElementById('checkout');
        const minPurchaseMessage = document.getElementById('minPurchaseMessage');
        if (totalPrice < MINIMUM_PURCHASE && cart.length > 0) {
            const amountNeeded = MINIMUM_PURCHASE - totalPrice;
            minPurchaseMessage.textContent = `Monto mínimo de compra: $${MINIMUM_PURCHASE.toLocaleString()}. Te faltan $${amountNeeded.toLocaleString()}.`;
            minPurchaseMessage.style.display = 'block';
            checkoutBtn.disabled = true;
        } else {
            minPurchaseMessage.style.display = 'none';
            checkoutBtn.disabled = false;
        }
        localStorage.setItem('novaPanesCart', JSON.stringify(cart));
        renderCartItems();
    }

    function openCheckout() {
        const totalPrice = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        if (cart.length === 0) return alert('Tu carrito está vacío.');
        if (totalPrice < MINIMUM_PURCHASE) {
            const amountNeeded = MINIMUM_PURCHASE - totalPrice;
            return alert(`El monto mínimo de compra es de $${MINIMUM_PURCHASE.toLocaleString()}. Te faltan $${amountNeeded.toLocaleString()} para continuar.`);
        }
        closeCartModal();
        if (checkoutModal) {
            checkoutModal.style.display = 'block';
            renderOrderSummary();
        }
    }
    window.changeQuantity = (id, change) => {
        const input = document.getElementById(`qty-${id}`);
        if (!input) return;
        let val = parseInt(input.value) + change;
        const p = products.find(prod => prod.id === id);
        if (!p) return;
        if (val < 1) val = 1;
        if (val > p.stock) val = p.stock;
        input.value = val;
    };
    window.addToCart = (event, id) => {
        const p = products.find(prod => prod.id === id);
        if (!p) return;
        const q = parseInt(document.getElementById(`qty-${id}`).value);
        const priceToUse = (p.promo_price && p.promo_price < p.price) ? p.promo_price : p.price;
        const itemInCart = cart.find(i => i.id === id);
        if (itemInCart) {
            if (itemInCart.quantity + q <= p.stock) itemInCart.quantity += q;
            else return alert(`Stock insuficiente.`);
        } else {
            if (q > p.stock) return alert(`Stock insuficiente.`);
            cart.push({
                ...p,
                price: priceToUse,
                quantity: q
            });
        }
        updateCartDisplay();
        const btn = event.target;
        btn.textContent = '¡Agregado!';
        btn.style.background = '#4CAF50';
        setTimeout(() => {
            btn.textContent = 'Agregar';
            btn.style.background = '#B5651D';
        }, 1000);
    };
    window.updateCartItemQuantity = (id, newQ) => {
        const item = cart.find(i => i.id === id);
        if (!item) return;
        if (newQ <= 0) {
            removeFromCart(id);
            return;
        }
        const p = products.find(prod => prod.id === id);
        if (newQ > p.stock) return alert(`Stock insuficiente`);
        item.quantity = newQ;
        updateCartDisplay();
    };
    window.removeFromCart = (id) => {
        cart = cart.filter(i => i.id !== id);
        updateCartDisplay();
    };

    window.openProductModal = (src, title) => {
        const m = document.createElement('div');
        m.innerHTML = `
            <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;" onclick="this.remove()">
                <div style="max-width:90%;max-height:90%;background:white;border-radius:12px;overflow:hidden;animation:modalAppear .3s;" onclick="event.stopPropagation()">
                    <img src="${src}" alt="${title}" style="width:100%;height:auto;display:block;max-height:80vh;object-fit:contain;">
                    <div style="padding:20px;text-align:center;font-family:'Lora',serif;font-size:1.2rem;">${title}</div>
                </div>
            </div>`;
        document.body.appendChild(m);
    };

    function renderCartItems() {
        const cItemsEl = document.getElementById('cartItems');
        if (!cItemsEl) return;
        if (cart.length === 0) {
            cItemsEl.innerHTML = '<div class="empty-cart-message">Tu carrito está vacío</div>';
            return;
        }
        cItemsEl.innerHTML = cart.map(item => `<div class="cart-item"><img src="${item.image}" alt="${item.name}" class="cart-item-image"><div class="cart-item-info"><div class="cart-item-title">${item.name}</div><div class="cart-item-price">$${item.price.toLocaleString()}</div></div><div class="cart-item-quantity"><button class="cart-qty-btn" onclick="updateCartItemQuantity(${item.id}, ${item.quantity - 1})">-</button><span class="cart-qty-display">${item.quantity}</span><button class="cart-qty-btn" onclick="updateCartItemQuantity(${item.id}, ${item.quantity + 1})">+</button></div><button class="remove-item" onclick="removeFromCart(${item.id})">×</button></div>`).join('');
    }

    function clearCart() {
        if (confirm('¿Vaciar el carrito?')) {
            cart = [];
            updateCartDisplay();
        }
    }

    function openCartModal() {
        if (cartModal) {
            cartModal.style.display = 'block';
            renderCartItems();
        }
    }

    function closeCartModal() {
        if (cartModal) cartModal.style.display = 'none';
    }

    function closeCheckout() {
        if (checkoutModal) checkoutModal.style.display = 'none';
    }

    function renderOrderSummary() {
        const oItems = document.getElementById('orderItems');
        const oTotal = document.getElementById('orderTotal');
        const tPrice = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        if (oItems) oItems.innerHTML = cart.map(i => `<div class="order-item"><span>${i.name} x ${i.quantity}</span><span>$${(i.price * i.quantity).toLocaleString()}</span></div>`).join('');
        if (oTotal) oTotal.textContent = tPrice.toLocaleString();
    }

    function updateCartDisplayFromStorage() {
        const savedCart = localStorage.getItem('novaPanesCart');
        if (savedCart) {
            cart = JSON.parse(savedCart);
        }
        updateCartDisplay();
    }

    async function handleCheckout(e) {
        e.preventDefault();
        const form = e.target;
        const fData = new FormData(form);
        const pMethod = fData.get('metodoPago');
        const btn = form.querySelector('button[type="submit"]');
        btn.textContent = 'Procesando...';
        btn.disabled = true;

        const deliveryMethod = fData.get('metodoEntrega');

        const customerData = {
            nombre: fData.get('nombre'),
            email: fData.get('email'),
            telefono: fData.get('telefono'),
            metodoEntrega: deliveryMethod,
            ...(deliveryMethod === 'Envío a Domicilio' && {
                direccion: fData.get('direccion'),
                ciudad: fData.get('ciudad'),
                codigoPostal: fData.get('codigoPostal'),
                referencias: fData.get('referencias'),
                horarioEntrega: fData.get('horarioEntrega')
            })
        };

        // Objeto de la orden que se guardará en el sistema
        const orderDataForServer = {
            customer: customerData,
            metodoPago: pMethod,
            items: cart,
            total: cart.reduce((s, i) => s + (i.price * i.quantity), 0)
        };

        if (pMethod === 'mercadopago') {
            try {
                // 1. PRIMERO, GUARDAMOS EL PEDIDO EN NUESTRO SISTEMA CON ESTADO PENDIENTE
                const saveOrderResponse = await fetch('/api/submit-order', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(orderDataForServer),
                });

                if (!saveOrderResponse.ok) {
                    // Si falla al guardar, no continuamos al pago.
                    throw new Error('No se pudo registrar el pedido antes de proceder al pago.');
                }

                // 2. LUEGO, CREAMOS LA PREFERENCIA DE PAGO EN MERCADO PAGO
                const oDataMP = {
                    items: cart.map(i => ({
                        id: i.id,
                        title: i.name,
                        quantity: i.quantity,
                        unit_price: i.price
                    })),
                    payer: {
                        name: customerData.nombre,
                        email: customerData.email,
                        phone: {
                            number: customerData.telefono
                        }
                    }
                };

                const res = await fetch('/create-preference', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(oDataMP),
                });

                if (!res.ok) {
                    throw new Error((await res.json()).message || 'Error al generar link de pago.');
                }

                const pref = await res.json();

                // 3. FINALMENTE, REDIRIGIMOS AL USUARIO PARA QUE PAGUE
                // Limpiamos el carrito del localStorage antes de redirigir
                cart = [];
                updateCartDisplay();
                window.location.href = pref.init_point;

            } catch (err) {
                alert(`Error: ${err.message}`);
                btn.textContent = 'Confirmar Pedido';
                btn.disabled = false;
            }
        } else {
            // Flujo para Efectivo o Transferencia (ya funciona bien)
            try {
                // Enviamos el pedido al backend para guardarlo y enviar el email
                await fetch('/api/submit-order', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(orderDataForServer),
                });

                // Creamos el mensaje para WhatsApp
                let deliveryInfo = `🚚 *Método de Entrega:* ${customerData.metodoEntrega}`;
                if (customerData.metodoEntrega === 'Envío a Domicilio') {
                    deliveryInfo += `\n📍 *Dirección:* ${customerData.direccion}, ${customerData.ciudad}\n⏰ *Horario:* ${customerData.horarioEntrega}`;
                }
                const wMsg = `🍞 *NUEVO PEDIDO - NOVA PANES* 🍞\n\n👤 *Cliente:* ${customerData.nombre}\n📧 *Email:* ${customerData.email}\n📱 *Teléfono:* ${customerData.telefono}\n\n${deliveryInfo}\n\n💳 *Método de pago:* ${pMethod}\n\n🛒 *PRODUCTOS:*\n${orderDataForServer.items.map(item => `• ${item.name} x${item.quantity} - $${(item.price * item.quantity).toLocaleString()}`).join('\n')}\n\n💰 *TOTAL: $${orderDataForServer.total.toLocaleString()}*`;

                window.open(`https://wa.me/5491164372200?text=${encodeURIComponent(wMsg)}`, '_blank');

                alert('¡Pedido enviado! Te hemos redirigido a WhatsApp para confirmar.');
                cart = [];
                updateCartDisplay();
                closeCheckout();

            } catch (err) {
                console.error('Error al enviar el pedido:', err);
                alert('Hubo un error al procesar tu pedido. Por favor, intenta de nuevo.');
            } finally {
                btn.textContent = 'Confirmar Pedido';
                btn.disabled = false;
            }
        }
    }

    // CÓDIGO PARA MANEJAR EL REGRESO DE MERCADO PAGO
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
        alert('¡Tu pago fue aprobado! Gracias por tu compra.');
        // Limpia los parámetros de la URL para no mostrar el mensaje de nuevo si se recarga la página
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('payment') === 'failure') {
        alert('Hubo un problema con tu pago. Por favor, intenta de nuevo o elige otro método.');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});