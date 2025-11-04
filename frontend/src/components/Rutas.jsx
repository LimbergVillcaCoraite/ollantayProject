import { useState, useEffect, useRef } from 'react';
import { useToast } from '../ToastContext';

export default function Rutas() {
  const [rutas, setRutas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPreciosModal, setShowPreciosModal] = useState(false);
  const [showPersonasModal, setShowPersonasModal] = useState(false);
  const [editingRuta, setEditingRuta] = useState(null);
  const [selectedRuta, setSelectedRuta] = useState(null);
  const [formData, setFormData] = useState({ nombreRuta: '', descripcion: '', incremento_general: 0 });
  const [precios, setPrecios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [incrementoGeneralEdit, setIncrementoGeneralEdit] = useState('0');
  const [nuevoPrecio, setNuevoPrecio] = useState({ idProducto: '', incremento_precio: '' });
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [mostrarListaProductos, setMostrarListaProductos] = useState(false);
  const productoSelectorRef = useRef(null);
  
  const { showToast } = useToast();

  useEffect(() => {
    fetchRutas();
  }, []);

  // Cerrar lista de productos al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productoSelectorRef.current && !productoSelectorRef.current.contains(event.target)) {
        setMostrarListaProductos(false);
      }
    };
    
    if (mostrarListaProductos) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [mostrarListaProductos]);

  const fetchRutas = async () => {
    try {
      const response = await fetch('/api/rutas/rutas', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setRutas(data);
      } else {
        showToast('Error al cargar rutas', 'error');
      }
    } catch (error) {
      showToast('Error de conexión', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductos = async () => {
    try {
      const response = await fetch('/api/prestamos/productos', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Productos cargados:', data);
        // Normalizar nombres de campos para compatibilidad
        const productosNormalizados = data.map(p => ({
          ...p,
          id_producto: p.idProducto || p.id_producto,
          nombre_producto: p.nombreProducto || p.nombre_producto,
          precio_minorista: p.precio_minorista || p.precioMinorista || 0
        }));
        setProductos(productosNormalizados);
      } else {
        console.error('Error al cargar productos:', response.status);
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  };

  const fetchPrecios = async (idRuta) => {
    try {
      const response = await fetch(`/api/rutas/rutas/${idRuta}/precios`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Precios cargados:', data);
        setPrecios(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error al cargar precios:', response.status, errorData);
        showToast(`Error al cargar precios de ruta: ${errorData.detail || response.statusText}`, 'error');
      }
    } catch (error) {
      console.error('Error de conexión al cargar precios:', error);
      showToast('Error de conexión al cargar precios', 'error');
    }
  };

  const handleOpenModal = (ruta = null) => {
    if (ruta) {
      setEditingRuta(ruta);
      setFormData({
        nombreRuta: ruta.nombreRuta,
        descripcion: ruta.descripcion || '',
        incremento_general: ruta.incremento_general || 0,
      });
    } else {
      setEditingRuta(null);
      setFormData({ nombreRuta: '', descripcion: '', incremento_general: 0 });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRuta(null);
    setFormData({ nombreRuta: '', descripcion: '', incremento_general: 0 });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const url = editingRuta
      ? `/api/rutas/rutas/${editingRuta.idRuta}`
      : '/api/rutas/rutas';
    const method = editingRuta ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showToast(
          editingRuta ? 'Ruta actualizada exitosamente' : 'Ruta creada exitosamente',
          'success'
        );
        handleCloseModal();
        fetchRutas();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Error al guardar ruta', 'error');
      }
    } catch (error) {
      showToast('Error de conexión', 'error');
      console.error(error);
    }
  };

  const handleDelete = async (ruta) => {
    if (!confirm(`¿Eliminar la ruta "${ruta.nombreRuta}"?`)) return;

    try {
      const response = await fetch(`/api/rutas/rutas/${ruta.idRuta}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        showToast('Ruta eliminada exitosamente', 'success');
        fetchRutas();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Error al eliminar ruta', 'error');
      }
    } catch (error) {
      showToast('Error de conexión', 'error');
      console.error(error);
    }
  };

  const handleOpenPrecios = async (ruta) => {
    setSelectedRuta(ruta);
    setIncrementoGeneralEdit(String(Number(ruta.incremento_general ?? 0)));
    await fetchProductos();
    await fetchPrecios(ruta.idRuta);
    setShowPreciosModal(true);
  };

  const handleClosePreciosModal = () => {
    setShowPreciosModal(false);
    setSelectedRuta(null);
    setPrecios([]);
    setNuevoPrecio({ idProducto: '', incremento_precio: '' });
    setBusquedaProducto('');
    setMostrarListaProductos(false);
    setIncrementoGeneralEdit('0');
  };

  const handleOpenPersonas = async (ruta) => {
    setSelectedRuta(ruta);
    await fetchPersonas(ruta.idRuta);
    setShowPersonasModal(true);
  };

  const handleClosePersonasModal = () => {
    setShowPersonasModal(false);
    setSelectedRuta(null);
    setPersonas([]);
  };

  const fetchPersonas = async (idRuta) => {
    try {
      const response = await fetch(`/api/rutas/rutas/${idRuta}/personas`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Personas cargadas:', data);
        setPersonas(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error al cargar personas:', response.status, errorData);
        showToast(`Error al cargar personas: ${errorData.detail || response.statusText}`, 'error');
      }
    } catch (error) {
      console.error('Error de conexión al cargar personas:', error);
      showToast('Error de conexión al cargar personas', 'error');
    }
  };

  const handleAddPrecio = async (e) => {
    e.preventDefault();
    
    if (!nuevoPrecio.idProducto || nuevoPrecio.incremento_precio === '') {
      showToast('Complete todos los campos', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/rutas/rutas/${selectedRuta.idRuta}/precios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          idProducto: parseInt(nuevoPrecio.idProducto),
          incremento_precio: parseFloat(nuevoPrecio.incremento_precio),
        }),
      });

      if (response.ok) {
        showToast('Incremento agregado exitosamente', 'success');
        setNuevoPrecio({ idProducto: '', incremento_precio: '' });
        setBusquedaProducto('');
        setMostrarListaProductos(false);
        fetchPrecios(selectedRuta.idRuta);
      } else {
        const error = await response.json();
        showToast(error.detail || 'Error al agregar incremento', 'error');
      }
    } catch (error) {
      showToast('Error de conexión', 'error');
      console.error(error);
    }
  };

  const handleDeletePrecio = async (idProducto) => {
    if (!confirm('¿Eliminar este incremento de ruta?')) return;

    try {
      const response = await fetch(
        `/api/rutas/rutas/${selectedRuta.idRuta}/precios/${idProducto}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (response.ok) {
        showToast('Incremento eliminado exitosamente', 'success');
        fetchPrecios(selectedRuta.idRuta);
      } else {
        const error = await response.json();
        showToast(error.detail || 'Error al eliminar incremento', 'error');
      }
    } catch (error) {
      showToast('Error de conexión', 'error');
      console.error(error);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Cargando rutas...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold dark:text-white">Gestión de Rutas</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Nueva Ruta
        </button>
      </div>

      {/* Tabla de Rutas */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Nombre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Descripción
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Incremento General
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Empresa
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {rutas.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No hay rutas registradas
                </td>
              </tr>
            ) : (
              rutas.map((ruta) => (
                <tr key={ruta.idRuta} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {ruta.idRuta}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {ruta.nombreRuta}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {ruta.descripcion || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    <span className={`font-medium ${Number(ruta.incremento_general ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {Number(ruta.incremento_general ?? 0) >= 0 ? '+' : ''}{Number(ruta.incremento_general ?? 0).toFixed(2)} Bs
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {ruta.nombreEmpresa || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleOpenPrecios(ruta)}
                      className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                      title="Gestionar precios"
                    >
                      💰 Precios
                    </button>
                    <button
                      onClick={() => handleOpenPersonas(ruta)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      title="Ver personas de esta ruta"
                    >
                      👥 Personas
                    </button>
                    <button
                      onClick={() => handleOpenModal(ruta)}
                      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(ruta)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Crear/Editar Ruta */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 dark:text-white">
              {editingRuta ? 'Editar Ruta' : 'Nueva Ruta'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  Nombre de la Ruta *
                </label>
                <input
                  type="text"
                  value={formData.nombreRuta}
                  onChange={(e) => setFormData({ ...formData, nombreRuta: e.target.value })}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  maxLength={100}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  rows={3}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  Incremento General (Bs)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.incremento_general}
                  onChange={(e) => setFormData({ ...formData, incremento_general: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Este incremento se aplica automáticamente a TODOS los productos de esta ruta. Puede ser positivo (aumento) o negativo (descuento).
                </p>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded dark:bg-gray-600 dark:hover:bg-gray-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                >
                  {editingRuta ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gestión de Precios */}
      {showPreciosModal && selectedRuta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">
                Precios - {selectedRuta.nombreRuta}
              </h2>
              <button
                onClick={handleClosePreciosModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            {/* Mostrar incremento general de la ruta */}
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-300">Incremento General de la Ruta</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                    Este incremento se aplica automáticamente a TODOS los productos de esta ruta
                  </p>
                </div>
                <div className="flex items-end justify-end gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-blue-900 dark:text-blue-300">Incremento General (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={incrementoGeneralEdit}
                      onChange={(e) => setIncrementoGeneralEdit(e.target.value)}
                      className="w-40 px-3 py-2 border rounded dark:bg-blue-950 dark:border-blue-800 dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const body = {
                          nombreRuta: selectedRuta.nombreRuta,
                          descripcion: selectedRuta.descripcion || '',
                          incremento_general: parseFloat(incrementoGeneralEdit || '0')
                        };
                        const resp = await fetch(`/api/rutas/rutas/${selectedRuta.idRuta}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify(body)
                        });
                        if (resp.ok) {
                          const updated = await resp.json();
                          // actualizar estado local y listado
                          setSelectedRuta(updated);
                          setRutas(prev => prev.map(r => r.idRuta === updated.idRuta ? updated : r));
                          setIncrementoGeneralEdit(String(Number(updated.incremento_general ?? 0)));
                          showToast('Incremento general actualizado', 'success');
                        } else {
                          const err = await resp.json().catch(() => ({}));
                          showToast(err.detail || 'No se pudo actualizar el incremento general', 'error');
                        }
                      } catch (e) {
                        console.error(e);
                        showToast('Error de conexión al guardar incremento general', 'error');
                      }
                    }}
                    className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>

            {/* Formulario para agregar precio */}
            <form onSubmit={handleAddPrecio} className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded">
              <h3 className="font-semibold mb-3 dark:text-white">Agregar Incremento Específico por Producto</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                El incremento específico puede ser positivo (aumento) o negativo (descuento). Se suma al precio base + incremento general.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative" ref={productoSelectorRef}>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                    Producto *
                  </label>
                  <input
                    type="text"
                    value={busquedaProducto}
                    onChange={(e) => {
                      setBusquedaProducto(e.target.value);
                      setMostrarListaProductos(true);
                      if (!e.target.value) {
                        setNuevoPrecio({ ...nuevoPrecio, idProducto: '' });
                      }
                    }}
                    onFocus={() => setMostrarListaProductos(true)}
                    placeholder="Buscar producto por nombre o ID..."
                    className="w-full px-3 py-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                    required={!nuevoPrecio.idProducto}
                  />
                  {mostrarListaProductos && busquedaProducto && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                      {productos
                        .filter((p) => {
                          if (precios.some((pr) => pr.idProducto === p.id_producto)) return false;
                          const searchLower = busquedaProducto.toLowerCase();
                          return (
                            p.nombre_producto?.toLowerCase().includes(searchLower) ||
                            String(p.id_producto).includes(searchLower)
                          );
                        })
                        .map((producto) => (
                          <div
                            key={producto.id_producto}
                            onClick={() => {
                              setNuevoPrecio({ ...nuevoPrecio, idProducto: producto.id_producto });
                              setBusquedaProducto(`${producto.nombre_producto} (ID: ${producto.id_producto})`);
                              setMostrarListaProductos(false);
                            }}
                            className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm"
                          >
                            <div className="font-medium dark:text-white">{producto.nombre_producto}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              ID: {producto.id_producto} | Precio base: Bs {Number(producto.precio_minorista || 0).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      {productos.filter((p) => {
                        if (precios.some((pr) => pr.idProducto === p.id_producto)) return false;
                        const searchLower = busquedaProducto.toLowerCase();
                        return (
                          p.nombre_producto?.toLowerCase().includes(searchLower) ||
                          String(p.id_producto).includes(searchLower)
                        );
                      }).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                          No se encontraron productos
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                    Incremento (Bs) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={nuevoPrecio.incremento_precio}
                    onChange={(e) =>
                      setNuevoPrecio({ ...nuevoPrecio, incremento_precio: e.target.value })
                    }
                    placeholder="Ej: 2.50 o -1.00"
                    className="w-full px-3 py-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Positivo: aumento | Negativo: descuento
                  </p>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded"
                  >
                    + Agregar
                  </button>
                </div>
              </div>
            </form>

            {/* Tabla de precios */}
            <div className="border rounded dark:border-gray-600">
              <table className="min-w-full">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium dark:text-gray-300">
                      Producto
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium dark:text-gray-300">
                      Precio Base
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium dark:text-gray-300">
                      Incremento
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium dark:text-gray-300">
                      Precio Final
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium dark:text-gray-300">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {precios.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                        No hay incrementos configurados para esta ruta
                      </td>
                    </tr>
                  ) : (
                    precios.map((precio) => {
                      const incremento = Number(precio.incremento_precio || 0);
                      const precioBase = Number(precio.precio_base || 0);
                      const precioFinal = precioBase + incremento;
                      const porcentaje = precioBase > 0 ? ((incremento / precioBase) * 100).toFixed(1) : 0;
                      
                      return (
                        <tr key={precio.idProducto} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 text-sm dark:text-gray-200">
                            {precio.nombreProducto}
                          </td>
                          <td className="px-4 py-3 text-sm dark:text-gray-300">
                            Bs {precioBase.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold">
                            <span
                              className={
                                incremento > 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : incremento < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-gray-500 dark:text-gray-400'
                              }
                            >
                              {incremento > 0 ? '+' : ''}{incremento.toFixed(2)} Bs
                              <span className="text-xs ml-1">({porcentaje > 0 ? '+' : ''}{porcentaje}%)</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold dark:text-gray-100">
                            Bs {precioFinal.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => handleDeletePrecio(precio.idProducto)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Personas de la Ruta */}
      {showPersonasModal && selectedRuta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">
                👥 Personas - {selectedRuta.nombreRuta}
              </h2>
              <button
                onClick={handleClosePersonasModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Información de la ruta */}
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    <strong>Descripción:</strong> {selectedRuta.descripcion || 'Sin descripción'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    <strong>Incremento General:</strong> 
                    <span className={`ml-2 font-semibold ${Number(selectedRuta.incremento_general ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {Number(selectedRuta.incremento_general ?? 0) >= 0 ? '+' : ''}{Number(selectedRuta.incremento_general ?? 0).toFixed(2)} Bs
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Tabla de Personas */}
            <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Nombre Completo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      CI
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Teléfono
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Tipo Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Tipo Persona
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {personas.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        <div className="flex flex-col items-center">
                          <span className="text-4xl mb-2">👤</span>
                          <p>No hay personas asignadas a esta ruta</p>
                          <p className="text-sm mt-2">Las personas se asignan desde el módulo de Personas</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    personas.map((persona) => {
                      const nombreCompleto = [
                        persona.nombres_persona,
                        persona.apellido_paternoPersona,
                        persona.apellido_maternoPer
                      ].filter(Boolean).join(' ');
                      
                      const tipoClienteBadge = {
                        'minorista': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
                        'mayorista': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
                        'especial': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                      };

                      return (
                        <tr key={persona.id_persona} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 text-sm dark:text-gray-200">
                            {persona.id_persona}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium dark:text-gray-100">
                            {nombreCompleto}
                          </td>
                          <td className="px-4 py-3 text-sm dark:text-gray-300">
                            {persona.ci_persona || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm dark:text-gray-300">
                            {persona.telefono_persona || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${tipoClienteBadge[persona.tipo_cliente] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                              {persona.tipo_cliente?.toUpperCase() || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm dark:text-gray-300">
                            {persona.tipo_persona_desc || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Contador de personas */}
            {personas.length > 0 && (
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
                Total: <strong>{personas.length}</strong> {personas.length === 1 ? 'persona' : 'personas'} en esta ruta
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleClosePersonasModal}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
