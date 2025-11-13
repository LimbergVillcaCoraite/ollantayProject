# 📴 Sistema Offline-First con IndexedDB

## Descripción General

Sistema de cola de acciones offline que permite al usuario seguir trabajando sin conexión a internet. Las acciones se guardan localmente en IndexedDB y se sincronizan automáticamente cuando la conexión se restaura.

## Arquitectura

### Componentes Principales

1. **`offlineQueue.js`** - Gestor de cola con IndexedDB
2. **`OfflineStatus.jsx`** - Indicador visual de estado
3. **Service Worker** - Cache de assets (existente)

### Flujo de Trabajo

```
Usuario realiza acción
        ↓
¿Hay conexión?
   ↙        ↘
 SÍ         NO
  ↓          ↓
Enviar   Guardar en
directo   IndexedDB
           ↓
    Esperar conexión
           ↓
    Sincronizar auto
```

## OfflineQueueManager

### Inicialización

```javascript
import offlineQueue from './utils/offlineQueue';

// El manager se inicializa automáticamente
// Crea la base de datos 'ollantay_offline_db'
```

### Base de Datos IndexedDB

**Nombre:** `ollantay_offline_db`  
**Versión:** 1  
**Object Store:** `action_queue`

**Índices:**
- `timestamp` - Fecha de creación
- `action` - Tipo de acción
- `status` - Estado (pending/failed)

### Estructura de Acción

```javascript
{
  id: 1,                          // Auto-increment
  action: "crear_venta",          // Tipo de acción
  endpoint: "http://...",         // URL del API
  method: "POST",                 // HTTP method
  data: {...},                    // Payload
  headers: {...},                 // Headers adicionales
  timestamp: 1699876543210,       // Unix timestamp
  status: "pending",              // pending | failed
  retries: 0,                     // Contador de reintentos
  maxRetries: 3                   // Máximo de reintentos
}
```

## Uso del Sistema

### Método 1: Helper `offlineFetch`

```javascript
import { offlineFetch } from './utils/offlineQueue';

// Usar como fetch normal
const result = await offlineFetch({
  type: 'crear_venta',
  endpoint: 'http://localhost:8004/api/ventas',
  method: 'POST',
  data: {
    idCliente: 123,
    total: 500.00,
    productos: [...]
  }
});

// Si hay conexión: respuesta normal del servidor
// Si no hay conexión: { queued: true, message: "..." }
```

### Método 2: Encolar Manualmente

```javascript
import offlineQueue from './utils/offlineQueue';

await offlineQueue.enqueue({
  type: 'actualizar_persona',
  endpoint: 'http://localhost:8002/api/personas/123',
  method: 'PUT',
  data: {
    nombre: 'Juan Pérez',
    telefono: '987654321'
  }
});
```

## Eventos de Conexión

### Manejo Automático

El sistema escucha automáticamente:

```javascript
// Conexión restaurada
window.addEventListener('online', () => {
  // Se ejecuta automáticamente:
  // - Notificación de "Conexión restaurada"
  // - Sincronización de cola pendiente
});

// Conexión perdida
window.addEventListener('offline', () => {
  // Se ejecuta automáticamente:
  // - Notificación de "Sin conexión"
  // - Modo offline activado
});
```

### Sincronización Manual

```javascript
import offlineQueue from './utils/offlineQueue';

// Forzar sincronización
await offlineQueue.syncQueue();

// Obtener estadísticas
const stats = await offlineQueue.getQueueStats();
// { total: 5, pending: 3, failed: 2 }

// Limpiar acciones fallidas
await offlineQueue.clearFailedActions();
```

## Componente OfflineStatus

### Integración en App.jsx

```jsx
import OfflineStatus from './components/OfflineStatus';

// Dentro del return
{loggedUser && <OfflineStatus dark={dark} />}
```

### Features del Componente

**Badge de Estado:**
- 🟢 Verde: Online, sin acciones pendientes
- 🟡 Amarillo: Online, con acciones pendientes
- 🔴 Rojo (pulsante): Offline, modo encolado activo

**Panel de Detalles (click en badge):**
- Estadísticas en tiempo real
- Contador de acciones pendientes
- Contador de acciones fallidas
- Botón "Sincronizar Ahora"
- Botón "Limpiar Fallidas"

**Actualización Automática:**
- Stats se actualizan cada 5 segundos
- Reacciona a eventos de conexión en tiempo real

## Sistema de Reintentos

### Política de Reintentos

1. **Primera ejecución:** Al sincronizar
2. **Reintento 1:** Si falla, se marca reintento
3. **Reintento 2:** Segunda oportunidad
4. **Reintento 3:** Última oportunidad
5. **Si falla 3 veces:** Se marca como `failed`

### Eliminación de Acciones Fallidas

- Usuario puede limpiarlas manualmente desde UI
- Se mantienen en BD hasta que se limpien
- No bloquean la sincronización de otras acciones

## Casos de Uso

### 1. Registro de Venta sin Conexión

```javascript
// En componente Ventas.jsx
const handleCreateVenta = async (ventaData) => {
  try {
    const result = await offlineFetch({
      type: 'crear_venta',
      endpoint: `${API_VENTAS}`,
      method: 'POST',
      data: ventaData
    });
    
    if (result.queued) {
      showToast('Venta guardada. Se enviará cuando vuelva la conexión.', 'warning');
    } else {
      showToast('Venta creada exitosamente', 'success');
    }
  } catch (error) {
    showToast('Error al crear venta', 'error');
  }
};
```

### 2. Actualización de Persona Offline

```javascript
// En componente Personas.jsx
const handleUpdatePersona = async (id, personaData) => {
  const result = await offlineFetch({
    type: 'actualizar_persona',
    endpoint: `${API_PERSONAS}/${id}`,
    method: 'PUT',
    data: personaData,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (result.queued) {
    // Actualizar UI optimísticamente
    setPersonas(prev => prev.map(p => 
      p.id_persona === id ? {...p, ...personaData} : p
    ));
  }
};
```

### 3. Registro de Compra Offline

```javascript
// En componente Compras.jsx
await offlineFetch({
  type: 'crear_compra',
  endpoint: `${API_COMPRAS}`,
  method: 'POST',
  data: {
    idProveedor: proveedor.id,
    productos: [...],
    total: calcularTotal()
  }
});
```

## Integración con Service Worker

### Cache First Strategy (Existente)

```javascript
// public/service-worker.js
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

### Background Sync (Opcional - Futuro)

```javascript
// Registrar background sync cuando se encola
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});
```

## Notificaciones al Usuario

### Tipos de Notificaciones

1. **Conexión perdida:**
   - "Sin conexión"
   - "Las acciones se guardarán localmente"
   - Tipo: `warning`

2. **Conexión restaurada:**
   - "Conexión restaurada"
   - "Sincronizando datos pendientes..."
   - Tipo: `success`

3. **Acción encolada:**
   - "Acción guardada"
   - "{acción} se sincronizará cuando vuelva la conexión"
   - Tipo: `info`

4. **Sincronización completa:**
   - "Sincronización completa"
   - "{N} acciones sincronizadas"
   - Tipo: `success`

### Integración con Toast System

```javascript
// offlineQueue.js usa window.showToast si está disponible
if (window.showToast) {
  window.showToast(message, type);
} else {
  console.log(`[${type}] ${message}`);
}
```

## Limitaciones y Consideraciones

### Limitaciones Técnicas

⚠️ **Tamaño de IndexedDB:**
- Chrome/Edge: ~60% del espacio en disco disponible
- Firefox: ~50% del espacio en disco
- Safari: ~1 GB

⚠️ **Sincronización:**
- No es instantánea (5 segundos de polling)
- Requiere que el usuario mantenga la pestaña abierta
- Background Sync API no está implementado aún

⚠️ **Conflictos:**
- No hay resolución automática de conflictos
- Si el servidor rechaza datos obsoletos, quedan como `failed`

### Mejores Prácticas

✅ **Validar datos antes de encolar:**
```javascript
if (!ventaData.idCliente || !ventaData.total) {
  showToast('Datos incompletos', 'error');
  return;
}
await offlineFetch({...});
```

✅ **Actualizar UI optimísticamente:**
```javascript
// Actualizar UI primero
setItems(prev => [...prev, newItem]);

// Luego enviar al servidor
await offlineFetch({...});
```

✅ **Informar al usuario del estado:**
```javascript
const result = await offlineFetch({...});

if (result.queued) {
  showToast('Guardado localmente. Se enviará luego.', 'warning');
} else {
  showToast('Guardado en el servidor', 'success');
}
```

## Testing

### Simular Offline Mode

**Método 1: DevTools**
1. Abrir DevTools (F12)
2. Network tab
3. Seleccionar "Offline" en el dropdown

**Método 2: Código**
```javascript
// Simular offline
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: false
});
window.dispatchEvent(new Event('offline'));

// Simular online
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});
window.dispatchEvent(new Event('online'));
```

### Casos de Prueba

✅ Acción se encola cuando no hay conexión  
✅ Badge muestra estado correcto (rojo/offline)  
✅ Notificación aparece al perder conexión  
✅ Sincronización automática al restaurar conexión  
✅ Contador de acciones pendientes correcto  
✅ Limpiar acciones fallidas funciona  
✅ Reintentos se manejan correctamente  
✅ UI refleja estado en tiempo real  

## Debugging

### Ver Base de Datos en DevTools

1. **Chrome/Edge:**
   - DevTools → Application tab
   - IndexedDB → ollantay_offline_db → action_queue

2. **Firefox:**
   - DevTools → Storage tab
   - IndexedDB → ollantay_offline_db

### Logs del Sistema

```javascript
// Habilitar logs detallados (ya incluidos)
console.log('📥 Acción encolada:', entry.action, 'ID:', id);
console.log('🔄 Iniciando sincronización...');
console.log('✅ Acción sincronizada:', action.id);
console.log('❌ Error sincronizando:', error);
```

### Comandos de Consola

```javascript
// En la consola del navegador
import('./utils/offlineQueue').then(module => {
  const queue = module.default;
  
  // Ver estadísticas
  queue.getQueueStats().then(console.log);
  
  // Forzar sincronización
  queue.syncQueue();
  
  // Limpiar todo
  queue.clearFailedActions();
});
```

## Roadmap de Mejoras

### Corto Plazo
- [ ] Implementar Background Sync API
- [ ] Persistencia de JWT token con renovación automática
- [ ] Resolución básica de conflictos

### Mediano Plazo
- [ ] Compresión de payloads grandes
- [ ] Priorización de acciones (críticas primero)
- [ ] Límite de tamaño de cola (FIFO cuando lleno)
- [ ] Dashboard admin para ver cola de todos los usuarios

### Largo Plazo
- [ ] Resolución avanzada de conflictos (CRDT)
- [ ] Sincronización P2P entre dispositivos
- [ ] Exportar/importar cola para backup
- [ ] WebRTC para sync en LAN sin internet

## Troubleshooting

### Problema: IndexedDB no inicializa
**Solución:** Verificar que el navegador soporte IndexedDB
```javascript
if (!window.indexedDB) {
  alert('Tu navegador no soporta IndexedDB');
}
```

### Problema: Acciones no se sincronizan
**Solución:** 
1. Verificar que `navigator.onLine` sea `true`
2. Check network tab para ver requests
3. Verificar que el token no haya expirado

### Problema: Badge no aparece
**Solución:** Verificar que `loggedUser` existe en el contexto

### Problema: Acciones se duplican
**Solución:** Asegurarse de no llamar a `offlineFetch` múltiples veces para la misma acción

## Contacto y Soporte

Para dudas o mejoras del sistema offline:
- Revisar logs en consola del navegador
- Inspeccionar IndexedDB en DevTools
- Verificar eventos de conexión con Network tab

---

**Última actualización:** 2025-11-13  
**Versión:** 1.0.0  
**Mantenedor:** Sistema Ollantay Dev Team
