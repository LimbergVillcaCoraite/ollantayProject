import React, { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix Leaflet default icon paths for Vite bundling
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

export default function Ventas({ API, userRole }) {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showEntregas, setShowEntregas] = useState(false);
  const [entregas, setEntregas] = useState([]);
  const [entregasLoading, setEntregasLoading] = useState(false);
  const [entregasError, setEntregasError] = useState('');
  const [entregasExpanded, setEntregasExpanded] = useState({}); // idEntrega -> detalles
  const [ventasExpanded, setVentasExpanded] = useState({}); // idVenta -> expanded
  const [rutas, setRutas] = useState([]);
  
  // Filtros
  const [fDesde, setFDesde] = useState('');
  const [fHasta, setFHasta] = useState('');
  const [fCliente, setFCliente] = useState('');
  const [fTipoVenta, setFTipoVenta] = useState('');
  const [fTipoPago, setFTipoPago] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [fEstadoPago, setFEstadoPago] = useState('');
  const [fIdProducto, setFIdProducto] = useState('');
  const [periodo, setPeriodo] = useState('');

  // Cat�logos
  const [tiposVenta, setTiposVenta] = useState([]);
  const [tiposPago, setTiposPago] = useState([]);
  // Bases de API derivadas
  const host = (typeof window !== 'undefined' && window.location?.hostname) ? window.location.hostname : 'localhost'
  const proto = (typeof window !== 'undefined' && window.location?.protocol) ? window.location.protocol : 'http:'
  const API_PERSONAS = `${proto}//${host}/api/personas`
  const API_PRESTAMOS = `${proto}//${host}/api/prestamos`
  const API_RUTAS = `${proto}//${host}/api/rutas`
  const API_ENTREGAS = `${proto}//${host}/api/entregas`
  
  // Estados para crear venta
  const [clientes, setClientes] = useState([]);
  const [clienteBusqueda, setClienteBusqueda] = useState('');
  const [clienteSugeridos, setClienteSugeridos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [formVenta, setFormVenta] = useState({
    idCliente: '',
    idTipoVenta: '2', // minorista por defecto (para backend, pero no se muestra en UI)
    idTipoPago: '1', // contado por defecto
    observaciones: '',
    descuentoPorcentaje: 0
  });
  const [detalles, setDetalles] = useState([]);
  const [nuevoDetalle, setNuevoDetalle] = useState({
    busqueda: '',
    idProducto: '',
    nombreProducto: '',
    cantidad_caja: '',
    precio_por_paquete: '', // Precio por paquete/caja del lote FEFO
    precio_unitario: '', // Precio por unidad individual (cuando vende por unidades)
    stockDisponible: 0,
    venderUnidades: false,
    unidades: '',
    unidadesPorPaquete: '',
    loteInfo: null // Info del lote FEFO (c�digo, vencimiento, precio)
  });
  const [productosSugeridos, setProductosSugeridos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errTiposVenta, setErrTiposVenta] = useState('');
  const [errTiposPago, setErrTiposPago] = useState('');
  const [errClientes, setErrClientes] = useState('');
  const [errProductos, setErrProductos] = useState('');

  // Estados para crear entrega (chofer)
  const [crearEntregaOpen, setCrearEntregaOpen] = useState(false);
  const [formEntrega, setFormEntrega] = useState({
    idRuta: '',
    idEncargado: '',
    fechaSalida: new Date().toISOString().split('T')[0],
    observaciones: ''
  });
  const [detallesEntrega, setDetallesEntrega] = useState([]);
  const [nuevoDetEntrega, setNuevoDetEntrega] = useState({
    busqueda: '',
    idProducto: '',
    nombreProducto: '',
    idLote: null,
    codigoLote: '',
    fechaVencimiento: '',
    stockDisponible: 0,
    cantidadEnviada: '',
    precioUnitario: ''
  });
  const [productosSugEntrega, setProductosSugEntrega] = useState([]);
  const [rutaPrecioCache, setRutaPrecioCache] = useState({}); // idRuta -> { incremento_general, precios: [{idProducto, incremento_precio}] }
  const [finalizandoEntrega, setFinalizandoEntrega] = useState(null); // { idEntrega, detalles con input de devoluci�n }
    const [mapaEntrega, setMapaEntrega] = useState(null); // { idEntrega, numeroEntrega, ultima, online, socket }
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Cargar cat�logos
    setErrTiposVenta('');
    fetch(`${API}/tipos-venta`, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      .then(async r => {
        if (!r.ok) {
          const t = await r.text().catch(()=> '');
          throw new Error(`tipos-venta ${r.status}${t?` - ${t.substring(0,120)}`:''}`);
        }
        return r.json();
      })
      .then(d => setTiposVenta(Array.isArray(d) ? d : []))
      .catch((e) => { console.error(e); setErrTiposVenta('No se pudieron cargar los tipos de venta'); setTiposVenta([]); });
    
    setErrTiposPago('');
    fetch(`${API}/tipos-pago`, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      .then(async r => {
        if (!r.ok) {
          const t = await r.text().catch(()=> '');
          throw new Error(`tipos-pago ${r.status}${t?` - ${t.substring(0,120)}`:''}`);
        }
        return r.json();
      })
      .then(d => setTiposPago(Array.isArray(d) ? d : []))
      .catch((e) => { console.error(e); setErrTiposPago('No se pudieron cargar los tipos de pago'); setTiposPago([]); });
      
    // Cargar personas (todas las personas de la empresa)
    setErrClientes('');
    fetch(`${API_PERSONAS}/persons`, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      .then(async r => {
        if (!r.ok) {
          const t = await r.text().catch(()=> '');
          throw new Error(`personas ${r.status}${t?` - ${t.substring(0,120)}`:''}`);
        }
        return r.json();
      })
      .then(d => setClientes(Array.isArray(d) ? d : []))
      .catch((e) => { console.error(e); setErrClientes('No se pudieron cargar las personas de la empresa'); setClientes([]); });
      
    // Cargar productos
    setErrProductos('');
    fetch(`${API_PRESTAMOS}/productos`, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      .then(async r => {
        if (!r.ok) {
          const t = await r.text().catch(()=> '');
          throw new Error(`productos ${r.status}${t?` - ${t.substring(0,120)}`:''}`);
        }
        return r.json();
      })
      .then(d => setProductos(Array.isArray(d) ? d : []))
      .catch((e) => { console.error(e); setErrProductos('No se pudieron cargar los productos'); setProductos([]); });
  }, [API, userRole]);

  // Helpers Entregas
  const loadRutas = useCallback(async () => {
    try {
      const r = await fetch(`${API_RUTAS}/rutas`, { credentials: 'include' });
      if (!r.ok) throw new Error('rutas');
      const d = await r.json();
      setRutas(Array.isArray(d) ? d : []);
    } catch (e) {
      console.warn('No se pudieron cargar rutas', e);
      setRutas([]);
    }
  }, [API_RUTAS]);

  const loadEntregas = useCallback(async () => {
    setEntregasLoading(true);
    setEntregasError('');
    try {
      const r = await fetch(`${API_ENTREGAS}/entregas?limit=200`, { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setEntregas(Array.isArray(d) ? d : []);
    } catch (e) {
      console.error('Error cargando entregas:', e);
      setEntregasError('No se pudieron cargar las entregas');
    } finally {
      setEntregasLoading(false);
    }
  }, [API_ENTREGAS]);

  const ensureRutaPrecioCache = useCallback(async (idRuta) => {
    if (!idRuta) return null;
    if (rutaPrecioCache[idRuta]) return rutaPrecioCache[idRuta];
    try {
      const [ri, rp] = await Promise.all([
        fetch(`${API_RUTAS}/rutas/${idRuta}`, { credentials: 'include' }),
        fetch(`${API_RUTAS}/rutas/${idRuta}/precios`, { credentials: 'include' })
      ]);
      const rutaInfo = ri.ok ? await ri.json() : {};
      const precios = rp.ok ? await rp.json() : [];
      const cacheEntry = {
        incremento_general: Number(rutaInfo?.incremento_general || 0),
        precios: Array.isArray(precios) ? precios : []
      };
      setRutaPrecioCache(prev => ({ ...prev, [idRuta]: cacheEntry }));
      return cacheEntry;
    } catch (e) {
      console.warn('No se pudo cargar info de ruta', e);
      const fallback = { incremento_general: 0, precios: [] };
      setRutaPrecioCache(prev => ({ ...prev, [idRuta]: fallback }));
      return fallback;
    }
  }, [API_RUTAS, rutaPrecioCache]);

  const loadVentas = useCallback(() => {
    setLoading(true);
    setError(null);
    
    const params = new URLSearchParams();
    if (fDesde) params.append('fecha_inicio', fDesde);
    if (fHasta) params.append('fecha_fin', fHasta);
    if (fTipoVenta) params.append('idTipoVenta', fTipoVenta);
    if (fTipoPago) params.append('idTipoPago', fTipoPago);
    if (fEstado) params.append('estado', fEstado);
    if (fIdProducto) params.append('idProducto', fIdProducto);
    params.append('limit', '1000');
    
    const url = `${API}?${params.toString()}`;
    
    fetch(url, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      .then(async res => {
        if (!res.ok) {
          const t = await res.text().catch(()=> '')
          throw new Error(`HTTP ${res.status}${t ? ` - ${t.substring(0,120)}` : ''}`)
        }
        return res.json()
      })
      .then(data => {
        setVentas(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        console.error('Error cargando ventas:', e);
        setError('No se pudieron cargar las ventas. ' + (e?.message || 'Error desconocido'))
      })
      .finally(() => setLoading(false));
  }, [API, userRole, fDesde, fHasta, fTipoVenta, fTipoPago, fEstado, fIdProducto]);
  
  useEffect(() => {
    loadVentas();
  }, [loadVentas]);

  const anularVenta = async (idVenta) => {
    if (!window.confirm('¿Está seguro de anular esta venta? Se revertirá el stock y los movimientos contables.')) {
      return;
    }

    try {
      const res = await fetch(`${API}/${idVenta}/anular`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(userRole ? { 'X-User-Role': userRole } : {})
        }
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${errText ? ` - ${errText.substring(0, 120)}` : ''}`);
      }

      alert('Venta anulada exitosamente');
      loadVentas(); // Recargar lista
    } catch (e) {
      console.error('Error anulando venta:', e);
      alert('Error al anular venta: ' + (e?.message || 'Error desconocido'));
    }
  };
  
  // ====== Rastreo en vivo: mapa del chofer ======
  const getCookie = (name) => {
    if (typeof document === 'undefined') return null;
    const v = document.cookie.split('; ').find(r => r.startsWith(name + '='));
    return v ? decodeURIComponent(v.split('=')[1]) : null;
  };

  const abrirMapa = async (entrega) => {
    const base = { idEntrega: entrega.idEntrega, numeroEntrega: entrega.numeroEntrega || entrega.idEntrega, ultima: null, online: false, socket: null };
    setMapaEntrega(base);
    try {
      const r = await fetch(`${API_ENTREGAS}/entregas/${entrega.idEntrega}/ubicacion/ultima`, { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        setMapaEntrega(prev => ({ ...(prev || base), ultima: d || null }));
      }
    } catch {}
    conectarWebSocket(entrega.idEntrega);
  };

  const conectarWebSocket = (idEntrega) => {
    try {
      const host = (typeof window !== 'undefined' && window.location?.host) ? window.location.host : 'localhost';
      const scheme = (typeof window !== 'undefined' && window.location?.protocol === 'https:') ? 'wss' : 'ws';
      const token = getCookie('ollantay_token');
      const url = `${scheme}://${host}/api/entregas/ws/entregas/${idEntrega}/ubicacion${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      const ws = new WebSocket(url);
      ws.onopen = () => setMapaEntrega(prev => ({ ...(prev || {}), online: true, socket: ws }));
      ws.onmessage = (ev) => {
        try {
          const obj = JSON.parse(ev.data);
          if (obj && (obj.lat != null) && (obj.lng != null)) {
            setMapaEntrega(prev => ({ ...(prev || {}), ultima: { lat: Number(obj.lat), lng: Number(obj.lng), accuracy: obj.accuracy ?? null, updated_at: obj.updated_at || new Date().toISOString() } }));
          }
        } catch {}
      };
      ws.onclose = () => setMapaEntrega(prev => ({ ...(prev || {}), online: false, socket: null }));
      ws.onerror = () => setMapaEntrega(prev => ({ ...(prev || {}), online: false }));
    } catch (e) {
      console.warn('WS error', e);
    }
  };

  const cerrarMapa = () => {
    try { mapaEntrega?.socket?.close?.(); } catch {}
    setMapaEntrega(null);
  };

  const registrarPagoVenta = async (venta) => {
    try {
      const montoStr = window.prompt(`Ingrese el monto a registrar para la venta #${venta.idVenta} (Pendiente: ${formatMoney((Number(venta.montoTotal||0) - Number(venta.montoPagado||0)))})`, '');
      if (montoStr === null) return; // cancel
      const monto = parseFloat(montoStr);
      if (!(monto > 0)) { alert('Monto inválido'); return; }
      const metodo = window.prompt('Método (contado/transferencia/otro) - opcional', '') || undefined;
      const referencia = window.prompt('Referencia (opcional)', '') || undefined;
      const body = { monto, ...(metodo ? { metodo } : {}), ...(referencia ? { referencia } : {}) };
      const res = await fetch(`${API}/${venta.idVenta}/registrar-pago`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(userRole ? { 'X-User-Role': userRole } : {}) },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const t = await res.text().catch(()=> '');
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const estadoPago = data?.venta?.estado_pago || 'Actualizado';
      // Abrir recibo en nueva pestaña si se devolvió idMovimiento
      if (data?.idMovimiento) {
        window.open(`${API}/${venta.idVenta}/recibo/${data.idMovimiento}?format=html`, '_blank');
      }
      alert(`Pago registrado. Estado de pago: ${estadoPago}`);
      loadVentas();
    } catch (e) {
      console.error('Error registrando pago:', e);
      alert('No se pudo registrar el pago: ' + (e?.message || 'Error'));
    }
  };

  const handlePeriodoChange = (tipo) => {
    const hoy = new Date();
    let desde = '';
    let hasta = hoy.toISOString().split('T')[0];
    
    if (tipo === 'hoy') {
      desde = hasta;
    } else if (tipo === 'semana') {
      const primerDia = new Date(hoy);
      primerDia.setDate(hoy.getDate() - hoy.getDay());
      desde = primerDia.toISOString().split('T')[0];
    } else if (tipo === 'mes') {
      desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    }
    
    setPeriodo(tipo);
    setFDesde(desde);
    setFHasta(hasta);
  };

  const limpiarFiltros = () => {
    setFDesde('');
    setFHasta('');
    setFCliente('');
    setFTipoVenta('');
    setFTipoPago('');
    setFEstado('');
    setFIdProducto('');
    setPeriodo('');
  };

  const formatMoney = (amount) => {
    const num = Number(amount || 0);
    try {
      return num.toLocaleString('es-BO', { style: 'currency', currency: 'BOB', maximumFractionDigits: 2 });
    } catch {
      return `Bs ${num.toFixed(2)}`;
    }
  };

  // Normaliza estados como "En Ruta" -> "en_ruta"
  const normalizeEstado = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '_');

  // Utilidad: nombre visible de persona
  const formatPersonaNombre = (p) => {
    if (!p) return '';
    const nombres = [p.nombres_persona, p.apellido_paternoPersona, p.apellido_maternoPer].filter(Boolean).join(' ');
    return `${nombres}${p.ci_persona ? ` � CI ${p.ci_persona}` : ''}`.trim();
  };

  // ========== FUNCIONES PARA CREAR VENTA ==========
  
  // Buscar cliente por ID o nombre con tecla Tab
  const buscarCliente = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const q = (clienteBusqueda || '').trim();
      if (!q) return;
      const isNum = /^\d+$/.test(q);
      let persona = null;
      if (isNum) {
        persona = clientes.find(c => String(c.id_persona) === q);
      } else {
        const lcq = q.toLowerCase();
        const matches = clientes.filter(c => formatPersonaNombre(c).toLowerCase().includes(lcq));
        if (matches.length === 1) return seleccionarCliente(matches[0]);
        if (matches.length > 1) {
          setClienteSugeridos(matches.slice(0, 50));
          return;
        }
      }
      if (persona) seleccionarCliente(persona);
    }
  };

  const seleccionarCliente = async (persona) => {
    // Determinar el tipo de venta seg�n el tipo de persona
    // Asumiendo: id_tipoPersona 1 = mayorista, 2 = minorista (ajustar seg�n tu BD)
    const tipoVenta = persona.id_tipoPersona === 1 ? '1' : '2'; // 1=mayorista, 2=minorista
    
    setFormVenta({ 
      ...formVenta, 
      idCliente: String(persona.id_persona),
      idTipoVenta: tipoVenta
    });
    setClienteBusqueda(formatPersonaNombre(persona));
    setClienteSugeridos([]);
    
    // Si hay un producto ya seleccionado, actualizar su precio seg�n el nuevo tipo de cliente Y ruta
    if (nuevoDetalle.idProducto) {
      const productoActual = productos.find(p => p.idProducto === nuevoDetalle.idProducto);
      if (productoActual) {
        const esMinorista = tipoVenta === '2';
        let precioPaquete = esMinorista ? 
          (productoActual.precio_minorista || 0) : 
          (productoActual.precio_mayorista || 0);
        
        // Aplicar incrementos de ruta si el cliente tiene ruta
        const idRutaCliente = persona.idRuta || null;
        let incrementoGeneral = 0;
        let incrementoEspecifico = 0;
        let precioFinal = precioPaquete;
        
        if (idRutaCliente) {
          try {
            // Obtener incremento general de la ruta
            const rutaInfoResponse = await fetch(`/api/rutas/rutas/${idRutaCliente}`, {
              credentials: 'include'
            });
            
            if (rutaInfoResponse.ok) {
              const rutaInfo = await rutaInfoResponse.json();
              if (rutaInfo.incremento_general !== undefined) {
                incrementoGeneral = Number(rutaInfo.incremento_general || 0);
              }
            }
            
            // Obtener incremento espec�fico del producto
            const rutaPreciosResponse = await fetch(`/api/rutas/rutas/${idRutaCliente}/precios`, {
              credentials: 'include'
            });
            
            if (rutaPreciosResponse.ok) {
              const preciosRuta = await rutaPreciosResponse.json();
              const precioProductoRuta = preciosRuta.find(pr => pr.idProducto === productoActual.idProducto);
              
              if (precioProductoRuta && precioProductoRuta.incremento_precio !== undefined) {
                incrementoEspecifico = Number(precioProductoRuta.incremento_precio || 0);
              }
            }
            
            // Precio final = base + general + espec�fico
            precioFinal = precioPaquete + incrementoGeneral + incrementoEspecifico;
            
            if (incrementoGeneral !== 0 || incrementoEspecifico !== 0) {
              console.log(`? Precio actualizado por cambio de cliente: Base ${precioPaquete} + General ${incrementoGeneral} + Espec�fico ${incrementoEspecifico} = ${precioFinal}`);
            }
          } catch (error) {
            console.warn('No se pudo cargar incrementos de ruta:', error);
          }
        }
        
        setNuevoDetalle({
          ...nuevoDetalle,
          precio_por_paquete: precioFinal
        });
      }
    }
  };

  const buscarProducto = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const busqueda = nuevoDetalle.busqueda.trim();
      if (!busqueda) return;
      
      console.log('Buscando producto:', busqueda, 'Total productos:', productos.length);
      
      // Buscar por ID (n�mero) o nombre
      const esNumero = /^\d+$/.test(busqueda);
      let producto = null;
      
      if (esNumero) {
        producto = productos.find(p => p.idProducto === parseInt(busqueda));
        console.log('B�squeda por ID:', parseInt(busqueda), 'Encontrado:', producto);
      } else {
        const matches = productos.filter(p => 
          p.nombreProducto?.toLowerCase().includes(busqueda.toLowerCase())
        );
        console.log('B�squeda por nombre:', busqueda, 'Coincidencias:', matches.length);
        if (matches.length === 1) {
          producto = matches[0];
        } else if (matches.length > 1) {
          setProductosSugeridos(matches);
          return;
        }
      }
      
      if (producto) {
        seleccionarProducto(producto);
      } else {
        alert(`No se encontr� producto: ${busqueda}`);
      }
    }
  };

  const buscarProductoMientrasEscribe = (valor) => {
    setNuevoDetalle({...nuevoDetalle, busqueda: valor});
    
    if (!valor.trim()) {
      setProductosSugeridos([]);
      return;
    }
    
    const esNumero = /^\d+$/.test(valor.trim());
    let matches = [];
    
    if (esNumero) {
      const id = parseInt(valor);
      matches = productos.filter(p => String(p.idProducto).startsWith(valor));
    } else {
      const q = valor.toLowerCase();
      matches = productos.filter(p => 
        p.nombreProducto?.toLowerCase().includes(q)
      );
    }
    
    setProductosSugeridos(matches.slice(0, 20));
  };
  
  const seleccionarProducto = async (producto) => {
    const esMinorista = formVenta.idTipoVenta === '2';
    
    // Obtener cliente seleccionado para verificar si tiene ruta
    const clienteSeleccionado = clientes.find(c => String(c.id_persona) === String(formVenta.idCliente));
    const idRutaCliente = clienteSeleccionado?.idRuta || null;
    
    // Cargar lotes del producto para obtener el FEFO (pr�ximo a vencer)
    try {
      const lotesResponse = await fetch(`${API_PRESTAMOS}/lotes?idProducto=${producto.idProducto}`, { 
        credentials: 'include', 
        headers: userRole ? { 'X-User-Role': userRole } : {} 
      });
      
      const lotes = lotesResponse.ok ? await lotesResponse.json() : [];
      
      // Filtrar lotes con stock y ordenar por FEFO (fecha de vencimiento ASC)
      const lotesConStock = (Array.isArray(lotes) ? lotes : [])
        .filter(l => (l.stockActual || 0) > 0)
        .sort((a, b) => {
          const fechaA = a.fechaVencimiento || '9999-12-31';
          const fechaB = b.fechaVencimiento || '9999-12-31';
          return fechaA.localeCompare(fechaB);
        });
      
      // Tomar el primer lote (pr�ximo a vencer)
      const loteFEFO = lotesConStock[0];
      
      let precioPaquete = 0;
      let loteInfo = null;
      
      if (loteFEFO) {
        // Precio del lote seg�n tipo de cliente
        precioPaquete = esMinorista ? 
          (loteFEFO.precio_minorista || producto.precio_minorista || 0) : 
          (loteFEFO.precio_mayorista || producto.precio_mayorista || 0);
        
        loteInfo = {
          idLote: loteFEFO.idLote,
          codigoLote: loteFEFO.codigoLote,
          fechaVencimiento: loteFEFO.fechaVencimiento,
          stockActual: loteFEFO.stockActual
        };
      } else {
        // Si no hay lotes, usar precio del producto
        precioPaquete = esMinorista ? 
          (producto.precio_minorista || 0) : 
          (producto.precio_mayorista || 0);
      }
      
      // Aplicar incrementos de ruta si el cliente tiene ruta asignada
      let incrementoGeneral = 0;
      let incrementoEspecifico = 0;
      let precioFinal = precioPaquete;
      
      if (idRutaCliente) {
        try {
          // Obtener informaci�n de la ruta (incluye incremento_general)
          const rutaInfoResponse = await fetch(`/api/rutas/rutas/${idRutaCliente}`, {
            credentials: 'include'
          });
          
          if (rutaInfoResponse.ok) {
            const rutaInfo = await rutaInfoResponse.json();
            if (rutaInfo.incremento_general !== undefined) {
              incrementoGeneral = Number(rutaInfo.incremento_general || 0);
            }
          }
          
          // Obtener incremento espec�fico del producto (si existe)
          const rutaPreciosResponse = await fetch(`/api/rutas/rutas/${idRutaCliente}/precios`, {
            credentials: 'include'
          });
          
          if (rutaPreciosResponse.ok) {
            const preciosRuta = await rutaPreciosResponse.json();
            const precioProductoRuta = preciosRuta.find(pr => pr.idProducto === producto.idProducto);
            
            if (precioProductoRuta && precioProductoRuta.incremento_precio !== undefined) {
              incrementoEspecifico = Number(precioProductoRuta.incremento_precio || 0);
            }
          }
          
          // Precio final = base + incremento general + incremento espec�fico
          precioFinal = precioPaquete + incrementoGeneral + incrementoEspecifico;
          
          if (incrementoGeneral !== 0 || incrementoEspecifico !== 0) {
            console.log(`? Precio con ruta: Base ${precioPaquete} + General ${incrementoGeneral} + Espec�fico ${incrementoEspecifico} = ${precioFinal}`);
          }
        } catch (rutaError) {
          console.warn('No se pudo cargar incrementos de ruta:', rutaError);
        }
      }
      
      setNuevoDetalle({
        ...nuevoDetalle,
        busqueda: producto.nombreProducto,
        idProducto: producto.idProducto,
        nombreProducto: producto.nombreProducto,
        precio_por_paquete: precioFinal,
        precio_unitario: '',
        stockDisponible: loteFEFO ? loteFEFO.stockActual : (producto.stock_total_lotes ?? producto.stockCaja ?? 0),
        unidadesPorPaquete: nuevoDetalle.unidadesPorPaquete || '',
        loteInfo: loteInfo
      });
      
    } catch (error) {
      console.error('Error al cargar producto:', error);
      // Fallback si falla la carga de lotes
      const precioPaquete = esMinorista ? 
        (producto.precio_minorista || 0) : 
        (producto.precio_mayorista || 0);
      
      setNuevoDetalle({
        ...nuevoDetalle,
        busqueda: producto.nombreProducto,
        idProducto: producto.idProducto,
        nombreProducto: producto.nombreProducto,
        precio_por_paquete: precioPaquete,
        precio_unitario: '',
        stockDisponible: producto.stock_total_lotes ?? producto.stockCaja ?? 0,
        unidadesPorPaquete: nuevoDetalle.unidadesPorPaquete || '',
        loteInfo: null
      });
    }
    
    setProductosSugeridos([]);
  };

  // ========== FUNCIONES PARA CREAR ENTREGA ==========
  const buscarProductoEntregaMientrasEscribe = (valor) => {
    setNuevoDetEntrega({ ...nuevoDetEntrega, busqueda: valor });
    if (!valor.trim()) { setProductosSugEntrega([]); return; }
    const esNumero = /^\d+$/.test(valor.trim());
    let matches = [];
    if (esNumero) {
      matches = productos.filter(p => String(p.idProducto).startsWith(valor.trim()));
    } else {
      const q = valor.toLowerCase();
      matches = productos.filter(p => p.nombreProducto?.toLowerCase().includes(q));
    }
    setProductosSugEntrega(matches.slice(0, 20));
  };

  const seleccionarProductoEntrega = async (producto) => {
    // FEFO: buscar primer lote con stock
    try {
      const lotesResp = await fetch(`${API_PRESTAMOS}/lotes?idProducto=${producto.idProducto}`, { credentials: 'include' });
      const lotes = lotesResp.ok ? await lotesResp.json() : [];
      const lotesConStock = (Array.isArray(lotes) ? lotes : [])
        .filter(l => (l.stockActual || 0) > 0)
        .sort((a, b) => {
          const aF = a.fechaVencimiento || '9999-12-31';
          const bF = b.fechaVencimiento || '9999-12-31';
          return aF.localeCompare(bF);
        });
      const loteFEFO = lotesConStock[0] || null;

      // Precio base: minorista por defecto para manifiesto
      let precioBase = 0;
      if (loteFEFO) {
        precioBase = Number(loteFEFO.precio_minorista || producto.precio_minorista || 0);
      } else {
        precioBase = Number(producto.precio_minorista || 0);
      }

      // Aplicar incrementos de ruta seleccionada
      let precioFinal = precioBase;
      const idRutaSel = formEntrega.idRuta ? Number(formEntrega.idRuta) : null;
      if (idRutaSel) {
        const cache = await ensureRutaPrecioCache(idRutaSel);
        const incGeneral = Number(cache?.incremento_general || 0);
        const incEspecifico = Number((cache?.precios || []).find(pr => pr.idProducto === producto.idProducto)?.incremento_precio || 0);
        precioFinal = precioBase + incGeneral + incEspecifico;
      }

      setNuevoDetEntrega({
        busqueda: producto.nombreProducto,
        idProducto: producto.idProducto,
        nombreProducto: producto.nombreProducto,
        idLote: loteFEFO ? loteFEFO.idLote : null,
        codigoLote: loteFEFO ? (loteFEFO.codigoLote || '') : '',
        fechaVencimiento: loteFEFO ? (loteFEFO.fechaVencimiento || '') : '',
        stockDisponible: loteFEFO ? (loteFEFO.stockActual || 0) : (producto.stock_total_lotes ?? producto.stockCaja ?? 0),
        cantidadEnviada: '',
        precioUnitario: precioFinal
      });
      setProductosSugEntrega([]);
    } catch (e) {
      console.error('Error seleccionando producto (entrega):', e);
    }
  };

  const agregarDetalleEntrega = () => {
    if (!nuevoDetEntrega.idProducto || !nuevoDetEntrega.precioUnitario || !nuevoDetEntrega.cantidadEnviada) {
      alert('Seleccione un producto, defina precio y cantidad');
      return;
    }
    const cant = parseFloat(nuevoDetEntrega.cantidadEnviada);
    if (!(cant > 0)) { alert('Cantidad debe ser mayor a 0'); return; }
    if (cant > (Number(nuevoDetEntrega.stockDisponible) || 0)) { alert(`Stock insuficiente. Disponible: ${nuevoDetEntrega.stockDisponible}`); return; }
    const det = {
      idProducto: nuevoDetEntrega.idProducto,
      nombreProducto: nuevoDetEntrega.nombreProducto,
      idLote: nuevoDetEntrega.idLote,
      codigoLote: nuevoDetEntrega.codigoLote,
      fechaVencimiento: nuevoDetEntrega.fechaVencimiento,
      cantidadEnviada: cant,
      precioUnitario: Number(nuevoDetEntrega.precioUnitario)
    };
    setDetallesEntrega([...detallesEntrega, det]);
    setNuevoDetEntrega({ busqueda: '', idProducto: '', nombreProducto: '', idLote: null, codigoLote: '', fechaVencimiento: '', stockDisponible: 0, cantidadEnviada: '', precioUnitario: '' });
  };

  const eliminarDetalleEntrega = (idx) => {
    setDetallesEntrega(detallesEntrega.filter((_, i) => i !== idx));
  };

  const submitEntrega = async () => {
    if (!formEntrega.idRuta || !formEntrega.idEncargado) { alert('Seleccione ruta y encargado'); return; }
    if (detallesEntrega.length === 0) { alert('Agregue al menos un producto'); return; }
    try {
      const body = {
        idRuta: Number(formEntrega.idRuta),
        idEncargado: Number(formEntrega.idEncargado),
        fechaSalida: formEntrega.fechaSalida,
        observaciones: formEntrega.observaciones || '',
        detalles: detallesEntrega.map(d => ({
          idProducto: d.idProducto,
          idLote: d.idLote,
          cantidadEnviada: d.cantidadEnviada,
          precioUnitario: d.precioUnitario,
          observaciones: ''
        }))
      };
      const r = await fetch(`${API_ENTREGAS}/entregas`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        const t = await r.text().catch(()=> '');
        throw new Error(t || `HTTP ${r.status}`);
      }
      const result = await r.json();
      const totalProductos = detallesEntrega.length;
      const totalUnidades = detallesEntrega.reduce((sum, d) => sum + Number(d.cantidadEnviada), 0);
      const totalValor = detallesEntrega.reduce((sum, d) => sum + (Number(d.cantidadEnviada) * Number(d.precioUnitario)), 0);
      alert(`✅ Entrega creada exitosamente\n\n📦 Total productos: ${totalProductos}\n📊 Total unidades: ${totalUnidades.toFixed(2)}\n💰 Valor total: Bs. ${totalValor.toFixed(2)}\n\n🚚 Estado: EN RUTA\nLos productos han salido del almac�n.`);
      setCrearEntregaOpen(false);
      setFormEntrega({ idRuta: '', idEncargado: '', fechaSalida: new Date().toISOString().split('T')[0], observaciones: '' });
      setDetallesEntrega([]);
      await loadEntregas();
    } catch (e) {
      console.error('Error creando entrega:', e);
      alert('No se pudo crear la entrega: ' + (e?.message || 'Error'));
    }
  };

  const toggleExpandEntrega = async (entrega) => {
    const id = entrega.idEntrega;
    if (entregasExpanded[id]) {
      setEntregasExpanded(prev => ({ ...prev, [id]: null }));
      return;
    }
    try {
      const r = await fetch(`${API_ENTREGAS}/entregas/${id}`, { credentials: 'include' });
      if (!r.ok) throw new Error('detalle');
      const d = await r.json();
      setEntregasExpanded(prev => ({ ...prev, [id]: d }));
    } catch (e) {
      console.error('Error cargando detalle de entrega:', e);
      alert('No se pudo cargar el detalle de entrega');
    }
  };

  const finalizarEntrega = async (entregaId) => {
    try {
      // Obtener detalle actual para proponer devoluciones
      let det = entregasExpanded[entregaId];
      if (!det) {
        const r = await fetch(`${API_ENTREGAS}/entregas/${entregaId}`, { credentials: 'include' });
        if (!r.ok) throw new Error('No se pudo cargar el detalle');
        det = await r.json();
        setEntregasExpanded(prev => ({ ...prev, [entregaId]: det }));
      }
      
      // Preparar datos para formulario de devoluci�n
      const detallesConDevolucion = (det?.detalles || []).map(d => ({
        ...d,
        cantidadDevuelta: 0 // por defecto, nada devuelto
      }));
      
      setFinalizandoEntrega({
        idEntrega: entregaId,
        detalles: detallesConDevolucion,
        fechaRetorno: new Date().toISOString().split('T')[0],
        observaciones: '',
        metodo_pago: 'Contado'
      });
    } catch (e) {
      console.error('Error preparando finalizaci�n:', e);
      alert('No se pudo preparar la finalizaci�n: ' + (e?.message || 'Error'));
    }
  };

  const confirmarFinalizacion = async () => {
    if (!finalizandoEntrega) return;
    try {
      const devoluciones = finalizandoEntrega.detalles.map(d => ({
        idDetalle: d.idDetalle,
        cantidadDevuelta: Number(d.cantidadDevuelta) || 0
      }));
      
      const body = {
        fechaRetorno: finalizandoEntrega.fechaRetorno,
        devoluciones,
        observaciones: finalizandoEntrega.observaciones || '',
        metodo_pago: finalizandoEntrega.metodo_pago || 'Contado'
      };
      
      const r = await fetch(`${API_ENTREGAS}/entregas/${finalizandoEntrega.idEntrega}/finalizar`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!r.ok) {
        const t = await r.text().catch(()=> '');
        throw new Error(t || `HTTP ${r.status}`);
      }
      
      const totalVendido = finalizandoEntrega.detalles.reduce((sum, d) => {
        const enviada = Number(d.cantidadEnviada) || 0;
        const devuelta = Number(d.cantidadDevuelta) || 0;
        return sum + (enviada - devuelta);
      }, 0);
      
      alert(`✅ Entrega finalizada\n\n📊 Total vendido: ${totalVendido.toFixed(2)} unidades\n💵 El efectivo ha sido registrado en caja`);
      setFinalizandoEntrega(null);
      setEntregasExpanded(prev => ({ ...prev, [finalizandoEntrega.idEntrega]: null }));
      await loadEntregas();
    } catch (e) {
      console.error('Error finalizando entrega:', e);
      alert('No se pudo finalizar la entrega: ' + (e?.message || 'Error'));
    }
  };
  
  const agregarDetalle = () => {
    if (!nuevoDetalle.idProducto || !nuevoDetalle.precio_por_paquete) {
      alert('Seleccione un producto y defina el precio');
      return;
    }

    const precioPaquete = parseFloat(nuevoDetalle.precio_por_paquete);
    if (!(precioPaquete > 0)) {
      alert('El precio por paquete debe ser mayor a 0');
      return;
    }

    let cantidadCajas = 0;
    let precioUnitarioFinal = precioPaquete; // Por defecto es el precio por paquete
    
    if (nuevoDetalle.venderUnidades) {
      const uxp = parseFloat(nuevoDetalle.unidadesPorPaquete);
      const unidades = parseFloat(nuevoDetalle.unidades);
      if (!(uxp > 0)) {
        alert('Debe indicar Unidades por paquete para vender por unidades');
        return;
      }
      if (!(unidades > 0)) {
        alert('Las unidades deben ser mayor a 0');
        return;
      }
      cantidadCajas = unidades / uxp; // conversi�n a cajas
      // El precio unitario por unidad es: precio_paquete / unidades_por_paquete
      // Pero el backend espera precio_unitario que es el precio por caja, as� que usamos precio_paquete
      precioUnitarioFinal = precioPaquete;
    } else {
      const cant = parseFloat(nuevoDetalle.cantidad_caja);
      if (!(cant > 0)) {
        alert('La cantidad (cajas) debe ser mayor a 0');
        return;
      }
      cantidadCajas = cant;
    }

    if (cantidadCajas > (Number(nuevoDetalle.stockDisponible) || 0)) {
      alert(`Stock insuficiente. Disponible: ${nuevoDetalle.stockDisponible}`);
      return;
    }

    const detalle = {
      idProducto: nuevoDetalle.idProducto,
      nombreProducto: nuevoDetalle.nombreProducto,
      cantidad_caja: cantidadCajas,
      precio_unitario: precioUnitarioFinal,
      subtotal: cantidadCajas * precioUnitarioFinal,
      loteInfo: nuevoDetalle.loteInfo
    };
    
    setDetalles([...detalles, detalle]);
    setNuevoDetalle({
      busqueda: '',
      idProducto: '',
      nombreProducto: '',
      cantidad_caja: '',
      precio_por_paquete: '',
      precio_unitario: '',
      stockDisponible: 0,
      venderUnidades: false,
      unidades: '',
      unidadesPorPaquete: '',
      loteInfo: null
    });
  };
  
  const eliminarDetalle = (index) => {
    setDetalles(detalles.filter((_, i) => i !== index));
  };
  
  const calcularTotal = () => {
    return detalles.reduce((sum, d) => sum + d.subtotal, 0);
  };
  
  const calcularDescuento = () => {
    const subtotal = calcularTotal();
    const porcentaje = parseFloat(formVenta.descuentoPorcentaje) || 0;
    return (subtotal * porcentaje) / 100;
  };
  
  const calcularTotalFinal = () => {
    return calcularTotal() - calcularDescuento();
  };
  
  const handleSubmitVenta = async () => {
    if (!formVenta.idCliente) {
      alert('Seleccione un cliente');
      return;
    }
    if (detalles.length === 0) {
      alert('Agregue al menos un producto');
      return;
    }
    
    setSubmitting(true);
    
    const ventaData = {
      fechaVenta: new Date().toISOString().split('T')[0],
      idTipoVenta: parseInt(formVenta.idTipoVenta),
      idTipoPago: parseInt(formVenta.idTipoPago),
      idCliente: parseInt(formVenta.idCliente),
      montoTotal: calcularTotalFinal(),
      observaciones: formVenta.observaciones || '',
      detalles: detalles.map(d => ({
        idProducto: d.idProducto,
        cantidad_caja: d.cantidad_caja,
        precio_unitario: d.precio_unitario,
        subtotal: d.subtotal
      }))
    };
    
    console.log('DEBUG - Enviando ventaData:', JSON.stringify(ventaData, null, 2));
    console.log('DEBUG - detalles estado:', detalles);
    
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userRole ? { 'X-User-Role': userRole } : {})
        },
        credentials: 'include',
        body: JSON.stringify(ventaData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Error ${response.status}`);
      }
      
      alert('Venta creada exitosamente');
      setShowCreate(false);
      setFormVenta({
        idCliente: '',
        idTipoVenta: '2',
        idTipoPago: '1',
        observaciones: '',
        descuentoPorcentaje: 0
      });
      setDetalles([]);
      loadVentas();
    } catch (error) {
      console.error('Error creando venta:', error);
      alert('Error al crear la venta: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ========== FIN FUNCIONES PARA CREAR VENTA ==========


  // C�lculos para resumen
  let ventasFiltradas = fCliente 
    ? ventas.filter(v => v.nombreCliente?.toLowerCase().includes(fCliente.toLowerCase()))
    : ventas;
  if (fEstadoPago) {
    ventasFiltradas = ventasFiltradas.filter(v => (v.estado_pago || 'Pendiente').toLowerCase() === fEstadoPago.toLowerCase());
  }
  
  const totalVentas = ventasFiltradas.reduce((sum, v) => sum + Number(v.montoTotal || 0), 0);
  const cantidadVentas = ventasFiltradas.length;
  const promedioVenta = cantidadVentas > 0 ? totalVentas / cantidadVentas : 0;
  const ventasActivas = ventasFiltradas.filter(v => v.estado === 1).length;

  // Datos para gr�ficos
  const ventasPorDia = ventasFiltradas.reduce((acc, v) => {
    const fecha = v.fechaVenta;
    if (!acc[fecha]) {
      acc[fecha] = { fecha, total: 0, cantidad: 0 };
    }
    acc[fecha].total += Number(v.montoTotal || 0);
    acc[fecha].cantidad += 1;
    return acc;
  }, {});
  const dataVentasPorDia = Object.values(ventasPorDia)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(-30);

  const ventasPorTipoPago = ventasFiltradas.reduce((acc, v) => {
    const tipo = v.tipoPago || 'Sin especificar';
    if (!acc[tipo]) {
      acc[tipo] = { nombre: tipo, total: 0, cantidad: 0 };
    }
    acc[tipo].total += Number(v.montoTotal || 0);
    acc[tipo].cantidad += 1;
    return acc;
  }, {});
  const dataVentasPorTipoPago = Object.values(ventasPorTipoPago);

  const ventasPorTipo = ventasFiltradas.reduce((acc, v) => {
    const tipo = v.tipoVenta || 'Sin especificar';
    if (!acc[tipo]) {
      acc[tipo] = { nombre: tipo, total: 0, cantidad: 0 };
    }
    acc[tipo].total += Number(v.montoTotal || 0);
    acc[tipo].cantidad += 1;
    return acc;
  }, {});
  const dataVentasPorTipo = Object.values(ventasPorTipo);

  const topClientes = Object.values(
    ventasFiltradas.reduce((acc, v) => {
      const cliente = v.nombreCliente || 'Sin especificar';
      if (!acc[cliente]) {
        acc[cliente] = { nombre: cliente, total: 0, cantidad: 0 };
      }
      acc[cliente].total += Number(v.montoTotal || 0);
      acc[cliente].cantidad += 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-xl sm:text-2xl font-bold dark:text-white">Ventas</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 transition font-semibold"
          >
            {showCreate ? '? Cancelar' : '? Nueva Venta'}
          </button>
          <button
            onClick={() => { setShowEntregas(v => { const nv = !v; if (nv) { setShowCreate(false); loadEntregas(); loadRutas(); } return nv; }); }}
            className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 transition font-semibold"
          >
            {showEntregas ? '❌ Cerrar Entregas' : '🚚 Entregas (Chofer)'}
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            {showFilters ? '🔽 Ocultar Filtros' : '🔼 Mostrar Filtros'}
          </button>
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition"
          >
            {showSummary ? '📊 Ocultar Resumen' : '📈 Mostrar Resumen'}
          </button>
        </div>
      </div>

      {/* Formulario para crear venta */}
      {showCreate && (
        <div className="mb-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 dark:text-white">Nueva Venta</h3>
          {(errTiposVenta || errTiposPago || errClientes || errProductos) && (
            <div className="mb-3 p-3 rounded border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200 text-sm">
              <div className="font-semibold mb-1">Atenci�n: algunos cat�logos no se cargaron</div>
              <ul className="list-disc ml-5">
                {errTiposVenta && <li>{errTiposVenta}</li>}
                {errTiposPago && <li>{errTiposPago}</li>}
                {errClientes && <li>{errClientes}</li>}
                {errProductos && <li>{errProductos}</li>}
              </ul>
              <div className="mt-1">Reintenta recargando la p�gina; si persiste, verifica tu sesi�n o conexi�n.</div>
            </div>
          )}
          
          {/* Informaci�n principal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="relative">
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Cliente (ID o Nombre) *</label>
              <input
                type="text"
                value={clienteBusqueda}
                placeholder="Ej: 123 o Juan"
                onChange={(e)=>{
                  const val = e.target.value
                  setClienteBusqueda(val)
                  if(!val){ setClienteSugeridos([]); return }
                  const esNumero = /^\d+$/.test(val.trim())
                  let sugs = []
                  if(esNumero){
                    sugs = clientes.filter(p => String(p.id_persona || p.idPersona) === String(parseInt(val)))
                  }else{
                    const q = val.toLowerCase()
                    sugs = clientes.filter(p => {
                      const nombre = [p.nombres_persona, p.apellido_paternoPersona, p.apellido_maternoPer, p.nombreCompleto, p.nombre, p.apellido]
                        .filter(Boolean).join(' ').toLowerCase()
                      return nombre.includes(q)
                    }).slice(0,20)
                  }
                  setClienteSugeridos(sugs)
                }}
                onKeyDown={(e)=>{
                  if(e.key==='Tab'){
                    const val = clienteBusqueda.trim()
                    if(!val) return
                    const esNumero = /^\d+$/.test(val)
                    let match = null
                    if(esNumero){
                      match = clientes.find(p => String(p.id_persona || p.idPersona) === String(parseInt(val)))
                    }else{
                      const q = val.toLowerCase()
                      const matches = clientes.filter(p => {
                        const nombre = [p.nombres_persona, p.apellido_paternoPersona, p.apellido_maternoPer, p.nombreCompleto, p.nombre, p.apellido]
                          .filter(Boolean).join(' ').toLowerCase()
                        return nombre.includes(q)
                      })
                      if(matches.length === 1) match = matches[0]
                      else if(matches.length > 1){ setClienteSugeridos(matches.slice(0,20)); e.preventDefault(); return }
                    }
                    if(match){
                      e.preventDefault()
                      const id = match.id_persona ?? match.idPersona
                      const nombre = [match.nombres_persona, match.apellido_paternoPersona, match.apellido_maternoPer, match.nombreCompleto, match.nombre, match.apellido]
                        .filter(Boolean).join(' ')
                      setFormVenta(prev=>({...prev, idCliente: String(id)}))
                      setClienteBusqueda(`${nombre} (ID ${id})`)
                      setClienteSugeridos([])
                    }
                  }
                }}
                className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
              />
              {clienteSugeridos.length>0 && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded shadow max-h-60 overflow-y-auto">
                  {clienteSugeridos.map(p => {
                    const id = p.id_persona ?? p.idPersona
                    const nombre = [p.nombres_persona, p.apellido_paternoPersona, p.apellido_maternoPer, p.nombreCompleto, p.nombre, p.apellido]
                      .filter(Boolean).join(' ')
                    return (
                      <div key={id} className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-700"
                           onClick={()=>{ setFormVenta(prev=>({...prev, idCliente: String(id)})); setClienteBusqueda(`${nombre} (ID ${id})`); setClienteSugeridos([]) }}>
                        <div className="font-medium dark:text-white">{nombre || `Persona ${id}`}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">ID: {id}</div>
                      </div>
                    )
                  })}
                </div>
              )}
              {formVenta.idCliente && (
                (() => {
                  const selId = String(formVenta.idCliente)
                  const persona = clientes.find(p => String(p.id_persona ?? p.idPersona) === selId)
                  const nombre = persona
                    ? [persona.nombres_persona, persona.apellido_paternoPersona, persona.apellido_maternoPer, persona.nombreCompleto, persona.nombre, persona.apellido]
                        .filter(Boolean).join(' ')
                    : ''
                  const tipoCliente = formVenta.idTipoVenta === '1' ? 'Mayorista' : 'Minorista'
                  const colorTipo = formVenta.idTipoVenta === '1' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                  return (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                        <span className="font-semibold mr-1">Cliente:</span>
                        {nombre ? `${nombre} (ID ${selId})` : `ID ${selId}`}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${colorTipo}`}>
                        {tipoCliente}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setFormVenta(prev=>({...prev, idCliente: '', idTipoVenta: '2'})); setClienteBusqueda(''); setClienteSugeridos([]); }}
                        className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                      >
                        Quitar
                      </button>
                    </div>
                  )
                })()
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Forma de Pago *</label>
              <select
                value={formVenta.idTipoPago}
                onChange={(e) => setFormVenta({...formVenta, idTipoPago: e.target.value})}
                className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
              >
                {tiposPago.map(tp => (
                  <option key={tp.idPago} value={tp.idPago}>
                    {tp.tipoPago}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Indicador de pago para cr�dito */}
          {formVenta.idTipoPago === '1' && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded">
              <p className="text-sm dark:text-yellow-200">
                <span className="font-semibold">Pago:</span> 
                <span className="ml-2 px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded font-semibold">
                  No
                </span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  (Se crear� cuenta corriente pendiente)
                </span>
              </p>
            </div>
          )}
          
          {/* Agregar producto */}
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
            <h4 className="font-semibold mb-3 dark:text-white">
              Agregar Producto
              {productos.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                  ({productos.length} productos disponibles)
                </span>
              )}
              {productos.length === 0 && (
                <span className="ml-2 text-xs font-normal text-red-500">
                  (No hay productos cargados)
                </span>
              )}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2 relative">
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  Buscar (ID o Nombre)
                </label>
                <input
                  type="text"
                  value={nuevoDetalle.busqueda}
                  onChange={(e) => buscarProductoMientrasEscribe(e.target.value)}
                  onKeyDown={buscarProducto}
                  placeholder="Ej: 5 o vodka"
                  className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                />
                {productosSugeridos.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                    {productosSugeridos.map(p => (
                      <div
                        key={p.idProducto}
                        onClick={() => seleccionarProducto(p)}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-600 last:border-b-0"
                      >
                        <div className="font-medium dark:text-white">{p.nombreProducto}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          ID: {p.idProducto} | Stock: {p.stock_total_lotes ?? p.stockCaja ?? 0}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Cantidad</label>
                <input
                  type="number"
                  step="0.01"
                  value={nuevoDetalle.cantidad_caja}
                  onChange={(e) => setNuevoDetalle({...nuevoDetalle, cantidad_caja: e.target.value})}
                  disabled={!nuevoDetalle.idProducto}
                  className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                />
                {nuevoDetalle.stockDisponible > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Stock: {nuevoDetalle.stockDisponible}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="venderUnidades"
                    type="checkbox"
                    checked={nuevoDetalle.venderUnidades}
                    onChange={(e)=> setNuevoDetalle({...nuevoDetalle, venderUnidades: e.target.checked})}
                    disabled={!nuevoDetalle.idProducto}
                  />
                  <label htmlFor="venderUnidades" className="text-sm dark:text-gray-300">Vender por unidades</label>
                </div>
                {nuevoDetalle.venderUnidades && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs mb-1 dark:text-gray-400">Unidades</label>
                      <input type="number" step="1" min="1" value={nuevoDetalle.unidades}
                        onChange={(e)=> setNuevoDetalle({...nuevoDetalle, unidades: e.target.value})}
                        className="w-full border dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs mb-1 dark:text-gray-400">Unid/paquete</label>
                      <input type="number" step="1" min="1" value={nuevoDetalle.unidadesPorPaquete}
                        onChange={(e)=> setNuevoDetalle({...nuevoDetalle, unidadesPorPaquete: e.target.value})}
                        placeholder="Ej: 6, 12, 24"
                        className="w-full border dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white" />
                    </div>
                    <div className="col-span-2 text-xs text-gray-500 dark:text-gray-400">
                      Se convertir� a cajas: cajas = unidades / unid/paquete
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  {nuevoDetalle.venderUnidades ? 'Precio/Paquete' : 'Precio/Caja'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={nuevoDetalle.precio_por_paquete}
                  readOnly
                  disabled={!nuevoDetalle.idProducto}
                  className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white disabled:opacity-50 bg-gray-100 dark:bg-gray-600"
                  title="El precio se obtiene autom�ticamente del lote FEFO"
                />
                {nuevoDetalle.loteInfo && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    📦 Lote: {nuevoDetalle.loteInfo.codigoLote} | Vence: {nuevoDetalle.loteInfo.fechaVencimiento}
                  </p>
                )}
                {nuevoDetalle.venderUnidades && nuevoDetalle.unidadesPorPaquete && nuevoDetalle.precio_por_paquete && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Precio/unidad: {(parseFloat(nuevoDetalle.precio_por_paquete) / parseFloat(nuevoDetalle.unidadesPorPaquete)).toFixed(2)}
                  </p>
                )}
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={agregarDetalle}
                  disabled={!nuevoDetalle.idProducto}
                  className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ? Agregar
                </button>
              </div>
            </div>
          </div>
          
          {/* Lista de productos agregados */}
          {detalles.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold mb-2 dark:text-white">Productos en la Venta</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border dark:border-gray-600">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left dark:text-white">Producto</th>
                      <th className="px-3 py-2 text-right dark:text-white">Cantidad</th>
                      <th className="px-3 py-2 text-right dark:text-white">Precio Unit.</th>
                      <th className="px-3 py-2 text-right dark:text-white">Subtotal</th>
                      <th className="px-3 py-2 text-center dark:text-white">Acci�n</th>
                    </tr>
                  </thead>
                  <tbody className="dark:text-gray-300">
                    {detalles.map((det, idx) => (
                      <tr key={idx} className="border-t dark:border-gray-600">
                        <td className="px-3 py-2">
                          {det.nombreProducto}
                          {det.loteInfo && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              📦 Lote: {det.loteInfo.codigoLote} | Vence: {det.loteInfo.fechaVencimiento}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{det.cantidad_caja}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(det.precio_unitario)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatMoney(det.subtotal)}</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => eliminarDetalle(idx)}
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            ?
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-700">
                    <tr className="border-t-2 border-gray-300 dark:border-gray-500">
                      <td colSpan="3" className="px-3 py-2 text-right font-medium dark:text-gray-300">Subtotal:</td>
                      <td className="px-3 py-2 text-right font-medium dark:text-white">{formatMoney(calcularTotal())}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan="3" className="px-3 py-2 text-right text-sm dark:text-gray-300">
                        Descuento ({parseFloat(formVenta.descuentoPorcentaje || 0).toFixed(2)}%):
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-red-600 dark:text-red-400">
                        -{formatMoney(calcularDescuento())}
                      </td>
                      <td></td>
                    </tr>
                    <tr className="border-t-2 border-gray-400 dark:border-gray-400 bg-gray-100 dark:bg-gray-600">
                      <td colSpan="3" className="px-3 py-3 text-right font-bold text-lg dark:text-white">TOTAL FINAL:</td>
                      <td className="px-3 py-3 text-right font-bold text-xl text-green-700 dark:text-green-400">
                        {formatMoney(calcularTotalFinal())}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
          
          {/* Descuento (%) */}
          {detalles.length > 0 && (
            <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <label className="block text-sm font-semibold mb-2 dark:text-gray-300">
                Descuento (%) <span className="font-normal text-gray-500 dark:text-gray-400">(opcional)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formVenta.descuentoPorcentaje}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setFormVenta({...formVenta, descuentoPorcentaje: Math.min(Math.max(val, 0), 100)});
                  }}
                  className="w-32 border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white text-right"
                  placeholder="0.00"
                />
                <span className="text-gray-600 dark:text-gray-400">%</span>
                {formVenta.descuentoPorcentaje > 0 && (
                  <span className="ml-auto text-sm text-red-600 dark:text-red-400 font-medium">
                    Descuento: -{formatMoney(calcularDescuento())}
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* Observaciones */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Observaciones</label>
            <textarea
              value={formVenta.observaciones}
              onChange={(e) => setFormVenta({...formVenta, observaciones: e.target.value})}
              rows="2"
              className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
              placeholder="Notas adicionales (opcional)"
            />
          </div>
          
          {/* Botones de acci�n */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmitVenta}
              disabled={submitting || detalles.length === 0}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Guardando...' : '💾 Guardar Venta'}
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setFormVenta({idCliente: '', idTipoVenta: '2', idTipoPago: '1', observaciones: ''});
                setDetalles([]);
                setNuevoDetalle({busqueda: '', idProducto: '', nombreProducto: '', cantidad_caja: '', precio_unitario: '', stockDisponible: 0});
              }}
              className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal de mapa del chofer */}
      {mapaEntrega && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-lg font-bold dark:text-white">📍 Ubicación en tiempo real</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Entrega #{mapaEntrega.numeroEntrega}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`${mapaEntrega.online ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'} text-xs px-2 py-0.5 rounded`}>{mapaEntrega.online ? 'En línea' : 'Desconectado'}</span>
                <button onClick={()=>{ try{mapaEntrega?.socket?.close?.()}catch{}; setMapaEntrega(null); }} className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">Cerrar</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {mapaEntrega.ultima ? (
                <div className="w-full h-[420px] relative">
                  {(() => {
                    const lat = Number(mapaEntrega.ultima.lat);
                    const lng = Number(mapaEntrega.ultima.lng);
                    const acc = mapaEntrega.ultima?.accuracy != null ? Number(mapaEntrega.ultima.accuracy) : null;
                    return (
                      <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution="&copy; OpenStreetMap contributors"
                        />
                        <Marker position={[lat, lng]} />
                        {acc && acc > 0 && (
                          <Circle center={[lat, lng]} radius={acc} pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.15 }} />
                        )}
                      </MapContainer>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-600 dark:text-gray-300">Sin ubicación registrada aún…</div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm">
              <div className="text-gray-600 dark:text-gray-300">
                {mapaEntrega?.ultima ? (
                  <>
                    <span>Lat/Lng: </span>
                    <span className="font-mono">{Number(mapaEntrega.ultima.lat).toFixed(6)}, {Number(mapaEntrega.ultima.lng).toFixed(6)}</span>
                    {mapaEntrega.ultima.accuracy != null && (
                      <span className="ml-2">±{Number(mapaEntrega.ultima.accuracy).toFixed(0)}m</span>
                    )}
                    <span className="ml-3 text-xs text-gray-500 dark:text-gray-400">{mapaEntrega.ultima.updated_at ? new Date(mapaEntrega.ultima.updated_at).toLocaleString() : ''}</span>
                  </>
                ) : <span>Esperando primera ubicación…</span>}
              </div>
              {mapaEntrega?.ultima && (
                <a
                  className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                  href={`https://www.google.com/maps?q=${encodeURIComponent(mapaEntrega.ultima.lat + ',' + mapaEntrega.ultima.lng)}`}
                  target="_blank" rel="noreferrer"
                >
                  Abrir en Google Maps
                </a>
              )}
            </div>
          </div>
        </div>
      )}

          {/* Secci�n de Entregas (Chofer) */}
      {showEntregas && (
        <div className="mb-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xl font-bold dark:text-white">Entregas por Ruta</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                🚚 Los productos enviados est�n "en ruta" hasta que el cami�n retorne. El encargado solo puede vender de su stock en ruta.
              </p>
            </div>
            <button
              onClick={() => setCrearEntregaOpen(!crearEntregaOpen)}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              {crearEntregaOpen ? '? Cancelar' : '? Nueva Entrega'}
            </button>
          </div>

          {/* Crear Entrega */}
          {crearEntregaOpen && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
              <h4 className="font-semibold mb-3 dark:text-white">📋 Crear Nuevo Manifiesto de Entrega</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Al crear la entrega, los productos salen del almac�n y pasan a estar "en ruta" con el encargado.
                El cami�n debe retornar para finalizar y registrar ventas en caja.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Ruta *</label>
                  <select
                    value={formEntrega.idRuta}
                    onChange={async (e) => { const idRuta = e.target.value; setFormEntrega({ ...formEntrega, idRuta }); if (idRuta) await ensureRutaPrecioCache(Number(idRuta)); }}
                    className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Seleccione...</option>
                    {rutas.map(r => (<option key={r.idRuta} value={r.idRuta}>{r.nombreRuta}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Encargado/Chofer *</label>
                  <select
                    value={formEntrega.idEncargado}
                    onChange={(e) => setFormEntrega({ ...formEntrega, idEncargado: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Seleccione...</option>
                    {clientes.map(p => (
                      <option key={p.id_persona || p.idPersona} value={p.id_persona || p.idPersona}>
                        {(p.nombres_persona || p.nombre || '') + ' ' + (p.apellido_paternoPersona || p.apellido || '')}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Solo puede tener una entrega activa a la vez</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Fecha salida *</label>
                  <input type="date" value={formEntrega.fechaSalida} onChange={(e) => setFormEntrega({ ...formEntrega, fechaSalida: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Observaciones</label>
                  <input type="text" value={formEntrega.observaciones} onChange={(e) => setFormEntrega({ ...formEntrega, observaciones: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white" 
                    placeholder="Opcional"/>
                </div>
              </div>
              
              {/* Add producto */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="md:col-span-2 relative">
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Buscar producto</label>
                  <input type="text" value={nuevoDetEntrega.busqueda} onChange={(e)=>buscarProductoEntregaMientrasEscribe(e.target.value)}
                         placeholder="Ej: 5 o vodka" className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white" />
                  {productosSugEntrega.length>0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded shadow max-h-60 overflow-y-auto">
                      {productosSugEntrega.map(p => (
                        <div key={p.idProducto} className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-600 last:border-b-0"
                             onClick={()=> seleccionarProductoEntrega(p)}>
                          <div className="font-medium dark:text-white">{p.nombreProducto}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">ID: {p.idProducto} | Stock almac�n: {p.stock_total_lotes ?? p.stockCaja ?? 0}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Cantidad a enviar</label>
                  <input type="number" step="0.01" value={nuevoDetEntrega.cantidadEnviada}
                         onChange={(e)=> setNuevoDetEntrega({ ...nuevoDetEntrega, cantidadEnviada: e.target.value })}
                         disabled={!nuevoDetEntrega.idProducto}
                         className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white disabled:opacity-50" />
                  {nuevoDetEntrega.stockDisponible > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">📦 Almac�n: {nuevoDetEntrega.stockDisponible}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Precio Unit. (ruta)</label>
                  <input type="number" step="0.01" value={nuevoDetEntrega.precioUnitario}
                         onChange={(e)=> setNuevoDetEntrega({ ...nuevoDetEntrega, precioUnitario: e.target.value })}
                         disabled={!nuevoDetEntrega.idProducto}
                         className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white disabled:opacity-50" />
                  {nuevoDetEntrega.codigoLote && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">📦 Lote: {nuevoDetEntrega.codigoLote} {nuevoDetEntrega.fechaVencimiento ? `| Vence: ${nuevoDetEntrega.fechaVencimiento}` : ''}</p>
                  )}
                </div>
                <div className="flex items-end">
                  <button onClick={agregarDetalleEntrega} disabled={!nuevoDetEntrega.idProducto}
                          className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">? Agregar</button>
                </div>
              </div>

              {/* Tabla detalles entrega */}
              {detallesEntrega.length>0 && (
                <div className="mt-4 overflow-x-auto">
                  <h5 className="font-semibold mb-2 dark:text-white">Productos a enviar (saldr�n del almac�n)</h5>
                  <table className="w-full text-sm border dark:border-gray-600">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left dark:text-white">Producto</th>
                        <th className="px-3 py-2 text-left dark:text-white">Lote FEFO</th>
                        <th className="px-3 py-2 text-right dark:text-white">Cant. Enviada</th>
                        <th className="px-3 py-2 text-right dark:text-white">Precio Unit.</th>
                        <th className="px-3 py-2 text-right dark:text-white">Valor Total</th>
                        <th className="px-3 py-2 text-center dark:text-white">Acci�n</th>
                      </tr>
                    </thead>
                    <tbody className="dark:text-gray-300">
                      {detallesEntrega.map((d, idx) => (
                        <tr key={idx} className="border-t dark:border-gray-600">
                          <td className="px-3 py-2">{d.nombreProducto}</td>
                          <td className="px-3 py-2 text-xs">{d.codigoLote || '-'}{d.fechaVencimiento ? ` | ${d.fechaVencimiento}` : ''}</td>
                          <td className="px-3 py-2 text-right">{d.cantidadEnviada}</td>
                          <td className="px-3 py-2 text-right">{formatMoney(d.precioUnitario)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatMoney(Number(d.cantidadEnviada)*Number(d.precioUnitario))}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={()=>eliminarDetalleEntrega(idx)} className="text-red-500 hover:text-red-700 font-bold">?</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-700">
                      <tr className="border-t-2 dark:border-gray-500">
                        <td colSpan="4" className="px-3 py-2 text-right font-bold dark:text-white">TOTAL VALOR ENVIADO:</td>
                        <td className="px-3 py-2 text-right font-bold text-lg dark:text-white">
                          {formatMoney(detallesEntrega.reduce((sum, d) => sum + (Number(d.cantidadEnviada) * Number(d.precioUnitario)), 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-2 flex items-start gap-2">
                    <span className="text-lg">⚠️</span>
                    <span>Estos productos quedar�n "en ruta" con el encargado. No se registrar�n en caja hasta que el cami�n retorne y se finalice la entrega.</span>
                  </p>
                </div>
              )}

              <div className="mt-4 flex gap-3">
                <button onClick={submitEntrega} disabled={detallesEntrega.length===0 || !formEntrega.idRuta || !formEntrega.idEncargado}
                        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  🚚 Crear Entrega y Enviar Cami�n
                </button>
                <button onClick={()=>{ setCrearEntregaOpen(false); setFormEntrega({ idRuta:'', idEncargado:'', fechaSalida:new Date().toISOString().split('T')[0], observaciones:''}); setDetallesEntrega([]); setNuevoDetEntrega({busqueda:'', idProducto:'', nombreProducto:'', idLote:null, codigoLote:'', fechaVencimiento:'', stockDisponible:0, cantidadEnviada:'', precioUnitario:''}); }}
                        className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">Cancelar</button>
              </div>
            </div>
          )}

          {/* Listado de entregas */}
          <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
            {entregasLoading ? (
              <div className="p-4 text-sm text-gray-600 dark:text-gray-300">Cargando entregas...</div>
            ) : entregasError ? (
              <div className="p-4 text-sm text-red-600 dark:text-red-400">{entregasError}</div>
            ) : (
              <div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-900 dark:text-blue-200">
                    <strong>Estados:</strong> <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 rounded text-xs mr-2">en_ruta</span> = Cami�n en la calle, encargado puede vender de su stock
                    | <span className="px-2 py-1 bg-green-100 dark:bg-green-900 rounded text-xs ml-2">finalizado</span> = Cami�n retorn�, efectivo en caja
                  </p>
                </div>
                
                {/* Vista Desktop: Tabla */}
                <div className="hidden md:block">
                  <table className="min-w-full">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium dark:text-gray-200">#</th>
                        <th className="px-4 py-2 text-left text-sm font-medium dark:text-gray-200">Ruta</th>
                        <th className="px-4 py-2 text-left text-sm font-medium dark:text-gray-200">Encargado</th>
                        <th className="px-4 py-2 text-left text-sm font-medium dark:text-gray-200">Salida</th>
                        <th className="px-4 py-2 text-left text-sm font-medium dark:text-gray-200">Retorno</th>
                        <th className="px-4 py-2 text-right text-sm font-medium dark:text-gray-200">Total Vendido</th>
                        <th className="px-4 py-2 text-left text-sm font-medium dark:text-gray-200">Estado</th>
                        <th className="px-4 py-2 text-center text-sm font-medium dark:text-gray-200">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {entregas.length === 0 ? (
                        <tr><td colSpan="8" className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">No hay entregas registradas</td></tr>
                      ) : entregas.map(e => (
                        <>
                          <tr key={e.idEntrega} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="px-4 py-2 text-sm dark:text-gray-100"><span className="font-mono">{e.numeroEntrega || e.idEntrega}</span></td>
                            <td className="px-4 py-2 text-sm dark:text-gray-100">{e.nombreRuta || e.idRuta}</td>
                            <td className="px-4 py-2 text-sm dark:text-gray-100">{e.nombreEncargado || e.idEncargado}</td>
                            <td className="px-4 py-2 text-sm dark:text-gray-100">{e.fechaSalida}</td>
                            <td className="px-4 py-2 text-sm dark:text-gray-100">{e.fechaRetorno || '-'}</td>
                            <td className="px-4 py-2 text-sm text-right dark:text-gray-100">
                              <span className="font-semibold text-green-600 dark:text-green-400">{formatMoney(e.totalVendido || 0)}</span>
                            </td>
                            <td className="px-4 py-2 text-sm">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                normalizeEstado(e.estado) === 'finalizado' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                                : normalizeEstado(e.estado) === 'en_ruta' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                              }`}>{normalizeEstado(e.estado) === 'en_ruta' ? '🚚 EN RUTA' : normalizeEstado(e.estado) === 'finalizado' ? '✅ FINALIZADO' : (e.estado || '')}</span>
                            </td>
                            <td className="px-4 py-2 text-sm text-center">
                              <div className="flex gap-2 justify-center">
                                <button onClick={()=>toggleExpandEntrega(e)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">{entregasExpanded[e.idEntrega] ? 'Ocultar' : 'Ver Detalle'}</button>
                                {normalizeEstado(e.estado) === 'en_ruta' && (
                                  <button onClick={()=>abrirMapa(e)} className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700">📍 Ver mapa</button>
                                )}
                                {normalizeEstado(e.estado) !== 'finalizado' && (
                                  <button onClick={()=>finalizarEntrega(e.idEntrega)} className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">🔚 Finalizar Retorno</button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {entregasExpanded[e.idEntrega] && (
                            <tr className="bg-gray-50 dark:bg-gray-800"><td colSpan="8" className="px-4 py-3">
                              <div className="text-sm dark:text-gray-200 font-medium mb-2">Detalles</div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm border dark:border-gray-700">
                                  <thead className="bg-gray-100 dark:bg-gray-700">
                                    <tr>
                                      <th className="px-3 py-2 text-left">Producto</th>
                                      <th className="px-3 py-2 text-left">Lote</th>
                                      <th className="px-3 py-2 text-right">Enviado</th>
                                      <th className="px-3 py-2 text-right">Devuelto</th>
                                      <th className="px-3 py-2 text-right">Vendido</th>
                                      <th className="px-3 py-2 text-right">Precio</th>
                                      <th className="px-3 py-2 text-right">Monto</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(entregasExpanded[e.idEntrega]?.detalles || []).map((d, i) => (
                                      <tr key={d.idDetalle || i} className="border-t dark:border-gray-700">
                                        <td className="px-3 py-2">{d.nombreProducto || d.idProducto}</td>
                                        <td className="px-3 py-2 text-xs">{d.codigoLote || '-'}{d.idLote ? ` (#${d.idLote})` : ''}</td>
                                        <td className="px-3 py-2 text-right">{Number(d.cantidadEnviada).toFixed(2)}</td>
                                        <td className="px-3 py-2 text-right">{Number(d.cantidadDevuelta).toFixed(2)}</td>
                                        <td className="px-3 py-2 text-right">{Number(d.cantidadVendida).toFixed(2)}</td>
                                        <td className="px-3 py-2 text-right">{formatMoney(d.precioUnitario)}</td>
                                        <td className="px-3 py-2 text-right font-semibold">{formatMoney(d.montoTotal)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td></tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Vista Mobile: Cards */}
                <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
                  {entregas.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">No hay entregas registradas</div>
                  ) : entregas.map(e => (
                    <div key={e.idEntrega} className="p-4 space-y-3">
                      {/* Header del card */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">#{e.numeroEntrega || e.idEntrega}</div>
                          <div className="font-semibold dark:text-white">{e.nombreRuta || e.idRuta}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">{e.nombreEncargado || e.idEncargado}</div>
                        </div>
                        <div>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            normalizeEstado(e.estado) === 'finalizado' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                            : normalizeEstado(e.estado) === 'en_ruta' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}>{normalizeEstado(e.estado) === 'en_ruta' ? '🚚 EN RUTA' : normalizeEstado(e.estado) === 'finalizado' ? '✅ FINALIZADO' : (e.estado || '')}</span>
                        </div>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Salida:</span>
                          <span className="ml-1 dark:text-gray-200">{e.fechaSalida}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Retorno:</span>
                          <span className="ml-1 dark:text-gray-200">{e.fechaRetorno || '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500 dark:text-gray-400">Total Vendido:</span>
                          <span className="ml-1 font-semibold text-green-600 dark:text-green-400">{formatMoney(e.totalVendido || 0)}</span>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex gap-2">
                        <button 
                          onClick={()=>toggleExpandEntrega(e)} 
                          className="flex-1 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                          {entregasExpanded[e.idEntrega] ? 'Ocultar Detalle' : 'Ver Detalle'}
                        </button>
                        {normalizeEstado(e.estado) === 'en_ruta' && (
                          <button 
                            onClick={()=>abrirMapa(e)} 
                            className="flex-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                          >
                            📍 Mapa
                          </button>
                        )}
                        {normalizeEstado(e.estado) !== 'finalizado' && (
                          <button 
                            onClick={()=>finalizarEntrega(e.idEntrega)} 
                            className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            🔚 Finalizar
                          </button>
                        )}
                      </div>

                      {/* Detalles expandidos */}
                      {entregasExpanded[e.idEntrega] && (
                        <div className="mt-3 bg-gray-50 dark:bg-gray-800 rounded p-3 space-y-2">
                          <div className="text-sm font-medium dark:text-gray-200 mb-2">Detalles de Productos</div>
                          {(entregasExpanded[e.idEntrega]?.detalles || []).map((d, i) => (
                            <div key={d.idDetalle || i} className="border-t dark:border-gray-700 pt-2 text-sm">
                              <div className="font-medium dark:text-white">{d.nombreProducto || d.idProducto}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Lote: {d.codigoLote || '-'}{d.idLote ? ` (#${d.idLote})` : ''}</div>
                              <div className="grid grid-cols-2 gap-1 text-xs">
                                <div><span className="text-gray-500 dark:text-gray-400">Enviado:</span> {Number(d.cantidadEnviada).toFixed(2)}</div>
                                <div><span className="text-gray-500 dark:text-gray-400">Devuelto:</span> {Number(d.cantidadDevuelta).toFixed(2)}</div>
                                <div><span className="text-gray-500 dark:text-gray-400">Vendido:</span> {Number(d.cantidadVendida).toFixed(2)}</div>
                                <div><span className="text-gray-500 dark:text-gray-400">Precio:</span> {formatMoney(d.precioUnitario)}</div>
                              </div>
                              <div className="mt-1 text-right font-semibold text-green-600 dark:text-green-400">Total: {formatMoney(d.montoTotal)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal para finalizar entrega (retorno del cami�n) */}
      {finalizandoEntrega && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold dark:text-white">🏁 Finalizar Retorno de Entrega</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Ingrese las cantidades devueltas. Las cantidades vendidas se calcular�n autom�ticamente.
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Fecha de retorno</label>
                  <input
                    type="date"
                    value={finalizandoEntrega.fechaRetorno}
                    onChange={(e) => setFinalizandoEntrega({ ...finalizandoEntrega, fechaRetorno: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Método de pago</label>
                  <select
                    value={finalizandoEntrega.metodo_pago}
                    onChange={(e) => setFinalizandoEntrega({ ...finalizandoEntrega, metodo_pago: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="Contado">Contado</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Credito">Crédito</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Observaciones</label>
                  <input
                    type="text"
                    value={finalizandoEntrega.observaciones}
                    onChange={(e) => setFinalizandoEntrega({ ...finalizandoEntrega, observaciones: e.target.value })}
                    placeholder="Opcional"
                    className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border dark:border-gray-600">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left dark:text-white">Producto</th>
                      <th className="px-3 py-2 text-left dark:text-white">Lote</th>
                      <th className="px-3 py-2 text-right dark:text-white">Enviado</th>
                      <th className="px-3 py-2 text-right dark:text-white">Devuelto</th>
                      <th className="px-3 py-2 text-right dark:text-white">Vendido</th>
                      <th className="px-3 py-2 text-right dark:text-white">Precio Unit.</th>
                      <th className="px-3 py-2 text-right dark:text-white">Total Venta</th>
                    </tr>
                  </thead>
                  <tbody className="dark:text-gray-300">
                    {finalizandoEntrega.detalles.map((d, idx) => {
                      const enviada = Number(d.cantidadEnviada) || 0;
                      const devuelta = Number(d.cantidadDevuelta) || 0;
                      const vendida = enviada - devuelta;
                      const totalVenta = vendida * (Number(d.precioUnitario) || 0);
                      
                      return (
                        <tr key={d.idDetalle || idx} className="border-t dark:border-gray-600">
                          <td className="px-3 py-2">{d.nombreProducto}</td>
                          <td className="px-3 py-2 text-xs">{d.codigoLote || '-'}</td>
                          <td className="px-3 py-2 text-right">{enviada.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={enviada}
                              value={d.cantidadDevuelta}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const newVal = Math.min(Math.max(0, val), enviada);
                                setFinalizandoEntrega({
                                  ...finalizandoEntrega,
                                  detalles: finalizandoEntrega.detalles.map((det, i) =>
                                    i === idx ? { ...det, cantidadDevuelta: newVal } : det
                                  )
                                });
                              }}
                              className="w-20 border dark:border-gray-600 rounded px-2 py-1 text-right dark:bg-gray-700 dark:text-white"
                            />
                          </td>
                          <td className={`px-3 py-2 text-right font-semibold ${vendida > 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                            {vendida.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right">{formatMoney(d.precioUnitario)}</td>
                          <td className={`px-3 py-2 text-right font-bold ${totalVenta > 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                            {formatMoney(totalVenta)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-700 border-t-2 dark:border-gray-500">
                    <tr>
                      <td colSpan="4" className="px-3 py-2 text-right font-bold dark:text-white">TOTALES:</td>
                      <td className="px-3 py-2 text-right font-bold text-green-600 dark:text-green-400">
                        {finalizandoEntrega.detalles.reduce((sum, d) => sum + (Number(d.cantidadEnviada) - Number(d.cantidadDevuelta)), 0).toFixed(2)}
                      </td>
                      <td></td>
                      <td className="px-3 py-2 text-right font-bold text-lg text-green-600 dark:text-green-400">
                        {formatMoney(finalizandoEntrega.detalles.reduce((sum, d) => {
                          const vendida = Number(d.cantidadEnviada) - Number(d.cantidadDevuelta);
                          return sum + (vendida * Number(d.precioUnitario));
                        }, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  <strong>💡 Importante:</strong> El efectivo recaudado se registrar� autom�ticamente en la caja cuando confirme la finalizaci�n.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => setFinalizandoEntrega(null)}
                className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarFinalizacion}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
              >
                ? Confirmar y Registrar en Caja
              </button>
            </div>
          </div>
        </div>
      )}

  {/* Filtros */}
      {showFilters && (
        <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-3 dark:text-white">Filtros</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Estado Pago</label>
              <select
                value={fEstadoPago}
                onChange={e => setFEstadoPago(e.target.value)}
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-white"
              >
                <option value="">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Parcial">Parcial</option>
                <option value="Pagado">Pagado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Desde</label>
              <input
                type="date"
                value={fDesde}
                onChange={(e) => { setFDesde(e.target.value); setPeriodo(''); }}
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Hasta</label>
              <input
                type="date"
                value={fHasta}
                onChange={(e) => { setFHasta(e.target.value); setPeriodo(''); }}
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Cliente</label>
              <input
                type="text"
                value={fCliente}
                onChange={(e) => setFCliente(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Tipo Venta</label>
              <select
                value={fTipoVenta}
                onChange={(e) => setFTipoVenta(e.target.value)}
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-white"
              >
                <option value="">Todos</option>
                {tiposVenta.map(t => (
                  <option key={t.idTipoVenta} value={t.idTipoVenta}>{t.tipoVenta}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Tipo Pago</label>
              <select
                value={fTipoPago}
                onChange={(e) => setFTipoPago(e.target.value)}
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-white"
              >
                <option value="">Todos</option>
                {tiposPago.map(t => (
                  <option key={t.idPago} value={t.idPago}>{t.tipoPago}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Estado</label>
              <select
                value={fEstado}
                onChange={(e) => setFEstado(e.target.value)}
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-white"
              >
                <option value="">Todos</option>
                <option value="1">Activas</option>
                <option value="0">Anuladas</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">ID Producto</label>
              <input
                type="text"
                value={fIdProducto}
                onChange={(e) => setFIdProducto(e.target.value)}
                placeholder="ID del producto..."
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={limpiarFiltros}
              className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

      {/* Resumen y Gr�ficos */}
      {showSummary && !loading && !error && (
        <div className="mb-6 space-y-4">
          {/* Per�odo r�pido */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => handlePeriodoChange('hoy')}
              className={`px-3 py-1.5 text-sm rounded transition ${
                periodo === 'hoy'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => handlePeriodoChange('semana')}
              className={`px-3 py-1.5 text-sm rounded transition ${
                periodo === 'semana'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Esta Semana
            </button>
            <button
              onClick={() => handlePeriodoChange('mes')}
              className={`px-3 py-1.5 text-sm rounded transition ${
                periodo === 'mes'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Este Mes
            </button>
          </div>

          {/* Estad�sticas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-4 text-white">
              <div className="text-sm opacity-90">Total Ventas</div>
              <div className="text-2xl font-bold mt-1">{formatMoney(totalVentas)}</div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-4 text-white">
              <div className="text-sm opacity-90">Cantidad</div>
              <div className="text-2xl font-bold mt-1">{cantidadVentas}</div>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg shadow p-4 text-white">
              <div className="text-sm opacity-90">Promedio</div>
              <div className="text-2xl font-bold mt-1">{formatMoney(promedioVenta)}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-4 text-white">
              <div className="text-sm opacity-90">Activas</div>
              <div className="text-2xl font-bold mt-1">{ventasActivas}</div>
            </div>
          </div>

          {/* Gr�ficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Ventas por d�a */}
            {dataVentasPorDia.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold mb-3 dark:text-white">Ventas por D�a</h3>
                <ResponsiveContainer width="100%" height={isMobile ? 200 : 250}>
                  <BarChart data={dataVentasPorDia}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                      formatter={(value, name) => [
                        name === 'total' ? formatMoney(value) : value,
                        name === 'total' ? 'Total' : 'Cantidad'
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="total" fill="#3b82f6" name="Total" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="cantidad" fill="#10b981" name="Cantidad" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Ventas por tipo de pago */}
            {dataVentasPorTipoPago.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold mb-3 dark:text-white">Por Tipo de Pago</h3>
                <ResponsiveContainer width="100%" height={isMobile ? 200 : 250}>
                  <PieChart>
                    <Pie
                      data={dataVentasPorTipoPago}
                      dataKey="total"
                      nameKey="nombre"
                      cx="50%"
                      cy="50%"
                      outerRadius={isMobile ? 60 : 80}
                      label={(entry) => `${entry.nombre}: ${formatMoney(entry.total)}`}
                      labelStyle={{ fontSize: '10px', fill: '#fff' }}
                    >
                      {dataVentasPorTipoPago.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => formatMoney(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top clientes */}
            {topClientes.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold mb-3 dark:text-white">Top Clientes</h3>
                <ResponsiveContainer width="100%" height={isMobile ? 200 : 250}>
                  <BarChart data={topClientes} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis dataKey="nombre" type="category" width={100} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => formatMoney(value)}
                    />
                    <Bar dataKey="total" fill="#10b981" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Ventas por tipo */}
            {dataVentasPorTipo.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold mb-3 dark:text-white">Por Tipo de Venta</h3>
                <ResponsiveContainer width="100%" height={isMobile ? 200 : 250}>
                  <PieChart>
                    <Pie
                      data={dataVentasPorTipo}
                      dataKey="total"
                      nameKey="nombre"
                      cx="50%"
                      cy="50%"
                      innerRadius={isMobile ? 40 : 50}
                      outerRadius={isMobile ? 60 : 80}
                      label={(entry) => `${entry.nombre}: ${formatMoney(entry.total)}`}
                      labelStyle={{ fontSize: '10px', fill: '#fff' }}
                    >
                      {dataVentasPorTipo.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => formatMoney(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">Cargando...</div>
      ) : error ? (
        <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-200">{error}</div>
      ) : (
        <>
          {/* Desktop Table View - Hidden on mobile */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
            <table className="min-w-full border dark:border-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
                <tr>
                  <th className="p-3 text-left dark:text-gray-200">C�digo</th>
                  <th className="p-3 text-left dark:text-gray-200">Fecha</th>
                  <th className="p-3 text-left dark:text-gray-200">Cliente</th>
                  <th className="p-3 text-left dark:text-gray-200">Empresa</th>
                  <th className="p-3 text-left dark:text-gray-200">Tipo</th>
                  <th className="p-3 text-left dark:text-gray-200">Pago</th>
                  <th className="p-3 text-right dark:text-gray-200">Monto</th>
                  <th className="p-3 text-right dark:text-gray-200">Saldo Pendiente</th>
                  <th className="p-3 text-center dark:text-gray-200">Estado Pago</th>
                  <th className="p-3 text-center dark:text-gray-200">Estado</th>
                  <th className="p-3 text-center dark:text-gray-200">Acciones</th>
                </tr>
              </thead>
              <tbody className="dark:text-gray-300">
                {ventasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-gray-500 dark:text-gray-400">
                      No hay ventas registradas
                    </td>
                  </tr>
                ) : (
                  ventasFiltradas.map(v => (
                    <React.Fragment key={v.idVenta}>
                      <tr className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="p-3"><span className="font-mono text-xs bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">{v.codigoVenta || `#${v.idVenta}`}</span></td>
                        <td className="p-3">{v.fechaVenta}</td>
                        <td className="p-3">{v.nombreCliente}</td>
                        <td className="p-3">{v.nombreEmpresa}</td>
                        <td className="p-3">{v.tipoVenta || '-'}</td>
                        <td className="p-3">{v.tipoPago || '-'}</td>
                        <td className="p-3 text-right font-semibold">{formatMoney(v.montoTotal)}</td>
                        <td className="p-3 text-right font-semibold">{formatMoney((v.montoTotal || 0) - (v.montoPagado || 0))}</td>
                        <td className="p-3 text-center">
                          {/* Estado de pago y progreso */}
                          <div className="flex flex-col items-center gap-1">
                            <div className="text-xs">{formatMoney(v.montoPagado || 0)} / {formatMoney(v.montoTotal || 0)}</div>
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                              (v.estado_pago || '').toLowerCase() === 'pagado' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' :
                              (v.estado_pago || '').toLowerCase() === 'parcial' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' :
                              'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                            }`}>
                              {v.estado_pago || 'Pendiente'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            v.estado === 1 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                          }`}>
                            {v.estado === 1 ? 'Activa' : 'Anulada'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => setVentasExpanded(prev => ({ ...prev, [v.idVenta]: !prev[v.idVenta] }))} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">
                              {ventasExpanded[v.idVenta] ? 'Ocultar' : 'Ver Detalle'}
                            </button>
                            {v.estado === 1 && (userRole === 'admin' || userRole === 'editor' || userRole === 'superadmin') && (
                              <button onClick={() => registrarPagoVenta(v)} className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">
                                💵 Pagar
                              </button>
                            )}
                            {v.estado === 1 && (userRole === 'admin' || userRole === 'superadmin') && (
                              <button onClick={() => anularVenta(v.idVenta)} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">
                                ❌ Anular
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {ventasExpanded[v.idVenta] && (
                        <tr className="bg-gray-50 dark:bg-gray-800">
                          <td colSpan="9" className="p-3">
                            <div className="text-sm dark:text-gray-200 font-medium mb-2">Detalles</div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm border dark:border-gray-700">
                                <thead className="bg-gray-100 dark:bg-gray-700">
                                  <tr>
                                    <th className="px-3 py-2 text-left">Producto</th>
                                    <th className="px-3 py-2 text-right">Cantidad</th>
                                    <th className="px-3 py-2 text-right">Precio</th>
                                    <th className="px-3 py-2 text-right">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(v.detalles || []).map((d, i) => (
                                    <tr key={d.idDetalle || i} className="border-t dark:border-gray-700">
                                      <td className="px-3 py-2">{d.nombreProducto || d.idProducto}</td>
                                      <td className="px-3 py-2 text-right">{Number(d.cantidad_caja).toFixed(2)}</td>
                                      <td className="px-3 py-2 text-right">{formatMoney(d.precio_unitario)}</td>
                                      <td className="px-3 py-2 text-right font-semibold">{formatMoney(d.subtotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View - Visible only on mobile */}
          <div className="md:hidden space-y-4">
            {ventasFiltradas.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
                No hay ventas registradas
              </div>
            ) : (
              ventasFiltradas.map(v => (
                <div key={v.idVenta} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded text-blue-700 dark:text-blue-300">{v.codigoVenta || `#${v.idVenta}`}</span>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        v.estado === 1 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                      }`}>
                        {v.estado === 1 ? 'Activa' : 'Anulada'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setVentasExpanded(prev => ({ ...prev, [v.idVenta]: !prev[v.idVenta] }))} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">
                        {ventasExpanded[v.idVenta] ? 'Ocultar' : 'Ver'}
                      </button>
                      {v.estado === 1 && (userRole === 'admin' || userRole === 'superadmin') && (
                        <button onClick={() => anularVenta(v.idVenta)} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">
                          ❌
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start">
                      <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Fecha:</span>
                      <span className="text-gray-900 dark:text-gray-100">{v.fechaVenta}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Cliente:</span>
                      <span className="text-gray-900 dark:text-gray-100">{v.nombreCliente}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Empresa:</span>
                      <span className="text-gray-900 dark:text-gray-100">{v.nombreEmpresa}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Tipo:</span>
                      <span className="text-gray-900 dark:text-gray-100">{v.tipoVenta || '-'}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Pago:</span>
                      <span className="text-gray-900 dark:text-gray-100">{v.tipoPago || '-'}</span>
                    </div>
                    <div className="flex items-start pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Monto:</span>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">{formatMoney(v.montoTotal)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mt-2 p-2 rounded bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
                      <div className="text-gray-600 dark:text-gray-400">Pagado</div>
                      <div className="text-right text-gray-900 dark:text-gray-100 font-medium">{formatMoney(v.montoPagado || 0)} / {formatMoney(v.montoTotal || 0)}</div>
                      <div className="text-gray-600 dark:text-gray-400">Estado pago</div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          (v.estado_pago || '').toLowerCase() === 'pagado' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' :
                          (v.estado_pago || '').toLowerCase() === 'parcial' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' :
                          'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                        }`}>
                          {v.estado_pago || 'Pendiente'}
                        </span>
                      </div>
                    </div>
                    {(v.estado === 1) && (userRole === 'admin' || userRole === 'editor' || userRole === 'superadmin') && (
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => registrarPagoVenta(v)} className="flex-1 px-3 py-2 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700">💵 Registrar pago</button>
                      </div>
                    )}
                    {ventasExpanded[v.idVenta] && (
                      <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                        <div className="text-sm dark:text-gray-200 font-medium mb-2">Detalles</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border dark:border-gray-700">
                            <thead className="bg-gray-100 dark:bg-gray-700">
                              <tr>
                                <th className="px-3 py-2 text-left">Producto</th>
                                <th className="px-3 py-2 text-right">Cantidad</th>
                                <th className="px-3 py-2 text-right">Precio</th>
                                <th className="px-3 py-2 text-right">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(v.detalles || []).map((d, i) => (
                                <tr key={d.idDetalle || i} className="border-t dark:border-gray-700">
                                  <td className="px-3 py-2">{d.nombreProducto || d.idProducto}</td>
                                  <td className="px-3 py-2 text-right">{Number(d.cantidad_caja).toFixed(2)}</td>
                                  <td className="px-3 py-2 text-right">{formatMoney(d.precio_unitario)}</td>
                                  <td className="px-3 py-2 text-right font-semibold">{formatMoney(d.subtotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

