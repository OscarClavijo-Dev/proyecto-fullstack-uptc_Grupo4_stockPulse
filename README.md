# StockPulse: Control de Inventario y Reabastecimiento

Solución web estática (sin backend intermedio ni paso de compilación) para la gestión de inventario en tiempo real, prevención de quiebres de stock y automatización de alertas a proveedores. Construida con HTML5, Tailwind CSS, JavaScript ES Modules, Supabase (PostgreSQL, Realtime, RPC) y Webhooks de N8N.

Diseñada con enfoque **Mobile-First** y optimizada ergonómicamente para **Tablets de bodega** (zonas táctiles $\ge 44\text{ px}$ y desplazamiento horizontal controlado).

---

## 🚀 Configuración Rápida

La aplicación está diseñada para no requerir ningún build (`npm run build` o Webpack/Vite). Toda la configuración de servicios externos se gestiona exclusivamente en el archivo `js/config.js`.

### 1. Editar `js/config.js`

Abre el archivo [js/config.js](file:///c:/Users/oscar/Documents/Archivos%20Oscar_Universidad_cursos/UPTC%203%20Semestre%20TPSI/Landing%20page%20electiva/proyecto-fullstack-uptc_Grupo4_stockPulse/js/config.js) y reemplaza los tres placeholders por tus credenciales:

```javascript
// js/config.js

// 1. URL de tu proyecto en Supabase (Settings > API > Project URL)
export const SUPABASE_URL = "https://tu-proyecto.supabase.co";

// 2. Clave pública anónima de Supabase (Settings > API > Project API keys > anon public)
// NUNCA uses la service_role key en el frontend.
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

// 3. Endpoint de tu Webhook en N8N (nodo Webhook en modo POST)
export const N8N_WEBHOOK_URL = "https://tu-instancia-n8n.com/webhook/stock-alert";
```

> [!IMPORTANT]
> **Seguridad**: Usa siempre la clave `anon` pública. Las políticas de Row Level Security (RLS) y las funciones RPC en Supabase se encargan de proteger la integridad de los datos.

---

## 📦 Estructura del Proyecto

```text
proyecto-fullstack-uptc_Grupo4_stockPulse/
├── index.html              # Interfaz de usuario responsiva (Tailwind CSS vía CDN)
├── README.md               # Instrucciones de configuración y despliegue
└── js/
    ├── config.js           # Variables de conexión y constantes del sistema
    ├── supabaseClient.js   # Inicialización del SDK Supabase v2 (@supabase/supabase-js)
    ├── inventarioService.js# Operaciones CRUD, llamada RPC y canales Realtime
    ├── webhookClient.js    # Cliente HTTP para N8N con AbortController (timeout 8s)
    ├── ui.js               # Renderizado del DOM, KPIs, Toasts y validación inline
    └── main.js             # Orquestador del ciclo de vida y eventos de la aplicación
```

---

## ⚙️ Características Implementadas

1. **KPIs en tiempo real**:
   - Total de referencias registradas.
   - Productos críticos (cuando `stock_actual <= stock_minimo`) con resaltado visual.
   - Contador de alertas emitidas hacia proveedores.

2. **Registro de Productos**:
   - Formulario modal con validación estricta en el DOM (SKU único, valores enteros no negativos, formato de correo de proveedor).
   - Inserción directa en `inventario_productos` con Supabase SDK.

3. **Tabla de Inventario Sincronizada (Supabase Realtime)**:
   - Filtro reactivo por búsqueda (SKU o nombre) y selector por bodega.
   - Resaltado en **ROJO** y badge interactivo **`CRÍTICO`** cuando el producto cae en o por debajo del umbral mínimo de seguridad.
   - Botones táctiles de **Entrada** y **Salida** con áreas táctiles $\ge 44\text{ px}$.

4. **Transacciones Atómicas vía RPC y Automatización N8N**:
   - Cada movimiento ejecuta la función atómica `registrar_movimiento` en PostgreSQL mediante `supabase.rpc(...)`.
   - Si una salida excede el stock disponible, la base de datos aborta la transacción y la UI presenta un mensaje claro sin alterar los datos.
   - Tras registrar con éxito la salida o entrada, se despacha un `POST` al Webhook de N8N con un timeout de **8 segundos** usando `AbortController`.
   - **Payload exacto transmitido al Webhook:**
     ```json
     {
       "evento": "actualizacion_stock",
       "producto_id": "UUID",
       "sku": "SKU-001",
       "nombre_producto": "Nombre del Producto",
       "bodega": "Bodega Principal",
       "stock_actual": 4,
       "stock_minimo": 10,
       "proveedor_email": "proveedor@empresa.com",
       "tipo_movimiento": "SALIDA",
       "cantidad": 6,
       "timestamp": "2026-11-18T15:30:00.000Z"
     }
     ```
   - Si el webhook responde exitosamente, se muestra un Toast con el contenido del campo `clasificacion`.
   - Si el webhook falla o se agota el tiempo de espera, se emite una **notificación amarilla de advertencia** indicando que el stock fue guardado de manera segura en la base de datos pero el webhook no respondió a tiempo.

5. **Historial de Alertas de Reabastecimiento**:
   - Tabla conectada en tiempo real a `alertas_reabastecimiento`, ordenada por fecha descendente.

---

## 🧪 Pruebas y Criterios de Aceptación

Para verificar el correcto funcionamiento del sistema:

1. **Crear Productos**:
   - Pulsa en **"Nuevo Producto"** y da de alta 3 referencias. Verifica que se listen de inmediato en la tabla y los KPIs se actualicen sin recargar la página.
2. **Salida a Nivel Crítico**:
   - En una fila, pulsa el botón **"Salida"** y retira una cantidad que deje el stock igual o menor al stock mínimo.
   - La fila cambiará a fondo rojo con el badge parpadeante `CRÍTICO`, y se disparará la notificación al Webhook de N8N.
3. **Validación de Stock Insuficiente**:
   - Intenta registrar una salida superior al stock actual disponible.
   - La interfaz mostrará un error claro en el DOM y la base de datos impedirá la operación.
4. **Resiliencia ante Desconexión de N8N**:
   - Si N8N está inactivo o supera los 8 segundos de espera, la aplicación mostrará un Toast amarillo advirtiendo el estado, confirmando que la base de datos sí fue actualizada.

---

## 🌐 Despliegue en Vercel

Al tratarse de una aplicación web estática:

1. Sube este repositorio a GitHub / GitLab.
2. Importa el repositorio en [Vercel](https://vercel.com).
3. Selecciona el framework preset **Other** (o déjalo en blanco).
4. Haz clic en **Deploy**. ¡Listo para usar desde cualquier tablet o navegador!
