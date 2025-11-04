/**
 * Hook para gestionar permisos del usuario
 * @param {Object} loggedUser - Usuario logueado con permisos
 * @returns {Object} Funciones helper para verificar permisos
 */
export function usePermissions(loggedUser) {
  const perms = loggedUser?.permissions || []
  const userRole = loggedUser?.role || ''

  /**
   * Verifica si el usuario tiene un permiso específico
   * @param {string} resource - Recurso (ej: 'personas', 'prestamos', 'ventas')
   * @param {string} action - Acción (ej: 'view', 'create', 'edit', 'delete')
   * @returns {boolean}
   */
  const has = (resource, action) => {
    // Superadmin tiene todos los permisos
    if (userRole === 'superadmin') return true
    
    // Verificar permiso específico (sin atajos para admin)
    return perms.includes(`${resource}:${action}`)
  }

  /**
   * Verifica si el usuario tiene al menos uno de los permisos especificados
   * @param {Array<{resource: string, action: string}>} permissions
   * @returns {boolean}
   */
  const hasAny = (permissions) => {
    return permissions.some(({ resource, action }) => has(resource, action))
  }

  /**
   * Verifica si el usuario tiene todos los permisos especificados
   * @param {Array<{resource: string, action: string}>} permissions
   * @returns {boolean}
   */
  const hasAll = (permissions) => {
    return permissions.every(({ resource, action }) => has(resource, action))
  }

  /**
   * Verifica si el usuario es admin o superadmin
   * @returns {boolean}
   */
  const isAdmin = () => {
    return userRole === 'admin' || userRole === 'superadmin'
  }

  /**
   * Verifica si el usuario es superadmin
   * @returns {boolean}
   */
  const isSuperAdmin = () => {
    return userRole === 'superadmin'
  }

  /**
   * Obtiene todos los permisos del usuario
   * @returns {Array<string>}
   */
  const getAllPermissions = () => {
    return perms
  }

  /**
   * Verifica si el usuario puede ver una vista específica
   * @param {string} viewName - Nombre de la vista
   * @returns {boolean}
   */
  const canViewPage = (viewName) => {
    const viewPermissions = {
      'tipos': has('tipos', 'view'),
      'personas': has('personas', 'view'),
      'empresas': has('empresas', 'view'),
      'prestamos': has('prestamos', 'view'),
      'productos': has('productos', 'view'),
      'caja': has('caja', 'view'),
      'ventas': has('ventas', 'view'),
      'compras': has('compras', 'view'),
      'proveedores': has('proveedores', 'view'),
      'rutas': has('rutas', 'view'),
      'cuentas': has('cuentas', 'view'),
      'usuarios': has('roles', 'manage'),
      'roles': has('roles', 'manage'),
      'superadmin': isSuperAdmin(),
    }

    return viewPermissions[viewName] || false
  }

  return {
    has,
    hasAny,
    hasAll,
    isAdmin,
    isSuperAdmin,
    getAllPermissions,
    canViewPage,
    userRole,
    permissions: perms
  }
}
