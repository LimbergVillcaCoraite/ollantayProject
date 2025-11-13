/**
 * Offline-First Queue Manager
 * Maneja la cola de acciones pendientes usando IndexedDB
 * Sincroniza automáticamente cuando vuelve la conexión
 */

const DB_NAME = 'ollantay_offline_db';
const DB_VERSION = 1;
const QUEUE_STORE = 'action_queue';

class OfflineQueueManager {
  constructor() {
    this.db = null;
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.init();
  }

  async init() {
    // Abrir/crear base de datos IndexedDB
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ Error abriendo IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB inicializado');
        
        // Escuchar cambios en conectividad
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Intentar sincronizar si estamos online
        if (this.isOnline) {
          this.syncQueue();
        }
        
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Crear object store para cola de acciones
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const store = db.createObjectStore(QUEUE_STORE, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('action', 'action', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          console.log('📦 Object store creado:', QUEUE_STORE);
        }
      };
    });
  }

  handleOnline() {
    console.log('🌐 Conexión restaurada');
    this.isOnline = true;
    this.showNotification('Conexión restaurada', 'Sincronizando datos pendientes...', 'success');
    this.syncQueue();
  }

  handleOffline() {
    console.log('📴 Sin conexión');
    this.isOnline = false;
    this.showNotification('Sin conexión', 'Las acciones se guardarán localmente', 'warning');
  }

  /**
   * Agregar acción a la cola
   */
  async enqueue(action) {
    if (!this.db) {
      throw new Error('IndexedDB no inicializado');
    }

    const entry = {
      action: action.type,
      endpoint: action.endpoint,
      method: action.method || 'POST',
      data: action.data,
      headers: action.headers || {},
      timestamp: Date.now(),
      status: 'pending',
      retries: 0,
      maxRetries: 3
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.add(entry);

      request.onsuccess = () => {
        console.log('📥 Acción encolada:', entry.action, 'ID:', request.result);
        this.showNotification(
          'Acción guardada', 
          `${entry.action} se sincronizará cuando vuelva la conexión`, 
          'info'
        );
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('❌ Error encolando acción:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Obtener todas las acciones pendientes
   */
  async getPendingActions() {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([QUEUE_STORE], 'readonly');
      const store = transaction.objectStore(QUEUE_STORE);
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sincronizar cola con el servidor
   */
  async syncQueue() {
    if (!this.isOnline || this.syncInProgress) return;

    this.syncInProgress = true;
    console.log('🔄 Iniciando sincronización...');

    try {
      const pendingActions = await this.getPendingActions();
      
      if (pendingActions.length === 0) {
        console.log('✅ No hay acciones pendientes');
        this.syncInProgress = false;
        return;
      }

      console.log(`📤 Sincronizando ${pendingActions.length} acciones pendientes`);
      let successCount = 0;
      let failCount = 0;

      for (const action of pendingActions) {
        try {
          await this.processAction(action);
          await this.removeAction(action.id);
          successCount++;
          console.log(`✅ Acción ${action.id} sincronizada:`, action.action);
        } catch (error) {
          console.error(`❌ Error sincronizando acción ${action.id}:`, error);
          
          // Incrementar contador de reintentos
          await this.incrementRetries(action.id);
          
          // Eliminar si superó máximo de reintentos
          if (action.retries >= action.maxRetries) {
            await this.markAsFailed(action.id);
            failCount++;
            console.warn(`⚠️ Acción ${action.id} marcada como fallida (max reintentos)`);
          }
        }
      }

      if (successCount > 0) {
        this.showNotification(
          'Sincronización completa', 
          `${successCount} acciones sincronizadas${failCount > 0 ? `, ${failCount} fallidas` : ''}`, 
          'success'
        );
      }

    } catch (error) {
      console.error('❌ Error en sincronización:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Procesar una acción individual
   */
  async processAction(action) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(action.endpoint, {
      method: action.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...action.headers
      },
      body: action.data ? JSON.stringify(action.data) : undefined
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Eliminar acción de la cola
   */
  async removeAction(id) {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Incrementar contador de reintentos
   */
  async incrementRetries(id) {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const action = getRequest.result;
        if (action) {
          action.retries = (action.retries || 0) + 1;
          const updateRequest = store.put(action);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Marcar acción como fallida
   */
  async markAsFailed(id) {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const action = getRequest.result;
        if (action) {
          action.status = 'failed';
          const updateRequest = store.put(action);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Obtener estadísticas de la cola
   */
  async getQueueStats() {
    if (!this.db) return { pending: 0, failed: 0, total: 0 };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([QUEUE_STORE], 'readonly');
      const store = transaction.objectStore(QUEUE_STORE);
      const allRequest = store.getAll();

      allRequest.onsuccess = () => {
        const actions = allRequest.result;
        const stats = {
          total: actions.length,
          pending: actions.filter(a => a.status === 'pending').length,
          failed: actions.filter(a => a.status === 'failed').length
        };
        resolve(stats);
      };

      allRequest.onerror = () => reject(allRequest.error);
    });
  }

  /**
   * Limpiar acciones fallidas
   */
  async clearFailedActions() {
    if (!this.db) return;

    const transaction = this.db.transaction([QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE);
    const index = store.index('status');
    const request = index.openCursor(IDBKeyRange.only('failed'));

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
  }

  /**
   * Mostrar notificación al usuario
   */
  showNotification(title, message, type = 'info') {
    // Integración con sistema de notificaciones existente
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
    }
  }
}

// Instancia global
const offlineQueue = new OfflineQueueManager();

export default offlineQueue;

/**
 * Helper para usar con fetch
 * Ejemplo:
 * 
 * import { offlineFetch } from './utils/offlineQueue';
 * 
 * await offlineFetch({
 *   type: 'crear_venta',
 *   endpoint: 'http://localhost:8004/api/ventas',
 *   method: 'POST',
 *   data: { ... }
 * });
 */
export async function offlineFetch(action) {
  if (navigator.onLine) {
    // Si hay conexión, ejecutar directamente
    const token = localStorage.getItem('token');
    const response = await fetch(action.endpoint, {
      method: action.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...action.headers
      },
      body: action.data ? JSON.stringify(action.data) : undefined
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } else {
    // Sin conexión, encolar
    await offlineQueue.enqueue(action);
    return { queued: true, message: 'Acción guardada para sincronizar más tarde' };
  }
}
