// --- START OF FILE admin.js ---
document.addEventListener('DOMContentLoaded', () => {
    const addProductForm = document.getElementById('addProductForm');
    const productsTableBody = document.getElementById('productsTableBody');
    const apiPasswordInput = document.getElementById('apiPassword');
    const savePasswordBtn = document.getElementById('savePasswordBtn');

    // CAMBIADO: Ruta base para las operaciones de CRUD de admin, según server.js
    const API_BASE_URL = '/api/admin/products'; 

    // Función para obtener la contraseña guardada en la sesión del navegador
    const getPassword = () => sessionStorage.getItem('apiPassword');

    // Guardar la contraseña en la sesión
    savePasswordBtn.addEventListener('click', () => {
        const pass = apiPasswordInput.value;
        if (pass) {
            sessionStorage.setItem('apiPassword', pass);
            alert('Contraseña guardada para esta sesión.');
            apiPasswordInput.value = ''; // Limpiar el input después de guardar
            loadProducts(); // Intentar cargar productos inmediatamente
        } else {
            alert('Por favor, introduce una contraseña.');
        }
    });

    // Función para cargar y mostrar los productos
    async function loadProducts() {
        const password = getPassword();
        if (!password) {
            productsTableBody.innerHTML = '<tr><td colspan="5">Por favor, introduce la contraseña de la API para ver los productos.</td></tr>';
            return;
        }

        try {
            const response = await fetch(API_BASE_URL, {
                headers: { 'Authorization': password }
            });

            if (response.status === 401 || response.status === 403) {
                const errorData = await response.json();
                productsTableBody.innerHTML = `<tr><td colspan="5" class="error">${errorData.message || 'Contraseña de API incorrecta o no autorizada.'}</td></tr>`;
                // Opcional: limpiar la contraseña guardada para forzar reingreso
                // sessionStorage.removeItem('apiPassword');
                throw new Error(errorData.message || 'Autenticación fallida.'); // Lanza para que el catch capture y no siga procesando
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al cargar los productos del servidor.');
            }
            const products = await response.json();
            
            productsTableBody.innerHTML = ''; // Limpiar la tabla antes de llenarla
            if (products.length === 0) {
                productsTableBody.innerHTML = '<tr><td colspan="5">No hay productos para mostrar. Añade uno usando el formulario de arriba.</td></tr>';
                return;
            }

            products.forEach(product => {
                const row = document.createElement('tr');
                // Asegúrate de que la ruta de la imagen sea correcta.
                // Si 'image' ya viene como "productos/nombre.jpg", entonces la base es "/" que es public.
                row.innerHTML = `
                    <td><img src="/${product.image}" alt="${product.name}" width="50"></td>
                    <td>${product.name}</td>
                    <td>$${product.price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>${product.stock}</td>
                    <td>
                        <!-- ===================== CAMBIO REALIZADO AQUÍ ===================== -->
                        <!-- Se reemplazó el botón con una alerta por un enlace funcional -->
                        <a href="edit.html?id=${product.id}" class="btn-edit">Editar</a>
                        <!-- ===================== FIN DEL CAMBIO ========================== -->
                        <button class="btn-delete" data-id="${product.id}">Eliminar</button>
                    </td>
                `;
                productsTableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error en loadProducts:', error);
            if (!productsTableBody.innerHTML.includes('error')) { // Evita duplicar mensajes de error si ya hay uno
                productsTableBody.innerHTML = `<tr><td colspan="5" class="error">Error: ${error.message}. Por favor, verifica la consola para más detalles.</td></tr>`;
            }
        }
    }

    // Manejar el envío del formulario para añadir un nuevo producto
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = getPassword();
        if (!password) {
            alert('Por favor, guarda la contraseña de la API antes de añadir un producto.');
            return;
        }

        const submitButton = addProductForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.textContent = 'Añadiendo...';
        submitButton.disabled = true;

        const formData = new FormData(addProductForm);
        
        try {
            const response = await fetch(API_BASE_URL, {
                method: 'POST',
                headers: { 'Authorization': password },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al crear el producto. Verifica que la contraseña de API sea correcta y todos los campos estén llenos.');
            }
            
            addProductForm.reset();
            loadProducts(); // Recargar la lista de productos
            alert('Producto añadido correctamente.');
        } catch (error) {
            alert(error.message);
        } finally {
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
        }
    });

    // Manejar clics en los botones de eliminar (usando delegación de eventos)
    productsTableBody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-delete')) {
            const productId = e.target.dataset.id;
            const password = getPassword();

            if (!password) {
                alert('Por favor, guarda la contraseña de la API para eliminar productos.');
                return;
            }
            
            if (confirm('¿Estás seguro de que quieres eliminar este producto? Esto también eliminará su imagen asociada.')) {
                try {
                    const response = await fetch(`${API_BASE_URL}/${productId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': password }
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'No se pudo eliminar el producto.');
                    }
                    
                    loadProducts(); // Recargar la lista de productos
                    alert('Producto eliminado correctamente.');
                } catch (error) {
                    alert(error.message);
                }
            }
        }
    });

    // Cargar los productos al iniciar la página
    loadProducts();
});
// --- END OF FILE admin.js ---