// ===================================================
//      ARCHIVO admin.js (VERSIÓN CON DIAGNÓSTICO FINAL)
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del DOM
    const adminPanel = document.getElementById('adminPanel');
    const productsTableBody = document.getElementById('productsTableBody');
    const categoriesList = document.getElementById('categoriesList');
    const addCategoryForm = document.getElementById('addCategoryForm');
    const productModal = document.getElementById('productModal');
    const productForm = document.getElementById('productForm');
    const modalTitle = document.getElementById('modalTitle');
    const closeModalBtn = document.querySelector('.close-modal-btn');
    const showAddProductModalBtn = document.getElementById('showAddProductModalBtn');

    let allProducts = [];
    let allCategories = [];
    const API_BASE_URL = '/api/admin';

    // ---- AUTENTICACIÓN ----
    const getPassword = () => sessionStorage.getItem('apiPassword');
    const setPassword = (pass) => sessionStorage.setItem('apiPassword', pass);

    async function verifyPassword(password) {
        try {
            const response = await fetch(`${API_BASE_URL}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const result = await response.json();

            if (result.success) {
                console.log("✅ Autenticación exitosa en /verify.");
                setPassword(password); // Guardamos la contraseña en la sesión
                loadInitialData(); // Cargamos los datos iniciales
            } else {
                console.error("❌ Autenticación fallida en /verify.");
                alert('Contraseña incorrecta.');
                window.location.href = '/';
            }
        } catch (error) {
            console.error("🚨 Error de red durante la verificación:", error);
            alert('Error al contactar el servidor para verificar la contraseña.');
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

    // ---- CARGA DE DATOS ----
    async function loadInitialData() {
        adminPanel.style.display = 'block';
        const currentPassword = getPassword();

        // --- INICIO DE DIAGNÓSTICO EN EL NAVEGADOR ---
        console.log("--- Intentando cargar datos iniciales (loadInitialData) ---");
        console.log(`Contraseña leída de sessionStorage: [${currentPassword}]`);
        // --- FIN DE DIAGNÓSTICO ---

        if (!currentPassword) {
            console.error("¡ERROR CRÍTICO! La contraseña no se encontró en sessionStorage. Abortando carga.");
            alert("Error de sesión. Por favor, intenta de nuevo.");
            sessionStorage.clear(); // Limpiar sesión para forzar nuevo login
            window.location.reload();
            return;
        }

        try {
            const headers = { 'Authorization': currentPassword };
            const [productsRes, categoriesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/products`, { headers }),
                fetch(`${API_BASE_URL}/categories`, { headers })
            ]);

            if (!productsRes.ok || !categoriesRes.ok) {
                // Leer el mensaje de error del servidor
                const errorData = productsRes.ok ? await categoriesRes.json() : await productsRes.json();
                throw new Error(errorData.message || 'No se pudieron cargar los datos.');
            }

            allProducts = await productsRes.json();
            allCategories = await categoriesRes.json();
            
            console.log("✅ Datos de productos y categorías cargados exitosamente.");

            renderProductsTable();
            renderCategoriesList();
            populateCategoryDropdown();
        } catch (error) {
            console.error("🚨 Error durante la carga de datos:", error.message);
            alert(`Error al cargar los datos: ${error.message}`);
        }
    }
    
    // ---- RENDERIZADO ----
    function renderProductsTable() { productsTableBody.innerHTML = ''; allProducts.forEach(product => { const categoryName = allCategories.find(c => c.id === product.category)?.name || 'Sin categoría'; const row = document.createElement('tr'); row.innerHTML = `<td><img src="/${product.image}" alt="${product.name}" width="50"></td><td>${product.name}</td><td>$${product.price.toLocaleString('es-AR')}</td><td>${product.stock}</td><td>${categoryName}</td><td><button class="btn-edit" data-id="${product.id}">Editar</button><button class="btn-delete" data-id="${product.id}">Eliminar</button></td>`; productsTableBody.appendChild(row); }); }
    function renderCategoriesList() { categoriesList.innerHTML = ''; allCategories.forEach(category => { const div = document.createElement('div'); div.className = 'category-item'; div.innerHTML = `<span>${category.name}</span><button class="btn-delete-category" data-id="${category.id}">&times;</button>`; categoriesList.appendChild(div); }); }
    function populateCategoryDropdown() { const categorySelect = document.getElementById('category'); categorySelect.innerHTML = '<option value="">Seleccionar...</option>'; allCategories.forEach(cat => { categorySelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`; }); }
    
    // ---- MODAL DE PRODUCTOS ----
    function openModal(mode, productId = null) { productForm.reset(); document.getElementById('currentImage').style.display = 'none'; document.getElementById('image').required = (mode === 'add'); if (mode === 'edit') { const product = allProducts.find(p => p.id === productId); modalTitle.textContent = 'Editar Producto'; productForm.elements['id'].value = product.id; productForm.elements['name'].value = product.name; productForm.elements['price'].value = product.price; productForm.elements['stock'].value = product.stock; productForm.elements['description'].value = product.description; productForm.elements['category'].value = product.category; const currentImage = document.getElementById('currentImage'); currentImage.src = `/${product.image}`; currentImage.style.display = 'block'; } else { modalTitle.textContent = 'Añadir Nuevo Producto'; productForm.elements['id'].value = ''; } productModal.style.display = 'block'; }
    function closeModal() { productModal.style.display = 'none'; }

    // ---- MANEJO DE EVENTOS ----
    showAddProductModalBtn.addEventListener('click', () => openModal('add'));
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => (e.target === productModal) && closeModal());
    productsTableBody.addEventListener('click', e => { const id = parseInt(e.target.dataset.id); if (e.target.classList.contains('btn-edit')) openModal('edit', id); if (e.target.classList.contains('btn-delete')) handleDeleteProduct(id); });
    productForm.addEventListener('submit', async e => { e.preventDefault(); const id = document.getElementById('productId').value; const url = id ? `${API_BASE_URL}/products/${id}` : `${API_BASE_URL}/products`; const method = id ? 'PUT' : 'POST'; try { const response = await fetch(url, { method, headers: { 'Authorization': getPassword() }, body: new FormData(productForm) }); if (!response.ok) throw new Error((await response.json()).message); closeModal(); loadInitialData(); } catch (error) { alert(error.message); } });
    async function handleDeleteProduct(id) { if (!confirm('¿Seguro que quieres eliminar este producto?')) return; try { const response = await fetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE', headers: { 'Authorization': getPassword() } }); if (!response.ok) throw new Error((await response.json()).message); loadInitialData(); } catch (error) { alert(error.message); } }
    addCategoryForm.addEventListener('submit', async e => { e.preventDefault(); const name = document.getElementById('newCategoryName').value; try { const response = await fetch(`${API_BASE_URL}/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': getPassword() }, body: JSON.stringify({ name }) }); if (!response.ok) throw new Error((await response.json()).message); addCategoryForm.reset(); loadInitialData(); } catch (error) { alert(error.message); } });
    categoriesList.addEventListener('click', async e => { if (e.target.classList.contains('btn-delete-category')) { const id = e.target.dataset.id; if (!confirm(`¿Eliminar la categoría "${id}"? No podrás si hay productos usándola.`)) return; try { const response = await fetch(`${API_BASE_URL}/categories/${id}`, { method: 'DELETE', headers: { 'Authorization': getPassword() } }); if (!response.ok) throw new Error((await response.json()).message); loadInitialData(); } catch (error) { alert(error.message); } } });
    
    // ---- INICIO ----
    if (getPassword()) {
        verifyPassword(getPassword());
    } else {
        promptForPassword();
    }
});