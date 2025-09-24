// ===================================================
//      ARCHIVO admin.js (VERSIÓN CON SESIONES)
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    const productForm = document.getElementById('productForm');
    const productsTableBody = document.getElementById('productsTableBody');
    // Ya no se guarda la contraseña en una variable global.

    /**
     * Esta es la función principal que se ejecuta al cargar la página.
     * Intenta obtener los productos. Si tiene éxito, significa que ya hay una sesión activa.
     * Si falla, le pide la contraseña al usuario.
     */
    function initialAuth() {
        fetchProducts().catch(() => {
            promptForPassword();
        });
    }

    /**
     * Muestra un diálogo para que el usuario ingrese la contraseña.
     * Si la ingresa, llama a la función de login.
     */
    function promptForPassword() {
        const password = prompt("Por favor, ingresa la contraseña de administrador:", "");
        if (password) {
            login(password);
        } else {
            document.body.innerHTML = '<h1>Acceso denegado. Se requiere contraseña.</h1>';
        }
    }

    /**
     * Envía la contraseña al servidor para intentar iniciar sesión.
     * Si el servidor responde OK, la sesión se crea y cargamos los productos.
     * @param {string} password - La contraseña ingresada por el usuario.
     */
    async function login(password) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password }) // Envía la contraseña en el cuerpo
            });

            if (!response.ok) throw new Error('Contraseña incorrecta.');
            
            // Si el login es exitoso, ahora sí cargamos los productos.
            // El servidor ya nos ha dado una cookie de sesión.
            fetchProducts();

        } catch (error) {
            alert(error.message);
            document.body.innerHTML = '<h1>Acceso denegado. Contraseña incorrecta.</h1>';
        }
    }

    /**
     * Obtiene la lista de productos del servidor.
     * Ya no necesita enviar la contraseña, el navegador envía la cookie de sesión automáticamente.
     */
    async function fetchProducts() {
        try {
            // Ya no se envía la cabecera 'Authorization'.
            const response = await fetch('/api/products');
            
            if (response.status === 403) {
                 throw new Error('No autorizado. La sesión puede haber expirado.');
            }
            if (!response.ok) {
                throw new Error('Error del servidor al obtener productos.');
            }
            
            const products = await response.json();
            renderProducts(products);
        } catch (error) {
            console.error("Error al obtener productos:", error.message);
            // Propagamos el error para que initialAuth() lo capture y pida la contraseña.
            throw error; 
        }
    }

    /**
     * Dibuja los productos en la tabla del HTML.
     * (Esta función no ha cambiado).
     */
    function renderProducts(products) {
        productsTableBody.innerHTML = '';
        products.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><img src="../frontend/${product.image}" alt="${product.name}" style="width: 50px; height: 50px; object-fit: cover;"></td>
                <td>${product.name}</td>
                <td>$${product.price}</td>
                <td>${product.stock}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct(${product.id})">Eliminar</button>
                </td>
            `;
            productsTableBody.appendChild(row);
        });
    }

    /**
     * Listener para el formulario de agregar un nuevo producto.
     */
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData();
        formData.append('name', document.getElementById('name').value);
        formData.append('description', document.getElementById('description').value);
        formData.append('price', document.getElementById('price').value);
        formData.append('stock', document.getElementById('stock').value);
        formData.append('category', document.getElementById('category').value);
        
        const imageFile = document.getElementById('image').files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }

        try {
            // Ya no se envía la cabecera 'Authorization'.
            const response = await fetch('/api/products', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('No se pudo guardar el producto.');
            
            productForm.reset();
            fetchProducts();
        } catch (error) {
            alert(error.message);
        }
    });

    /**
     * Función global para eliminar un producto.
     * Se llama desde los botones en la tabla.
     */
    window.deleteProduct = async (id) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este producto?')) return;

        try {
             // Ya no se envía la cabecera 'Authorization'.
            const response = await fetch(`/api/products/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('No se pudo eliminar el producto.');
            
            fetchProducts();
        } catch (error) {
            alert(error.message);
        }
    };

    // Inicia todo el proceso de autenticación al cargar la página.
    initialAuth();
});