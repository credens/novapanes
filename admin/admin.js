document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO Y ELEMENTOS ---
    const passwordModal = document.getElementById('passwordModal');
    const passwordForm = document.getElementById('passwordForm');
    const productModal = document.getElementById('productModal');
    const productForm = document.getElementById('productForm');
    const closeModalBtn = document.querySelector('.close-modal-btn');
    const showAddProductModalBtn = document.getElementById('showAddProductModalBtn');
    const sections = document.querySelectorAll('.main-content > section');
    const navItems = document.querySelectorAll('.nav-item');

    let allProducts = [], allCategories = [], allOrders = [], allVisits = [];
    let salesChartInstance, visitsChartInstance;

    // --- AUTENTICACIÓN ---
    function checkAuth() {
        const savedPass = sessionStorage.getItem('adminPassword');
        if (savedPass) {
            passwordModal.style.display = 'none';
            loadDashboardData();
        }
    }

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('adminPassword').value;
        try {
            const res = await fetch('/api/admin/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const result = await res.json();
            if (result.success) {
                sessionStorage.setItem('adminPassword', password);
                passwordModal.style.display = 'none';
                loadDashboardData();
            } else {
                alert('Contraseña incorrecta.');
            }
        } catch (error) {
            alert('Error al conectar con el servidor.');
        }
    });

    // --- NAVEGACIÓN ---
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = item.getAttribute('href').substring(1);
            if(targetId === "") return; 
            
            e.preventDefault();
            sections.forEach(s => s.style.display = 'none');
            document.getElementById(targetId).style.display = 'block';
            
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            document.title = `${item.textContent.trim()} | Admin NOVA`;
        });
    });

    // --- API HELPER ---
    async function apiFetch(url, options = {}) {
        const password = sessionStorage.getItem('adminPassword');
        const headers = { 'Authorization': password };
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        const response = await fetch(`/api/admin${url}`, { ...options, headers });
        if (!response.ok) throw new Error('Error en la petición');
        return response.json();
    }

    // --- CARGA DE DATOS ---
    async function loadDashboardData() {
        try {
            [allProducts, allCategories, allOrders, allVisits] = await Promise.all([
                apiFetch('/products'),
                apiFetch('/categories'),
                apiFetch('/orders'),
                apiFetch('/visits')
            ]);
            renderAll();
        } catch (error) {
            console.error(error);
        }
    }

    function renderAll() {
        renderStats();
        renderProducts();
        renderOrders();
        renderCategories();
        populateCategorySelect();
        renderCharts();
    }

    function renderStats() {
        document.getElementById('totalProducts').textContent = allProducts.length;
        const pending = allOrders.filter(o => o.status === 'pending').length;
        document.getElementById('pendingOrders').textContent = pending;
    }

    function renderProducts() {
        const tbody = document.getElementById('productsTableBody');
        tbody.innerHTML = allProducts.map(p => {
            const catName = allCategories.find(c => c.id === p.category)?.name || p.category;
            // Si el stock es 0 o tiene la propiedad inhabilitada
            const isOutOfStock = p.stock <= 0;
            
            return `
                <tr style="${isOutOfStock ? 'opacity: 0.6; background: #fff1f1;' : ''}">
                    <td><img src="/${p.image}" alt="${p.name}"></td>
                    <td>
                        <strong>${p.name}</strong>
                        ${isOutOfStock ? '<br><span style="color:red; font-size:0.7rem; font-weight:bold;">SIN STOCK</span>' : ''}
                    </td>
                    <td>$${p.price.toLocaleString()}</td>
                    <td>${p.badge ? `<span class="status status-pending">${p.badge}</span>` : '-'}</td>
                    <td>${catName}</td>
                    <td>
                        <div class="actions-row">
                            <button class="btn-edit" onclick="animateBtn(this); editProduct(${p.id})" title="Editar"><i class="fas fa-edit"></i></button>
                            <button class="btn-edit" onclick="animateBtn(this); toggleStock(${p.id}, ${isOutOfStock})" title="${isOutOfStock ? 'Habilitar Stock' : 'Marcar Sin Stock'}" style="background: ${isOutOfStock ? '#4CAF50' : '#FF9800'}; color: white;">
                                <i class="fas ${isOutOfStock ? 'fa-eye' : 'fa-eye-slash'}"></i>
                            </button>
                            <button class="btn-delete" onclick="animateBtn(this); deleteProduct(${p.id})" title="Eliminar"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // NUEVA FUNCIÓN PARA TOGGLE DE STOCK
    window.toggleStock = async (id, isCurrentlyOut) => {
        const p = allProducts.find(prod => prod.id == id);
        const newStock = isCurrentlyOut ? 99 : 0; 
        
        const formData = new FormData();
        formData.append('stock', newStock);

        try {
            await apiFetch(`/products/${id}`, {
                method: 'PUT',
                body: formData
            });
            loadDashboardData();
        } catch (error) {
            alert('Error al actualizar stock');
        }
    };

    function renderOrders() {
        const tbody = document.getElementById('ordersTableBody');
        tbody.innerHTML = allOrders.map(o => `
            <tr style="cursor:pointer;" onclick="viewOrder('${o.id}')">
                <td>#${o.id.slice(-4)}</td>
                <td>${o.customer?.nombre || '-'}</td>
                <td>$${o.total?.toLocaleString() || 0}</td>
                <td>${new Date(o.date).toLocaleDateString()}</td>
                <td><span class="status ${o.status === 'pending' ? 'status-pending' : 'status-delivered'}">${o.status === 'pending' ? 'Pendiente' : 'Entregado'}</span></td>
                <td>
                    <div class="actions-row" onclick="event.stopPropagation()">
                        <button class="btn-edit" onclick="animateBtn(this); viewOrder('${o.id}')" title="Ver detalle"><i class="fas fa-eye"></i></button>
                        <select class="status-select" onchange="updateOrderStatus('${o.id}', this.value)" style="padding:8px 12px; border-radius:10px; border:1px solid #EEE; font-family:inherit; font-size:0.8rem;">
                            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                            <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Entregado</option>
                        </select>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    window.viewOrder = (id) => {
        const o = allOrders.find(order => order.id === id);
        if (!o) return;
        const modal = document.getElementById('orderDetailModal');
        const body = document.getElementById('orderDetailBody');
        const items = o.items ? o.items.map(i => `
            <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #F5F1EB;">
                <span>${i.name} x${i.quantity}</span>
                <span style="font-weight:700;">$${((i.price || 0) * i.quantity).toLocaleString()}</span>
            </div>`).join('') : '<p style="color:var(--text-light);">Sin detalle de items</p>';

        const c = o.customer || {};
        body.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:25px;">
                <div>
                    <label style="font-size:0.75rem; color:var(--text-light); text-transform:uppercase; letter-spacing:1px;">Cliente</label>
                    <p style="font-weight:700; margin:5px 0;">${c.nombre || '-'}</p>
                </div>
                <div>
                    <label style="font-size:0.75rem; color:var(--text-light); text-transform:uppercase; letter-spacing:1px;">WhatsApp</label>
                    <p style="font-weight:700; margin:5px 0;">${c.telefono || c.whatsapp || '-'}</p>
                </div>
                <div>
                    <label style="font-size:0.75rem; color:var(--text-light); text-transform:uppercase; letter-spacing:1px;">Entrega</label>
                    <p style="font-weight:700; margin:5px 0;">${o.metodoEntrega || o.delivery || '-'}</p>
                </div>
                <div>
                    <label style="font-size:0.75rem; color:var(--text-light); text-transform:uppercase; letter-spacing:1px;">Pago</label>
                    <p style="font-weight:700; margin:5px 0;">${o.metodoPago || o.payment || '-'}</p>
                </div>
            </div>
            ${(o.direccion || c.direccion) ? `
            <div style="margin-bottom:25px;">
                <label style="font-size:0.75rem; color:var(--text-light); text-transform:uppercase; letter-spacing:1px;">Dirección</label>
                <p style="font-weight:700; margin:5px 0;">${o.direccion || c.direccion || ''} ${o.ciudad || c.ciudad || ''}</p>
            </div>` : ''}
            <div style="margin-bottom:15px;">
                <label style="font-size:0.75rem; color:var(--text-light); text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:10px;">Productos</label>
                ${items}
            </div>
            <div style="text-align:right; margin-top:20px; padding-top:15px; border-top:2px solid #F0F0F0;">
                <span style="font-size:1.6rem; font-weight:800;">Total: $${o.total?.toLocaleString() || 0}</span>
            </div>
            <div style="text-align:center; margin-top:10px;">
                <span class="status ${o.status === 'pending' ? 'status-pending' : 'status-delivered'}" style="font-size:0.85rem; padding:8px 20px;">${o.status === 'pending' ? 'Pendiente' : 'Entregado'}</span>
            </div>`;
        modal.style.display = 'flex';
    };

    function renderCategories() {
        const div = document.getElementById('categoriesList');
        div.innerHTML = allCategories.map(c => `
            <div class="category-item" style="display:inline-flex; align-items:center; background:#EAE2D7; padding:10px 20px; border-radius:50px; margin:5px; font-weight:600;">
                ${c.name}
                <i class="fas fa-times" onclick="deleteCategory('${c.id}')" style="margin-left:15px; cursor:pointer; color:var(--primary-red);"></i>
            </div>
        `).join('');
    }

    function populateCategorySelect() {
        const select = document.getElementById('productCategory');
        select.innerHTML = '<option value="">Elegir...</option>' + 
            allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    function renderCharts() {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const currentYear = new Date().getFullYear();
        const salesData = Array(12).fill(0);
        allOrders.forEach(o => {
            const d = new Date(o.date);
            if(d.getFullYear() === currentYear) salesData[d.getMonth()] += o.total;
        });
        const visitsData = Array(12).fill(0);
        allVisits.forEach(v => {
            const d = new Date(v.date);
            if(d.getFullYear() === currentYear) visitsData[d.getMonth()]++;
        });

        if (salesChartInstance) salesChartInstance.destroy();
        if (visitsChartInstance) visitsChartInstance.destroy();

        const ctxS = document.getElementById('salesChart').getContext('2d');
        salesChartInstance = new Chart(ctxS, {
            type: 'bar',
            data: { labels: months, datasets: [{ label: 'Ventas $', data: salesData, backgroundColor: '#D32F2F' }] },
            options: { responsive: true, maintainAspectRatio: false }
        });

        const ctxV = document.getElementById('visitsChart').getContext('2d');
        visitsChartInstance = new Chart(ctxV, {
            type: 'line',
            data: { labels: months, datasets: [{ label: 'Visitas', data: visitsData, borderColor: '#FFB300', tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    showAddProductModalBtn.onclick = () => {
        productForm.reset();
        document.getElementById('productId').value = '';
        document.getElementById('modalTitle').textContent = 'Agregar Producto';
        productModal.style.display = 'flex';
    };

    document.querySelector('.close-modal-btn').onclick = () => productModal.style.display = 'none';

    productForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('productId').value;
        const formData = new FormData(productForm);
        try {
            await apiFetch(id ? `/products/${id}` : '/products', {
                method: id ? 'PUT' : 'POST',
                body: formData
            });
            productModal.style.display = 'none';
            loadDashboardData();
        } catch (error) {
            alert('Error al guardar.');
        }
    };

    window.editProduct = (id) => {
        const p = allProducts.find(prod => prod.id == id);
        document.getElementById('productId').value = p.id;
        document.getElementById('modalTitle').textContent = 'Editar Producto';
        productForm.name.value = p.name;
        productForm.price.value = p.price;
        productForm.stock.value = p.stock;
        productForm.category.value = p.category;
        productForm.badge.value = p.badge || '';
        productForm.description.value = p.description || '';
        productModal.style.display = 'flex';
    };

    window.animateBtn = (el) => {
        el.classList.remove('clicked');
        void el.offsetWidth;
        el.classList.add('clicked');
    };

    window.deleteProduct = async (id) => {
        if(!confirm('¿Eliminar?')) return;
        await apiFetch(`/products/${id}`, { method: 'DELETE' });
        loadDashboardData();
    };

    window.deleteCategory = async (id) => {
        if(!confirm('¿Eliminar categoría?')) return;
        await apiFetch(`/categories/${id}`, { method: 'DELETE' });
        loadDashboardData();
    };

    document.getElementById('categoryForm').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('newCategoryName').value;
        await apiFetch('/categories', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        document.getElementById('newCategoryName').value = '';
        loadDashboardData();
    };

    window.updateOrderStatus = async (id, status) => {
        await apiFetch(`/orders/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        loadDashboardData();
    };

    checkAuth();
});