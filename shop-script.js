// Variable global para almacenar los productos que se cargarán desde el JSON
let products = [];

// Estado del carrito
let cart = [];

// Elementos del DOM
const shopProducts = document.getElementById('shopProducts');
const cartFloating = document.getElementById('cartFloating');
const cartModal = document.getElementById('cartModal');
const checkoutModal = document.getElementById('checkoutModal');
const cartCount = document.getElementById('cartCount');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');

// Inicializar la tienda
document.addEventListener('DOMContentLoaded', function() {
    // Usamos fetch para cargar los datos de los productos desde el archivo JSON
    fetch('products.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json(); // Convertimos la respuesta a formato JSON
        })
        .then(data => {
            products = data; // Guardamos los datos en nuestra variable global
            
            // --- ¡MUY IMPORTANTE! ---
            // Ahora que ya tenemos los productos, llamamos a las funciones de inicialización
            renderProducts();
            setupEventListeners();
            updateCartDisplay();
        })
        .catch(error => {
            // Manejar el error en caso de que el archivo JSON no se pueda cargar
            console.error('Error al cargar los productos:', error);
            if(shopProducts) {
                shopProducts.innerHTML = '<p style="text-align: center; color: red;">No se pudieron cargar los productos. Por favor, intente más tarde.</p>';
            }
        });
});

// Renderizar productos
function renderProducts(filter = 'all') {
    if (!shopProducts) return; // Salir si el contenedor de productos no existe
    
    shopProducts.innerHTML = '';
    
    const filteredProducts = filter === 'all' 
        ? products 
        : products.filter(product => product.category === filter);
    
    if (filteredProducts.length === 0 && filter !== 'all') {
        shopProducts.innerHTML = '<p style="text-align: center;">No hay productos en esta categoría.</p>';
        return;
    }

    filteredProducts.forEach(product => {
        const productHTML = `
            <div class="product-item" data-category="${product.category}">
                <img src="${product.image}" alt="${product.name}" class="product-image" onclick="openProductModal('${product.image}', '${product.name}')">
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
                        <button class="add-to-cart-btn" onclick="addToCart(${product.id})">
                            Agregar al Carrito
                        </button>
                    </div>
                </div>
            </div>
        `;
        shopProducts.innerHTML += productHTML;
    });
}

// Configurar event listeners
function setupEventListeners() {
    // Filtros
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderProducts(this.dataset.filter);
        });
    });

    // Carrito flotante
    if (cartFloating) cartFloating.addEventListener('click', openCartModal);

    // Cerrar modales
    const closeCartBtn = document.querySelector('.close-cart');
    const closeCheckoutBtn = document.querySelector('.close-checkout');
    if (closeCartBtn) closeCartBtn.addEventListener('click', closeCartModal);
    if (closeCheckoutBtn) closeCheckoutBtn.addEventListener('click', closeCheckout);

    // Acciones del carrito
    const clearCartBtn = document.getElementById('clearCart');
    const checkoutBtn = document.getElementById('checkout');
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
    if (checkoutBtn) checkoutBtn.addEventListener('click', openCheckout);

    // Form de checkout
    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutForm) checkoutForm.addEventListener('submit', handleCheckout);

    // Cerrar modales al hacer click fuera
    if (cartModal) {
        cartModal.addEventListener('click', function(e) {
            if (e.target === cartModal) closeCartModal();
        });
    }

    if (checkoutModal) {
        checkoutModal.addEventListener('click', function(e) {
            if (e.target === checkoutModal) closeCheckout();
        });
    }
}

// Cambiar cantidad
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

// Agregar al carrito
function addToCart(productId) {
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
        if (quantity <= product.stock) {
            cart.push({
                ...product,
                quantity: quantity
            });
        } else {
            alert(`Solo quedan ${product.stock} unidades disponibles`);
            return;
        }
    }
    
    updateCartDisplay();
    
    // Feedback visual
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '¡Agregado!';
    btn.style.background = '#4CAF50';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '#B5651D';
    }, 1000);
}

// Actualizar display del carrito
function updateCartDisplay() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (cartCount) cartCount.textContent = totalItems;
    if (cartTotal) cartTotal.textContent = totalPrice.toLocaleString();
    
    // Mostrar/ocultar carrito flotante
    if (cartFloating) {
        if (totalItems > 0) {
            cartFloating.style.display = 'block';
        } else {
            cartFloating.style.display = 'none';
        }
    }
    
    renderCartItems();
}

// Renderizar items del carrito
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

// Actualizar cantidad en el carrito
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

// Remover del carrito
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartDisplay();
}

// Limpiar carrito
function clearCart() {
    if (confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
        cart = [];
        updateCartDisplay();
    }
}

// Abrir modal del carrito
function openCartModal() {
    if (cartModal) {
        cartModal.style.display = 'block';
        renderCartItems();
    }
}

// Cerrar modal del carrito
function closeCartModal() {
    if (cartModal) cartModal.style.display = 'none';
}

// Abrir checkout
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

// Cerrar checkout
function closeCheckout() {
    if (checkoutModal) checkoutModal.style.display = 'none';
}

// Renderizar resumen del pedido
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

// Manejar checkout
function handleCheckout(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const orderData = {
        customer: {
            nombre: formData.get('nombre'),
            email: formData.get('email'),
            telefono: formData.get('telefono'),
            direccion: formData.get('direccion'),
            ciudad: formData.get('ciudad'),
            codigoPostal: formData.get('codigoPostal'),
            referencias: formData.get('referencias')
        },
        metodoPago: formData.get('metodoPago'),
        items: cart,
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };
    
    // Simular envío del pedido
    console.log('Pedido enviado:', orderData);
    
    // Crear mensaje para WhatsApp
    const whatsappMessage = createWhatsAppMessage(orderData);
    
    // Enviar por WhatsApp
    const whatsappUrl = `https://wa.me/5491164372200?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, '_blank');
    
    // Limpiar carrito y cerrar modal
    cart = [];
    updateCartDisplay();
    closeCheckout();
    
    alert('¡Pedido enviado! Te hemos redirigido a WhatsApp para que completes el envío. Te contactaremos pronto para confirmar los detalles.');
}

// Crear mensaje para WhatsApp
function createWhatsAppMessage(orderData) {
    let message = `🍞 *NUEVO PEDIDO - NOVA PANES* 🍞\n\n`;
    message += `👤 *Cliente:* ${orderData.customer.nombre}\n`;
    message += `📧 *Email:* ${orderData.customer.email}\n`;
    message += `📱 *Teléfono:* ${orderData.customer.telefono}\n`;
    message += `📍 *Dirección:* ${orderData.customer.direccion}, ${orderData.customer.ciudad}\n`;
    
    if (orderData.customer.codigoPostal) {
        message += `📮 *CP:* ${orderData.customer.codigoPostal}\n`;
    }
    
    if (orderData.customer.referencias) {
        message += `📝 *Referencias:* ${orderData.customer.referencias}\n`;
    }
    
    message += `\n💳 *Método de pago:* ${orderData.metodoPago}\n\n`;
    
    message += `🛒 *PRODUCTOS:*\n`;
    orderData.items.forEach(item => {
        message += `• ${item.name} x${item.quantity} - $${(item.price * item.quantity).toLocaleString()}\n`;
    });
    
    message += `\n💰 *TOTAL: $${orderData.total.toLocaleString()}*`;
    
    return message;
}

// Abrir modal de producto (reutilizar el del index o crear uno simple)
function openProductModal(imageSrc, title) {
    // Verificar si existe el modal del producto del index.html
    const existingModal = document.getElementById('imageModal');
    
    if (existingModal) {
        // Usar el modal existente
        const modalImage = document.getElementById('modalImage');
        const modalTitle = document.getElementById('modalTitle');
        const modalNav = document.getElementById('modalNav');
        
        if (modalImage) modalImage.src = imageSrc;
        if (modalTitle) modalTitle.textContent = title;
        if (modalNav) modalNav.style.display = 'none'; // Ocultar navegación para imagen única
        
        existingModal.style.display = 'block';
    } else {
        // Crear modal simple si no existe (fallback)
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center;" onclick="this.remove()">
                <div style="max-width: 90%; max-height: 90%; background: white; border-radius: 12px; overflow: hidden; animation: modalAppear 0.3s;" onclick="event.stopPropagation()">
                    <img src="${imageSrc}" style="width: 100%; height: auto; display: block;">
                    <div style="padding: 20px; text-align: center; font-family: 'Lora', serif; font-size: 1.2rem;">${title}</div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}