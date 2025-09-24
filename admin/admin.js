document.addEventListener('DOMContentLoaded', () => {
    const addProductForm = document.getElementById('addProductForm');
    const productsTableBody = document.getElementById('productsTableBody');
    const apiPasswordInput = document.getElementById('apiPassword');
    const savePasswordBtn = document.getElementById('savePasswordBtn');

    // Función para obtener la contraseña guardada en la sesión del navegador
    const getPassword = () => sessionStorage.getItem('apiPassword');

    // Guardar la contraseña en la sesión
    savePasswordBtn.addEventListener('click', () => {
        const pass = apiPasswordInput.value;
        if (pass) {
            sessionStorage.setItem('apiPassword', pass);
            alert('Contraseña guardada para esta sesión.');
            loadProducts();
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
            const response = await fetch('/api/products', {
                headers: { 'Authorization': password }
            });

            if (response.status === 403) {
                throw new Error('Contraseña incorrecta.');
            }
            if (!response.ok) {
                throw new Error('Error al cargar los productos.');
            }
            const products = await response.json();
            
            productsTableBody.innerHTML = ''; // Limpiar la tabla antes de llenarla
            products.forEach(product => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><img src="/${product.image}" alt="${product.name}" width="50"></td>
                    <td>${product.name}</td>
                    <td>$${product.price}</td>
                    <td>${product.stock}</td>
                    <td>
                        <a href="edit.html?id=${product.id}" class="btn-edit">Editar</a>
                        <button class="btn-delete" data-id="${product.id}">Eliminar</button>
                    </td>
                `;
                productsTableBody.appendChild(row);
            });
        } catch (error) {
            productsTableBody.innerHTML = `<tr><td colspan="5" class="error">${error.message}</td></tr>`;
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

        const formData = new FormData(addProductForm);
        
        try {
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Authorization': password },
                body: formData
            });

            if (!response.ok) {
                throw new Error('Error al crear el producto. ¿Contraseña correcta?');
            }
            
            addProductForm.reset();
            loadProducts(); // Recargar la lista de productos
        } catch (error) {
            alert(error.message);
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
            
            if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
                try {
                    const response = await fetch(`/api/products/${productId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': password }
                    });

                    if (!response.ok) {
                        throw new Error('No se pudo eliminar el producto.');
                    }
                    
                    loadProducts(); // Recargar la lista de productos
                } catch (error) {
                    alert(error.message);
                }
            }
        }
    });

    // Cargar los productos al iniciar la página
    loadProducts();
});