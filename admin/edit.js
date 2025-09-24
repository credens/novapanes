document.addEventListener('DOMContentLoaded', () => {
    const editForm = document.getElementById('editForm');
    let password = '';
    let productId = null;

    // 1. Obtener la contraseña y el ID del producto de la URL
    function initialize() {
        password = prompt("Por favor, ingresa la contraseña de administrador:", "");
        if (!password) {
            document.body.innerHTML = '<h1>Acceso denegado. Se requiere contraseña.</h1>';
            return;
        }

        const params = new URLSearchParams(window.location.search);
        productId = params.get('id');
        if (!productId) {
            document.body.innerHTML = '<h1>Error: No se especificó un ID de producto.</h1>';
            return;
        }
        
        loadProductData();
    }

    // 2. Cargar los datos del producto desde el servidor
    async function loadProductData() {
        try {
            const response = await fetch(`/api/products/${productId}`, {
                headers: { 'Authorization': password }
            });
            if (!response.ok) throw new Error('No se pudo cargar el producto.');
            
            const product = await response.json();
            
            // Rellenar el formulario con los datos
            document.getElementById('name').value = product.name;
            document.getElementById('description').value = product.description;
            document.getElementById('price').value = product.price;
            document.getElementById('stock').value = product.stock;
            document.getElementById('category').value = product.category;
            document.getElementById('currentImage').src = `../public/${product.image}`;
            
        } catch (error) {
            alert(error.message);
        }
    }

    // 3. Enviar el formulario actualizado
    editForm.addEventListener('submit', async (e) => {
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
            const response = await fetch(`/api/products/${productId}`, {
                method: 'PUT',
                headers: { 'Authorization': password },
                body: formData
            });

            if (!response.ok) throw new Error('No se pudo actualizar el producto.');
            
            alert('¡Producto actualizado con éxito!');
            window.location.href = 'admin.html'; // Redirigir de vuelta al panel
            
        } catch (error) {
            alert(error.message);
        }
    });

    initialize();
});