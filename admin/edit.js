// --- START OF FILE edit.js ---
document.addEventListener('DOMContentLoaded', () => {
    const editProductForm = document.getElementById('editProductForm');
    const productIdInput = document.getElementById('productId');
    const currentImage = document.getElementById('currentImage');

    // Obtener el ID del producto desde la URL (ej: edit.html?id=123)
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    if (!productId) {
        alert('ID de producto no encontrado.');
        window.location.href = 'admin.html';
        return;
    }

    // Función para obtener la contraseña guardada
    const getPassword = () => sessionStorage.getItem('apiPassword');

    // Cargar los datos del producto existente
    async function loadProductData() {
        const password = getPassword();
        if (!password) {
            alert('Contraseña no encontrada. Por favor, ingrésala en el panel principal.');
            window.location.href = 'admin.html';
            return;
        }

        try {
            // ===================== CAMBIO REALIZADO AQUÍ =====================
            // La ruta ahora apunta a la API de admin protegida
            const response = await fetch(`/api/admin/products/${productId}`, {
            // ===================== FIN DEL CAMBIO ==========================
                headers: { 'Authorization': password }
            });

            if (!response.ok) {
                throw new Error('No se pudo cargar la información del producto.');
            }
            const product = await response.json();
            
            // Llenar el formulario con los datos del producto
            productIdInput.value = product.id;
            document.getElementById('name').value = product.name;
            document.getElementById('description').value = product.description;
            document.getElementById('price').value = product.price;
            document.getElementById('stock').value = product.stock;
            document.getElementById('category').value = product.category;
            currentImage.src = `/${product.image}`;

        } catch (error) {
            alert(error.message);
        }
    }

    // Manejar el envío del formulario de edición
    editProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = getPassword();
        if (!password) {
            alert('Contraseña no encontrada. No se pueden guardar los cambios.');
            return;
        }
        
        const formData = new FormData(editProductForm);
        
        try {
            // ===================== CAMBIO REALIZADO AQUÍ =====================
            // La ruta ahora apunta a la API de admin protegida
            const response = await fetch(`/api/admin/products/${productId}`, {
            // ===================== FIN DEL CAMBIO ==========================
                method: 'PUT',
                headers: { 'Authorization': password },
                body: formData
            });

            if (!response.ok) {
                throw new Error('Error al actualizar el producto.');
            }
            
            alert('¡Producto actualizado con éxito!');
            window.location.href = 'admin.html'; // Redirigir de vuelta al panel principal
        } catch (error) {
            alert(error.message);
        }
    });

    // Cargar los datos al iniciar
    loadProductData();
});
// --- END OF FILE edit.js ---