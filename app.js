document.addEventListener('DOMContentLoaded', function() {
    const messageDiv = document.getElementById('message');

    // Array para almacenar los mensajes de log en la interfaz
    const logs = [];

    // Función para añadir mensajes a la interfaz y a la consola del navegador
    function addLogMessage(msg, type = '') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `<span class="${type}">[${timestamp}] ${msg}</span>`;
        logs.push(logEntry);
        // Limita el número de logs para evitar sobrecarga de la interfaz
        if (logs.length > 25) { // Mantener los últimos 25 logs
            logs.shift(); // Elimina el log más antiguo del array
        }
        messageDiv.innerHTML = logs.join('<br>');
        messageDiv.scrollTop = messageDiv.scrollHeight; // Auto-scroll al final
        console.log(`[${timestamp}] ${msg}`); // También imprime en la consola del navegador
    }

    addLogMessage('Aplicación cargada. Verificando el entorno Bitrix24...', 'info');

    // --- Verificación del SDK de Bitrix24 ---
    // Es crucial que el objeto BX24 y sus métodos estén disponibles
    if (typeof BX24 === 'undefined' || typeof BX24.callMethod === 'undefined' || typeof BX24.placement === 'undefined') {
        console.error('Error crítico: El SDK de Bitrix24 (BX24) no se cargó correctamente o está incompleto.');
        addLogMessage('Error: El SDK de Bitrix24 no está disponible. Asegúrate de que la app está en un entorno Bitrix24 y el script //api.bitrix24.com/api/v1/ se cargó.', 'error');
        return; // Detener la ejecución si BX24 no está listo
    }

    // --- Obtener información del Placement ---
    // Esto nos indica si estamos dentro de un Placement y en qué entidad (ej. Negociación)
    BX24.placement.info(function(placementInfo) {
        if (placementInfo && placementInfo.options && placementInfo.options.entityId) {
            const dealId = placementInfo.options.entityId;
            addLogMessage(`App incrustada en Negociación con ID: <span class="info">${dealId}</span>`, 'success');
            addLogMessage('Preparado para escuchar cambios en los productos...', 'info');

            // --- Vincular el evento 'onProductRowChange' ---
            // Esto le dice a Bitrix24 que cada vez que el evento 'onProductRowChange' ocurra,
            // debe llamar a la función 'productRowChangeHandler' en esta aplicación (iframe).
            BX24.callMethod(
                'placement.bind',
                {
                    event: 'onProductRowChange',
                    handler: 'productRowChangeHandler' // Nombre de la función JS global a la que Bitrix24 llamará
                },
                function(result) {
                    if (result.error()) {
                        console.error('Error al intentar vincular onProductRowChange:', result.error());
                        addLogMessage(`Error al vincular el evento onProductRowChange: <span class="error">${result.error().error_description || result.error().error}</span>`, 'error');
                    } else {
                        addLogMessage('Evento "onProductRowChange" vinculado con éxito. Ahora, ve a la pestaña "Productos" de esta Negociación y haz cambios.', 'success');
                    }
                }
            );

            // --- Función Manejadora del Evento 'onProductRowChange' ---
            // ¡IMPORTANTE!: Esta función debe ser una propiedad del objeto global 'window'
            // para que Bitrix24 pueda invocarla desde el contexto del iframe.
            window.productRowChangeHandler = function(command, params) {
                console.group('Evento onProductRowChange Disparado');
                console.log('Comando (tipo de cambio):', command); // Ej: "rowAdded", "rowUpdated", "rowDeleted"
                console.log('Parámetros recibidos del evento:', params); // Contiene el array 'products'

                addLogMessage(`Evento 'onProductRowChange' detectado! Comando: <span class="info">${command}</span>`, 'info');
                
                // Asegúrate de que los parámetros contienen un array de productos
                if (params && params.products && Array.isArray(params.products)) {
                    addLogMessage(`Productos actuales en la Negociación (<span class="info">${params.products.length}</span>):`, 'success');
                    
                    // --- Iterar sobre cada producto para procesarlo ---
                    params.products.forEach((product) => {
                        // Aquí obtienes los datos que Bitrix24 te proporciona para cada producto
                        const productIdBitrix = product.ID; // ID interno del producto en Bitrix24
                        const productName = product.PRODUCT_NAME;
                        const quantityInDeal = product.QUANTITY;
                        const priceInDeal = parseFloat(product.PRICE); // Convertir a número para cálculos si es necesario
                        const currency = product.CURRENCY_ID; // Moneda del producto

                        // CORRECCIÓN AQUÍ: Había un doble '${' en priceInDeal
                        addLogMessage(`- <span class="product-info">ID: ${productIdBitrix}, Nombre: ${productName}, Cant: ${quantityInDeal}, Precio: ${priceInDeal} ${currency}</span>`, 'info');

                        // --- PASO CLAVE: Llamada a tu API Externa ---
                        // Aquí es donde integrarías tu lógica para consultar tu API externa
                        // para obtener datos adicionales como stock o precios actualizados.
                        // Usamos productIdBitrix como un ID externo de ejemplo.
                        
                        callExternalAPIForProductInfo(productIdBitrix, (externalPrice, externalStock) => {
                            if (externalPrice !== null && externalStock !== null) {
                                addLogMessage(`   -> API Externa para ID <span class="info">${productIdBitrix}</span>: Precio: <span class="success">${externalPrice}</span>, Stock: <span class="success">${externalStock}</span>`, 'success');
                                // Aquí podrías añadir lógica para comparar precios, stock, etc.
                                // Por ejemplo: if (priceInDeal != externalPrice) addLogMessage('¡Advertencia: Precio diferente!', 'error');
                            } else {
                                addLogMessage(`   -> API Externa: Falló la obtención de info para ID <span class="info">${productIdBitrix}</span>.`, 'error');
                            }
                        });
                    });

                } else {
                    addLogMessage('No se encontraron datos de productos válidos en el evento. Formato inesperado.', 'error');
                }
                console.groupEnd(); // Finaliza el grupo en la consola
            };

            // --- Función de Ejemplo para Llamar a tu API Externa ---
            // DEBES PERSONALIZAR esta función con la URL, métodos, headers, y lógica de tu API real.
            function callExternalAPIForProductInfo(productIdExternal, callback) {
                // *** Reemplaza con la URL REAL de tu API externa ***
                // Para pruebas, puedes usar una URL que siempre devuelva una respuesta simulada o un mock server.
                // Ejemplo con un mock JSON (puedes crear un archivo .json en tu GitHub Pages)
                const EXTERNAL_API_URL = `https://tu-usuario.github.io/tu-repositorio/mock_product_data.json`; // <-- Ejemplo con mock
                // O un endpoint real: `https://tu-api-externa.com/api/products/${productIdExternal}/details`;
                
                // *** Configura tus opciones de fetch según tu API ***
                const requestOptions = {
                    method: 'GET', // O 'POST', 'PUT', etc.
                    headers: {
                        'Content-Type': 'application/json',
                        // 'Authorization': 'Bearer TU_API_KEY_AQUI' // Si tu API externa requiere autenticación
                    },
                    // body: JSON.stringify({ /* si tu API requiere un cuerpo en la solicitud */ })
                };

                fetch(EXTERNAL_API_URL, requestOptions)
                    .then(response => {
                        if (!response.ok) {
                            // Si la respuesta HTTP no es 2xx, lanza un error
                            console.error(`HTTP Error: ${response.status} ${response.statusText} for ${EXTERNAL_API_URL}`);
                            throw new Error(`Error en la respuesta de la API externa: ${response.status}`);
                        }
                        return response.json(); // Parsea la respuesta como JSON
                    })
                    .then(data => {
                        // *** Adapta esto a la estructura de la respuesta de tu API externa ***
                        // Para el mock, asumimos un array de productos, y buscamos el que coincide.
                        const productData = data.find(p => p.id == productIdExternal); // <-- Adaptado para mock_product_data.json
                        if (productData) {
                            const price = productData.price || null;
                            const stock = productData.stock || null;
                            callback(price, stock); // Llama al callback con los datos obtenidos
                        } else {
                            addLogMessage(`Producto ID ${productIdExternal} no encontrado en la API externa (mock).`, 'error');
                            callback(null, null);
                        }
                    })
                    .catch(error => {
                        console.error(`Error al llamar a la API externa para ID ${productIdExternal}:`, error);
                        addLogMessage(`Error en API Externa para ID <span class="info">${productIdExternal}</span>: <span class="error">${error.message}</span>`, 'error');
                        callback(null, null); // Llama al callback con null en caso de error
                    });
            }

        } else {
            // Mensaje si la aplicación no está en un Placement de detalle de Negociación
            addLogMessage('Esta aplicación no está en un Placement válido (ej. CRM_DEAL_DETAIL_TAB). Por favor, configúrala como tal en Bitrix24.', 'error');
        }
    });
});