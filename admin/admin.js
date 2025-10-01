document.addEventListener('DOMContentLoaded', () => {
    const adminPanel = document.getElementById('adminPanel');
    const productsTableBody = document.getElementById('productsTableBody');
    const categoriesList = document.getElementById('categoriesList');
    const ordersTableBody = document.getElementById('ordersTableBody');
    const addCategoryForm = document.getElementById('addCategoryForm');
    const productModal = document.getElementById('productModal');
    const productForm = document.getElementById('productForm');
    const modalTitle = document.getElementById('modalTitle');
    const closeModalBtn = document.querySelector('.close-modal-btn');
    const showAddProductModalBtn = document.getElementById('showAddProductModalBtn');
    const totalProductsStat = document.getElementById('totalProductsStat');
    const totalCategoriesStat = document.getElementById('totalCategoriesStat');
    const totalOrdersStat = document.getElementById('totalOrdersStat');

    let allProducts = [],
        allCategories = [],
        allOrders = [];
    const API_BASE_URL = '/api/admin';

    const getPassword = () => sessionStorage.getItem('apiPassword');
    const setPassword = (pass) => sessionStorage.setItem('apiPassword', pass);

    async function verifyPassword(password) {
        try {
            const response = await fetch(`${API_BASE_URL}/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    password
                })
            });
            const result = await response.json();
            if (result.success) {
                setPassword(password);
                loadInitialData();
            } else {
                alert('Contraseña incorrecta.');
                window.location.href = '/';
            }
        } catch (error) {
            alert('Error al verificar la contraseña.');
            window.location.href = '/';
        }
    }

    function promptForPassword() {
        const password = prompt('Por favor, introduce la contraseña de administrador:', '');
        if (password) {
            verifyPassword(password);
        } else {
            alert('Acceso cancelado.');
            window.location.href = '/';
        }
    }

    async function loadInitialData() {
        adminPanel.style.display = 'flex';
        try {
            const headers = {
                'Authorization': getPassword()
            };
            const [productsRes, categoriesRes, ordersRes] = await Promise.all([fetch(`${API_BASE_URL}/products`, {
                headers
            }), fetch(`${API_BASE_URL}/categories`, {
                headers
            }), fetch(`${API_BASE_URL}/orders`, {
                headers
            })]);
            if (!productsRes.ok || !categoriesRes.ok || !ordersRes.ok) throw new Error('No se pudieron cargar todos los datos.');
            allProducts = await productsRes.json();
            allCategories = await categoriesRes.json();
            allOrders = await ordersRes.json();
            updateDashboardStats();
            renderProductsTable();
            renderCategoriesList();
            renderOrdersTable();
            populateCategoryDropdown();
        } catch (error) {
            alert(error.message);
        }
    }

    function updateDashboardStats() {
        totalProductsStat.textContent = allProducts.length;
        totalCategoriesStat.textContent = allCategories.length;
        totalOrdersStat.textContent = allOrders.length;
    }

    function renderProductsTable() {
        productsTableBody.innerHTML = '';
        allProducts.forEach(product => {
            const categoryName = allCategories.find(c => c.id === product.category)?.name || 'N/A';
            const row = document.createElement('tr');
            row.innerHTML = `<td><img src="/${product.image}" alt="${product.name}"></td><td>${product.name}</td><td>$${product.price.toLocaleString('es-AR')}</td><td>${product.stock}</td><td>${categoryName}</td><td><button class="btn-edit" data-id="${product.id}">Editar</button><button class="btn-delete" data-id="${product.id}">Eliminar</button></td>`;
            productsTableBody.appendChild(row);
        });
    }

    function renderCategoriesList() {
        categoriesList.innerHTML = '';
        allCategories.forEach(category => {
            const div = document.createElement('div');
            div.className = 'category-item';
            div.innerHTML = `<span>${category.name}</span><button class="btn-delete-category" data-id="${category.id}">&times;</button>`;
            categoriesList.appendChild(div);
        });
    }

    function populateCategoryDropdown() {
        const categorySelect = document.getElementById('category');
        categorySelect.innerHTML = '<option value="">Seleccionar...</option>';
        allCategories.forEach(cat => {
            categorySelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }

    function renderOrdersTable() {
        ordersTableBody.innerHTML = '';
        if (allOrders.length === 0) {
            ordersTableBody.innerHTML = '<tr><td colspan="5">No hay pedidos registrados.</td></tr>';
            return;
        }
        allOrders.forEach(order => {
            const row = document.createElement('tr');
            const orderDate = new Date(order.date).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            const statusClass = order.status === 'pending' ? 'status-pending' : 'status-delivered';
            row.innerHTML = `<td>${order.customer.nombre}</td><td>${orderDate}</td><td>$${order.total.toLocaleString('es-AR')}</td><td><span class="status ${statusClass}">${order.status === 'pending' ? 'Pendiente' : 'Entregado'}</span></td><td><button class="btn-toggle-status" data-id="${order.id}" data-current-status="${order.status}">${order.status === 'pending' ? 'Marcar Entregado' : 'Marcar Pendiente'}</button></td>`;
            ordersTableBody.appendChild(row);
        });
    }

    // --- MODIFICADO para incluir promo_price ---
    function openModal(mode, productId = null) {
        productForm.reset();
        document.getElementById('currentImage').style.display = 'none';
        document.getElementById('image').required = (mode === 'add');
        if (mode === 'edit') {
            const product = allProducts.find(p => p.id === productId);
            modalTitle.textContent = 'Editar Producto';
            productForm.elements['id'].value = product.id;
            productForm.elements['name'].value = product.name;
            productForm.elements['price'].value = product.price;
            productForm.elements['promo_price'].value = product.promo_price || ''; // <-- AÑADIDO
            productForm.elements['stock'].value = product.stock;
            productForm.elements['description'].value = product.description;
            productForm.elements['category'].value = product.category;
            const img = document.getElementById('currentImage');
            img.src = `/${product.image}`;
            img.style.display = 'block';
        } else {
            modalTitle.textContent = 'Añadir Nuevo Producto';
            productForm.elements['id'].value = '';
        }
        productModal.style.display = 'block';
    }

    function closeModal() {
        productModal.style.display = 'none';
    }

    showAddProductModalBtn.addEventListener('click', () => openModal('add'));
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => (e.target === productModal) && closeModal());
    productsTableBody.addEventListener('click', e => {
        const id = parseInt(e.target.dataset.id);
        if (e.target.classList.contains('btn-edit')) openModal('edit', id);
        if (e.target.classList.contains('btn-delete')) handleDeleteProduct(id);
    });
    productForm.addEventListener('submit', async e => {
        e.preventDefault();
        const id = document.getElementById('productId').value;
        const url = id ? `${API_BASE_URL}/products/${id}` : `${API_BASE_URL}/products`;
        const method = id ? 'PUT' : 'POST';
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': getPassword()
                },
                body: new FormData(productForm)
            });
            if (!response.ok) throw new Error((await response.json()).message);
            closeModal();
            loadInitialData();
        } catch (error) {
            alert(error.message);
        }
    });
    async function handleDeleteProduct(id) {
        if (!confirm('¿Seguro que quieres eliminar este producto?')) return;
        try {
            const response = await fetch(`${API_BASE_URL}/products/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': getPassword()
                }
            });
            if (!response.ok) throw new Error((await response.json()).message);
            loadInitialData();
        } catch (error) {
            alert(error.message);
        }
    }
    addCategoryForm.addEventListener('submit', async e => {
        e.preventDefault();
        const name = document.getElementById('newCategoryName').value;
        try {
            const response = await fetch(`${API_BASE_URL}/categories`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': getPassword()
                },
                body: JSON.stringify({
                    name
                })
            });
            if (!response.ok) throw new Error((await response.json()).message);
            addCategoryForm.reset();
            loadInitialData();
        } catch (error) {
            alert(error.message);
        }
    });
    categoriesList.addEventListener('click', async e => {
        if (e.target.classList.contains('btn-delete-category')) {
            const id = e.target.dataset.id;
            if (!confirm(`¿Eliminar la categoría "${id}"?`)) return;
            try {
                const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': getPassword()
                    }
                });
                if (!response.ok) throw new Error((await response.json()).message);
                loadInitialData();
            } catch (error) {
                alert(error.message);
            }
        }
    });
    ordersTableBody.addEventListener('click', async e => {
        if (e.target.classList.contains('btn-toggle-status')) {
            const orderId = e.target.dataset.id;
            const newStatus = e.target.dataset.currentStatus === 'pending' ? 'delivered' : 'pending';
            try {
                const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': getPassword()
                    },
                    body: JSON.stringify({
                        status: newStatus
                    })
                });
                if (!response.ok) throw new Error('No se pudo actualizar el estado.');
                loadInitialData();
            } catch (error) {
                alert(error.message);
            }
        }
    });

    if (getPassword()) {
        verifyPassword(getPassword());
    } else {
        promptForPassword();
    }
});