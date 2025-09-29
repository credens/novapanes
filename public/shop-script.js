// ===================================================
//      ARCHIVO shop-script.js (VERSIÓN FINAL)
// ===================================================

let products = [];
let cart = [];

const shopProducts = document.getElementById('shopProducts');
const cartFloating = document.getElementById('cartFloating');
const cartModal = document.getElementById('cartModal');
const checkoutModal = document.getElementById('checkoutModal');
const cartCount = document.getElementById('cartCount');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');

// INICIALIZACIÓN DE MERCADO PAGO SDK
const mp = new MercadoPago('APP_USR-0211d259-056d-496b-b0b4-fe9472a24689', {
    locale: 'es-AR'
});
// ------------------

document.addEventListener('DOMContentLoaded', function() {
    // La ruta 'products.json' es relativa a la carpeta 'public',
    // por lo que el servidor la encontrará correctamente.
    // ***** CAMBIO CLAVE AQUÍ *****
    fetch('products') 
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok. Status: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            products = data;
            renderProducts();
            setupEventListeners();
            updateCartDisplayFromStorage(); // Cargar carrito al iniciar
        })
        .catch(error => {
            console.error('Error al cargar o procesar los productos:', error);
            if(shopProducts) {
                shopProducts.innerHTML = '<p style="text-align: center; color: red;">Error: No se pudieron cargar los productos.</p>';
            }
        });
});

function saveCartToStorage() {
    localStorage.setItem('novaPanesCart', JSON.stringify(cart));
}

function updateCartDisplayFromStorage() {
    const savedCart = localStorage.getItem('novaPanesCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
    updateCartDisplay();
}

function renderProducts(filter = 'all') {
    if (!shopProducts) return;
    shopProducts.innerHTML = '';
    const filteredProducts = filter === 'all' 
        ? products 
        : products.filter(product => product.category === filter);
    
    if (filteredProducts.length === 0 && products.length > 0) {
        shopProducts.innerHTML = '<p style="text-align: center;">No hay productos en esta categoría.</p>';
        return;
    }

    filteredProducts.forEach(product => {
        const productHTML = `
            <div class="product-item" data-category="${product.category}">
                <img src="${product.image}" alt="${product.name}" class="product-image" onclick="openProductModal('${product.image}', '${product.name}')" loading="lazy" decoding="async">
                <div class="product-info">
                    <h3 class="product-title">${product.name}</h3>
                    <p class="product-description">${product.description}</p>
                    <div class="product-price">$${product.price.toLocaleString()}</div>
                    <div class="product-actions">
                        <div class="quantity-controls">
                            <button class="qty-btn" onclick="changeQuantity(${product.id}, -1)">-</button>
                            <input type="number" class="qty-input" id="qty-${product.id}" value="1" min="1" max="${product.stock}">
                            <button class="qty-btn" onclick="changeQuantity(${product.id}, 1)">+</button>
                        </div>
                        <button class="add-to-cart-btn" onclick="addToCart(event, ${product.id})">
                            Agregar al Carrito
                        </button>
                    </div>
                </div>
            </div>
        `;
        shopProducts.innerHTML += productHTML;
    });
}

function setupEventListeners() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderProducts(this.dataset.filter);
        });
    });
    if (cartFloating) cartFloating.addEventListener('click', openCartModal);
    const closeCartBtn = document.querySelector('.close-cart');
    if (closeCartBtn) closeCartBtn.addEventListener('click', closeCartModal);
    const closeCheckoutBtn = document.querySelector('.close-checkout');
    if(closeCheckoutBtn) closeCheckoutBtn.addEventListener('click', closeCheckout);
    const clearCartBtn = document.getElementById('clearCart');
    if(clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
    const checkoutBtn = document.getElementById('checkout');
    if(checkoutBtn) checkoutBtn.addEventListener('click', openCheckout);
    const checkoutForm = document.getElementById('checkoutForm');
    if(checkoutForm) checkoutForm.addEventListener('submit', handleCheckout);
    if (cartModal) cartModal.addEventListener('click', e => { if (e.target === cartModal) closeCartModal(); });
    if (checkoutModal) checkoutModal.addEventListener('click', e => { if (e.target === checkoutModal) closeCheckout(); });
}

function changeQuantity(productId, change) {
    const qtyInput = document.getElementById(`qty-${productId}`);
    if (!qtyInput) return;
    let newValue = parseInt(qtyInput.value) + change;
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if (newValue < 1) newValue = 1;
    if (newValue > product.stock) newValue = product.stock;
    qtyInput.value = newValue;
}

function addToCart(event, productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const quantityInput = document.getElementById(`qty-${productId}`);
    if (!quantityInput) return;
    const quantity = parseInt(quantityInput.value);
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        if (existingItem.quantity + quantity <= product.stock) {
            existingItem.quantity += quantity;
        } else {
            alert(`Solo quedan ${product.stock} unidades disponibles`);
            return;
        }
    } else {
        if (quantity > product.stock) {
            alert(`Solo quedan ${product.stock} unidades disponibles`);
            return;
        }
        cart.push({ ...product, quantity: quantity });
    }
    updateCartDisplay();
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '¡Agregado!';
    btn.style.background = '#4CAF50';
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '#B5651D';
    }, 1000);
}

function updateCartDisplay() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (cartCount) cartCount.textContent = totalItems;
    if (cartTotal) cartTotal.textContent = totalPrice.toLocaleString();
    if (cartFloating) {
        cartFloating.style.display = totalItems > 0 ? 'block' : 'none';
    }
    saveCartToStorage();
    renderCartItems();
}

function renderCartItems() {
    if (!cartItems) return;
    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-cart-message">Tu carrito está vacío</div>';
        return;
    }
    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.name}" class="cart-item-image">
            <div class="cart-item-info">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-price">$${item.price.toLocaleString()}</div>
            </div>
            <div class="cart-item-quantity">
                <button class="cart-qty-btn" onclick="updateCartItemQuantity(${item.id}, ${item.quantity - 1})">-</button>
                <span class="cart-qty-display">${item.quantity}</span>
                <button class="cart-qty-btn" onclick="updateCartItemQuantity(${item.id}, ${item.quantity + 1})">+</button>
            </div>
            <button class="remove-item" onclick="removeFromCart(${item.id})">×</button>
        </div>
    `).join('');
}

function updateCartItemQuantity(productId, newQuantity) {
    const product = products.find(p => p.id === productId);
    const cartItem = cart.find(item => item.id === productId);
    if (!product || !cartItem) return;
    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }
    if (newQuantity > product.stock) {
        alert(`Solo quedan ${product.stock} unidades disponibles`);
        return;
    }
    cartItem.quantity = newQuantity;
    updateCartDisplay();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartDisplay();
}

function clearCart() {
    if (confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
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

function openCheckout() {
    if (cart.length === 0) {
        alert('Tu carrito está vacío');
        return;
    }
    closeCartModal();
    if (checkoutModal) {
        checkoutModal.style.display = 'block';
        renderOrderSummary();
    }
}

function closeCheckout() {
    if (checkoutModal) checkoutModal.style.display = 'none';
}

function renderOrderSummary() {
    const orderItems = document.getElementById('orderItems');
    const orderTotal = document.getElementById('orderTotal');
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (orderItems) {
        orderItems.innerHTML = cart.map(item => `
            <div class="order-item">
                <span>${item.name} x ${item.quantity}</span>
                <span>$${(item.price * item.quantity).toLocaleString()}</span>
            </div>
        `).join('');
    }
    if (orderTotal) orderTotal.textContent = totalPrice.toLocaleString();
}

async function handleCheckout(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const metodoPago = formData.get('metodoPago');
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = 'Procesando...';
    submitButton.disabled = true;

    if (metodoPago === 'mercadopago') {
        try {
            const orderData = {
                items: cart.map(item => ({
                    id: item.id,
                    title: item.name,
                    quantity: item.quantity,
                    unit_price: item.price
                })),
                payer: {
                    name: formData.get('nombre'),
                    email: formData.get('email'),
                    phone: { number: formData.get('telefono') }
                }
            };
            const response = await fetch('/create-preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'No se pudo generar el link de pago.');
            }
            const preference = await response.json();
            window.location.href = preference.init_point;
            // No reseteamos el botón aquí, ya que la página redirigirá
        } catch (error) {
            console.error('Error al procesar el pago con Mercado Pago:', error);
            alert(`Error: ${error.message}`);
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
        }
    } else {
        const orderData = {
            customer: { nombre: formData.get('nombre'), email: formData.get('email'), telefono: formData.get('telefono'), direccion: formData.get('direccion'), ciudad: formData.get('ciudad'), codigoPostal: formData.get('codigoPostal'), referencias: formData.get('referencias') },
            metodoPago: metodoPago,
            items: cart,
            total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        };
        const whatsappMessage = createWhatsAppMessage(orderData);
        const whatsappUrl = `https://wa.me/5491164372200?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(whatsappUrl, '_blank');
        cart = [];
        updateCartDisplay();
        closeCheckout();
        alert('¡Pedido enviado! Te hemos redirigido a WhatsApp para que completes el envío.');
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
    }
}

function createWhatsAppMessage(orderData) {
    let message = `🍞 *NUEVO PEDIDO - NOVA PANES* 🍞\n\n`;
    message += `👤 *Cliente:* ${orderData.customer.nombre}\n`;
    message += `📧 *Email:* ${orderData.customer.email}\n`;
    message += `📱 *Teléfono:* ${orderData.customer.telefono}\n`;
    message += `📍 *Dirección:* ${orderData.customer.direccion}, ${orderData.customer.ciudad}\n`;
    if (orderData.customer.codigoPostal) message += `📮 *CP:* ${orderData.customer.codigoPostal}\n`;
    if (orderData.customer.referencias) message += `📝 *Referencias:* ${orderData.customer.referencias}\n`;
    message += `\n💳 *Método de pago:* ${orderData.metodoPago}\n\n`;
    message += `🛒 *PRODUCTOS:*\n`;
    orderData.items.forEach(item => {
        message += `• ${item.name} x${item.quantity} - $${(item.price * item.quantity).toLocaleString()}\n`;
    });
    message += `\n💰 *TOTAL: $${orderData.total.toLocaleString()}*`;
    return message;
}

function openProductModal(imageSrc, title) {
    const existingModal = document.getElementById('imageModal');
    if (existingModal) {
        const modalImage = document.getElementById('modalImage');
        const modalTitle = document.getElementById('modalTitle');
        const modalNav = document.getElementById('modalNav');
        if (modalImage) modalImage.src = imageSrc;
        if (modalTitle) modalTitle.textContent = title;
        if (modalNav) modalNav.style.display = 'none';
        existingModal.style.display = 'block';
    } else {
        const modal = document.createElement('div');
        modal.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;" onclick="this.remove()"><div style="max-width:90%;max-height:90%;background:white;border-radius:12px;overflow:hidden;animation:modalAppear .3s;" onclick="event.stopPropagation()"><img src="${imageSrc}" style="width:100%;height:auto;display:block;"><div style="padding:20px;text-align:center;font-family:'Lora',serif;font-size:1.2rem;">${title}</div></div></div>`;
        document.body.appendChild(modal);
    }
}