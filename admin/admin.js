document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const passwordModal = document.getElementById('passwordModal');
    const passwordForm = document.getElementById('passwordForm');
    const productModal = document.getElementById('productModal');
    const productForm = document.getElementById('productForm');
    const closeModalBtn = document.querySelector('.close-modal-btn');
    const showAddProductModalBtn = document.getElementById('showAddProductModalBtn');

    const sections = document.querySelectorAll('.main-content > section');
    // --- INICIO DE LA CORRECCIÓN ---
    // Ahora seleccionamos TODOS los elementos de navegación, no solo los de la barra lateral.
    const navItems = document.querySelectorAll('.nav-item'); 
    const sidebarNavItems = document.querySelectorAll('.sidebar-nav .nav-item'); // Mantenemos una referencia específica a los del sidebar para la clase 'active'
    // --- FIN DE LA CORRECCIÓN ---


    // --- ESTADO DE LA APLICACIÓN ---
    let allProducts = [];
    let allCategories = [];
    let allOrders = [];

    // --- AUTENTICACIÓN ---
    function checkAuth() {
        if (!sessionStorage.getItem('adminPassword')) {
            passwordModal.style.display = 'flex';
        } else {
            loadDashboardData();
        }
    }

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('adminPassword').value;
        try {
            const response = await fetch('/api/admin/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const result = await response.json();
            if (result.success) {
                sessionStorage.setItem('adminPassword', password);
                passwordModal.style.display = 'none';
                loadDashboardData();
            } else {
                alert('Contraseña incorrecta.');
            }
        } catch (error) {
            console.error('Error de verificación:', error);
            alert('Error al conectar con el servidor.');
        }
    });

    // --- NAVEGACIÓN (SECCIÓN MODIFICADA) ---
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetHref = item.getAttribute('href'); // e.g., "#products"
            const targetId = targetHref.substring(1); // e.g., "products"

            // 1. Mostrar la sección correcta
            sections.forEach(section => {
                section.style.display = section.id === targetId ? 'block' : 'none';
            });

            // 2. Actualizar la clase 'active' SOLAMENTE en la barra lateral
            sidebarNavItems.forEach(nav => nav.classList.remove('active'));
            const correspondingSidebarItem = document.querySelector(`.sidebar-nav .nav-item[href="${targetHref}"]`);
            if (correspondingSidebarItem) {
                correspondingSidebarItem.classList.add('active');
            }
        });
    });


    // --- HELPERS DE API ---
    async function apiFetch(url, options = {}) {
        const password = sessionStorage.getItem('adminPassword');
        if (!password) {
            alert('Autenticación requerida.');
            passwordModal.style.display = 'flex';
            throw new Error('Autenticación fallida');
        }
        
        const headers = { 'Authorization': password };
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        
        const response = await fetch(`/api/admin${url}`, { ...options, headers });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error ${response.status}`);
        }
        return response.json();
    }
    
    // --- CARGA DE DATOS ---
    async function loadDashboardData() {
        try {
            [allProducts, allCategories, allOrders] = await Promise.all([
                apiFetch('/products'),
                apiFetch('/categories'),
                apiFetch('/orders')
            ]);
            renderAll();
        } catch (error) {
            console.error('Error al cargar datos del dashboard:', error);
            alert(`No se pudieron cargar los datos: ${error.message}`);
        }
    }

    // --- RENDERIZADO ---
    function renderAll() {
        renderStats();
        renderProducts();
        renderOrders();
        renderCategories();
        populateCategorySelect();
    }

    function renderStats() {
        document.getElementById('totalProducts').textContent = allProducts.length;
        const pending = allOrders.filter(o => o.status.toLowerCase() === 'pending').length;
        document.getElementById('pendingOrders').textContent = pending;
    }

    function renderProducts() {
        const tableBody = document.getElementById('productsTableBody');
        tableBody.innerHTML = '';
        allProducts.forEach(p => {
            const categoryName = allCategories.find(c => c.id === p.category)?.name || 'Sin Categoría';
            const price = (p.promo_price && p.promo_price > 0) ? `<del>$${p.price.toFixed(2)}</del> <strong style="color: #28a745;">$${p.promo_price.toFixed(2)}</strong>` : `$${p.price.toFixed(2)}`;
            const row = `
                <tr>
                    <td><img src="/${p.image}" alt="${p.name}"></td>
                    <td>${p.name}</td>
                    <td>${price}</td>
                    <td>${p.stock}</td>
                    <td>${categoryName}</td>
                    <td>
                        <button class="btn-edit" data-id="${p.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-delete" data-id="${p.id}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            tableBody.innerHTML += row;
        });
    }

    function renderOrders() {
        const tableBody = document.getElementById('ordersTableBody');
        tableBody.innerHTML = '';
        allOrders.sort((a, b) => new Date(b.date) - new Date(a.date)); // Ordenar por fecha más reciente
        allOrders.forEach(o => {
            const statusClass = `status-${o.status ? o.status.toLowerCase() : 'pending'}`;
            const row = `
                <tr>
                    <td>${o.id}</td>
                    <td>${o.customer.nombre}</td>
                    <td>$${o.total.toLocaleString('es-AR')}</td>
                    <td>${new Date(o.date).toLocaleDateString()}</td>
                    <td><span class="status ${statusClass}">${o.status}</span></td>
                    <td>
                        <select class="order-status-select" data-id="${o.id}">
                            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                            <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>Procesando</option>
                            <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Enviado</option>
                            <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Entregado</option>
                            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
                        </select>
                    </td>
                </tr>`;
            tableBody.innerHTML += row;
        });
    }

    function renderCategories() {
        const list = document.getElementById('categoriesList');
        list.innerHTML = '';
        allCategories.forEach(c => {
            const item = `
                <div class="category-item">
                    ${c.name}
                    <button class="btn-delete-category" data-id="${c.id}">&times;</button>
                </div>`;
            list.innerHTML += item;
        });
    }
    
    function populateCategorySelect() {
        const select = document.getElementById('productCategory');
        select.innerHTML = '<option value="">Seleccione una categoría</option>';
        allCategories.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    }
    
    // --- MANEJO DE MODALES ---
    showAddProductModalBtn.addEventListener('click', () => {
        productForm.reset();
        document.getElementById('productId').value = '';
        document.getElementById('modalTitle').textContent = 'Agregar Producto';
        document.getElementById('productImage').required = true;
        productModal.style.display = 'flex';
    });

    closeModalBtn.addEventListener('click', () => {
        productModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === productModal) {
            productModal.style.display = 'none';
        }
    });

    // --- MANEJO DE FORMULARIOS ---
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('productId').value;
        const formData = new FormData(productForm);

        try {
            if (id) {
                await apiFetch(`/products/${id}`, { method: 'PUT', body: formData });
            } else {
                await apiFetch('/products', { method: 'POST', body: formData });
            }
            productModal.style.display = 'none';
            loadDashboardData();
        } catch (error) {
            alert(`Error al guardar el producto: ${error.message}`);
        }
    });

    document.getElementById('categoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('newCategoryName').value;
        if (!name) return;

        try {
            await apiFetch('/categories', {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            document.getElementById('newCategoryName').value = '';
            loadDashboardData();
        } catch (error) {
            alert(`Error al crear la categoría: ${error.message}`);
        }
    });
    
    // --- EVENT DELEGATION PARA ACCIONES ---
    document.body.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.btn-edit');
        const deleteBtn = e.target.closest('.btn-delete');
        const deleteCategoryBtn = e.target.closest('.btn-delete-category');

        if (editBtn) {
            const id = editBtn.dataset.id;
            const product = allProducts.find(p => p.id == id);
            if (product) {
                document.getElementById('productId').value = product.id;
                document.getElementById('modalTitle').textContent = 'Editar Producto';
                productForm.elements.name.value = product.name;
                productForm.elements.description.value = product.description;
                productForm.elements.price.value = product.price;
                productForm.elements.promo_price.value = product.promo_price || '';
                productForm.elements.stock.value = product.stock;
                productForm.elements.category.value = product.category;
                productForm.elements.image.required = false;
                productModal.style.display = 'flex';
            }
        }
        
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
                try {
                    await apiFetch(`/products/${id}`, { method: 'DELETE' });
                    loadDashboardData();
                } catch (error) {
                    alert(`Error al eliminar el producto: ${error.message}`);
                }
            }
        }
        
        if (deleteCategoryBtn) {
            const id = deleteCategoryBtn.dataset.id;
            if (confirm('¿Estás seguro de que quieres eliminar esta categoría? Esto no se puede deshacer.')) {
                try {
                    await apiFetch(`/categories/${id}`, { method: 'DELETE' });
                    loadDashboardData();
                } catch (error) {
                    alert(`Error al eliminar la categoría: ${error.message}`);
                }
            }
        }
    });

    document.body.addEventListener('change', async (e) => {
        if (e.target.classList.contains('order-status-select')) {
            const id = e.target.dataset.id;
            const status = e.target.value;
            try {
                await apiFetch(`/orders/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ status })
                });
                loadDashboardData();
            } catch (error) {
                alert(`Error al actualizar el estado del pedido: ${error.message}`);
            }
        }
    });

    // --- INICIALIZACIÓN ---
    checkAuth();
});