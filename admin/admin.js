// =================================================================
//      ARCHIVO admin-script.js (LÓGICA DE LOGIN CORREGIDA)
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const passwordModal = document.getElementById('passwordModal');
    const passwordForm = document.getElementById('passwordForm');
    const productModal = document.getElementById('productModal');
    const productForm = document.getElementById('productForm');
    const categoryForm = document.getElementById('categoryForm');
    
    const productsTableBody = document.getElementById('productsTableBody');
    const categoriesList = document.getElementById('categoriesList');
    const ordersTableBody = document.getElementById('ordersTableBody');

    const closeModalBtn = document.querySelector('.close-modal-btn');
    const showAddProductModalBtn = document.getElementById('showAddProductModalBtn');
    
    const totalProductsStat = document.getElementById('totalProducts');
    const pendingOrdersStat = document.getElementById('pendingOrders');

    const sections = document.querySelectorAll('.main-content > section');
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');

    // --- ESTADO Y API ---
    let allProducts = [], allCategories = [], allOrders = [];
    const API_BASE_URL = '/api/admin';

    const getPassword = () => sessionStorage.getItem('adminPassword');
    const setPassword = (pass) => sessionStorage.setItem('adminPassword', pass);

    // --- MANEJO DE ERRORES DE FETCH ---
    async function handleFetchError(response) {
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error desconocido sin JSON.' }));
            throw new Error(errorData.message || `Error del servidor: ${response.status}`);
        }
        return response.json();
    }
    
    // --- AUTENTICACIÓN (USANDO TU LÓGICA ORIGINAL CON EL MODAL) ---
    async function verifyPassword(password) {
        try {
            const response = await fetch('/api/admin/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const result = await response.json();
            if (result.success) {
                setPassword(password);
                passwordModal.style.display = 'none'; // Ocultamos el modal
                loadInitialData(); // Cargamos los datos
            } else {
                alert('Contraseña incorrecta.');
                sessionStorage.removeItem('adminPassword');
                passwordModal.style.display = 'flex'; // Mostramos modal de nuevo
            }
        } catch (error) {
            alert('Error al verificar la contraseña.');
        }
    }
    
    passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = document.getElementById('adminPassword').value;
        if (password) {
            verifyPassword(password);
        }
    });

    // --- NAVEGACIÓN POR SECCIONES ---
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('href').substring(1);
            sections.forEach(section => {
                section.style.display = section.id === targetId ? 'block' : 'none';
            });
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // --- CARGA DE DATOS ---
    async function loadInitialData() {
        try {
            const headers = { 'Authorization': getPassword() };
            const [productsRes, categoriesRes, ordersRes] = await Promise.all([
                fetch(`${API_BASE_URL}/products`, { headers }),
                fetch(`${API_BASE_URL}/categories`, { headers }),
                fetch(`${API_BASE_URL}/orders`, { headers })
            ]);

            allProducts = await handleFetchError(productsRes);
            allCategories = await handleFetchError(categoriesRes);
            allOrders = await handleFetchError(ordersRes);

            updateDashboardStats();
            renderProductsTable();
            renderCategoriesList();
            renderOrdersTable();
            populateCategoryDropdown();
        } catch (error) {
            alert('Error al cargar datos: ' + error.message);
            // Si falla la carga de datos, es posible que la pass sea inválida.
            sessionStorage.removeItem('adminPassword');
            passwordModal.style.display = 'flex';
        }
    }

    // --- RENDERIZADO Y ACTUALIZACIÓN DE LA UI ---
    function updateDashboardStats() {
        totalProductsStat.textContent = allProducts.length;
        pendingOrdersStat.textContent = allOrders.filter(o => o.status === 'pending').length;
    }

    function renderProductsTable() {
        productsTableBody.innerHTML = '';
        allProducts.forEach(product => {
            const categoryName = allCategories.find(c => c.id === product.category)?.name || 'Sin Categoría';
            const price = product.promo_price ? `<del>$${product.price.toLocaleString('es-AR')}</del> $${product.promo_price.toLocaleString('es-AR')}` : `$${product.price.toLocaleString('es-AR')}`;
            const row = `<tr>
                <td><img src="/${product.image}" alt="${product.name}"></td>
                <td>${product.name}</td>
                <td>${price}</td>
                <td>${product.stock}</td>
                <td>${categoryName}</td>
                <td>
                    <button class="btn-edit" data-id="${product.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete" data-id="${product.id}"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
            productsTableBody.innerHTML += row;
        });
    }

    function renderCategoriesList() {
        categoriesList.innerHTML = '';
        allCategories.forEach(category => {
            categoriesList.innerHTML += `<div class="category-item">
                <span>${category.name}</span>
                <button class="btn-delete-category" data-id="${category.id}">&times;</button>
            </div>`;
        });
    }

    function renderOrdersTable() {
        ordersTableBody.innerHTML = '';
        allOrders.forEach(order => {
            const orderDate = new Date(order.date).toLocaleDateString('es-AR');
            const statusClass = `status-${order.status.toLowerCase()}`;
            const row = `<tr>
                <td>${order.id}</td>
                <td>${order.customer.nombre}</td>
                <td>${orderDate}</td>
                <td>$${order.total.toLocaleString('es-AR')}</td>
                <td><span class="status ${statusClass}">${order.status}</span></td>
                <td>
                    <select class="order-status-select" data-id="${order.id}">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                        <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Procesando</option>
                        <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Enviado</option>
                        <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Entregado</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
                    </select>
                </td>
            </tr>`;
            ordersTableBody.innerHTML += row;
        });
    }
    
    function populateCategoryDropdown() {
        const select = document.getElementById('productCategory');
        select.innerHTML = '<option value="">Seleccionar...</option>';
        allCategories.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }

    // --- MANEJO DE MODALES ---
    function openModal(mode, productId = null) {
        productForm.reset();
        const imagePreview = document.getElementById('currentImagePreview');
        imagePreview.style.display = 'none';

        if (mode === 'edit' && productId) {
            const product = allProducts.find(p => p.id === productId);
            document.getElementById('modalTitle').textContent = 'Editar Producto';
            productForm.elements['id'].value = product.id;
            productForm.elements['name'].value = product.name;
            productForm.elements['price'].value = product.price;
            productForm.elements['promo_price'].value = product.promo_price || '';
            productForm.elements['stock'].value = product.stock;
            productForm.elements['description'].value = product.description;
            productForm.elements['category'].value = product.category;
            imagePreview.src = `/${product.image}`;
            imagePreview.style.display = 'block';
        } else {
            document.getElementById('modalTitle').textContent = 'Añadir Nuevo Producto';
        }
        productModal.style.display = 'flex';
    }

    function closeModal() { productModal.style.display = 'none'; }
    showAddProductModalBtn.addEventListener('click', () => openModal('add'));
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => (e.target === productModal) && closeModal());

    // --- MANEJO DE EVENTOS Y FORMULARIOS ---
    productForm.addEventListener('submit', async e => {
        e.preventDefault();
        const id = productForm.elements['id'].value;
        const url = id ? `${API_BASE_URL}/products/${id}` : `${API_BASE_URL}/products`;
        const method = id ? 'PUT' : 'POST';
        
        try {
            const response = await fetch(url, {
                method,
                headers: { 'Authorization': getPassword() },
                body: new FormData(productForm)
            });
            await handleFetchError(response);
            closeModal();
            loadInitialData();
        } catch (error) {
            alert('Error al guardar producto: ' + error.message);
        }
    });

    categoryForm.addEventListener('submit', async e => {
        e.preventDefault();
        const name = document.getElementById('newCategoryName').value;
        try {
            await fetch(`${API_BASE_URL}/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': getPassword() },
                body: JSON.stringify({ name })
            }).then(handleFetchError);
            categoryForm.reset();
            loadInitialData();
        } catch (error) {
            alert(error.message);
        }
    });

    document.body.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-id]');
        if (!target) return;
        const id = target.dataset.id;
        
        if (target.matches('.btn-edit')) openModal('edit', parseInt(id));
        if (target.matches('.btn-delete')) {
            if (confirm('¿Seguro que quieres eliminar este producto?')) {
                try {
                    await fetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE', headers: { 'Authorization': getPassword() } }).then(handleFetchError);
                    loadInitialData();
                } catch (error) { alert('Error al eliminar: ' + error.message); }
            }
        }
        if (target.matches('.btn-delete-category')) {
             if (confirm(`¿Eliminar esta categoría?`)) {
                try {
                    await fetch(`${API_BASE_URL}/categories/${id}`, { method: 'DELETE', headers: { 'Authorization': getPassword() } }).then(handleFetchError);
                    loadInitialData();
                } catch (error) { alert(error.message); }
             }
        }
    });

    document.body.addEventListener('change', async (e) => {
        if (e.target.matches('.order-status-select')) {
            const orderId = e.target.dataset.id;
            const status = e.target.value;
            try {
                await fetch(`${API_BASE_URL}/orders/${orderId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': getPassword() },
                    body: JSON.stringify({ status })
                }).then(handleFetchError);
                loadInitialData();
            } catch (error) { alert('No se pudo actualizar el estado: ' + error.message); }
        }
    });

    // --- INICIALIZACIÓN ---
    function initialize() {
        const storedPassword = getPassword();
        if (storedPassword) {
            // Si hay una contraseña guardada, la verificamos antes de continuar.
            verifyPassword(storedPassword);
        } else {
            // Si no hay contraseña, mostramos el modal para que la ingrese.
            passwordModal.style.display = 'flex';
        }
    }

    initialize();
});