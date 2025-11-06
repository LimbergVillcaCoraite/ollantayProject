import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Función para crear iconos personalizados con foto de la persona
function createPersonIcon(fotoUrl, API_PERSONAS) {
  const photoUrl = fotoUrl && fotoUrl !== 'null' && fotoUrl !== '' 
    ? `${API_PERSONAS}/uploads/personas/${fotoUrl}` 
    : null;
  
  const iconHtml = photoUrl
    ? `<div style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; border: 3px solid #3b82f6; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
         <img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#3b82f6;color:white;font-weight:bold;\\'>👤</div>'"/>
       </div>`
    : `<div style="width: 40px; height: 40px; border-radius: 50%; border: 3px solid #3b82f6; background: white; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
         👤
       </div>`;

  return L.divIcon({
    html: iconHtml,
    className: 'custom-person-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });
}

// Componente para controlar el mapa (centrar en una persona)
function MapController({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom(), { animate: true });
    }
  }, [center, zoom, map]);
  
  return null;
}

export default function PersonasEnMapa({ API_PERSONAS, userRole }) {
  const [personas, setPersonas] = useState([]);
  const [ubicaciones, setUbicaciones] = useState({}); // id_persona -> {lat, lng, accuracy, updated_at}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapCenter, setMapCenter] = useState(null); // Para controlar el centro del mapa
  const [mapZoom, setMapZoom] = useState(13);
  const [showAll, setShowAll] = useState(false); // Mostrar todos o solo recientes
  const wsRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_PERSONAS}/persons`, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      .then(r => r.json())
      .then(async data => {
        const list = Array.isArray(data) ? data : []
        setPersonas(list)
        // Cargar ubicaciones iniciales de todas las personas de la empresa en una sola llamada
        try {
          const res = await fetch(`${API_PERSONAS}/persons/ubicaciones/all`, { credentials: 'include' })
          if (res.ok) {
            const ubicDict = await res.json()
            if (ubicDict && typeof ubicDict === 'object') {
              setUbicaciones(ubicDict)
            }
          }
        } catch (e) {
          console.warn('No se pudieron cargar ubicaciones iniciales:', e)
        }
      })
      .catch(e => setError('No se pudieron cargar las personas'))
      .finally(() => setLoading(false));
  }, [API_PERSONAS, userRole]);

  useEffect(() => {
    // Abrir WebSocket para ubicaciones en tiempo real
    const host = (typeof window !== 'undefined' && window.location?.host) ? window.location.host : 'localhost';
    const scheme = (typeof window !== 'undefined' && window.location?.protocol === 'https:') ? 'wss' : 'ws';
    const token = document.cookie.split('; ').find(r => r.startsWith('ollantay_token='))?.split('=')[1];
    const url = `${scheme}://${host}/api/personas/ws/ubicaciones${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const obj = JSON.parse(ev.data);
        if (obj && obj.id_persona && obj.lat != null && obj.lng != null) {
          setUbicaciones(prev => {
            const newUbics = { ...prev, [obj.id_persona]: obj };
            console.log('📍 Nueva ubicación recibida:', obj);
            return newUbics;
          });
        }
      } catch(err) {
        console.error('Error procesando ubicación:', err);
      }
    };
    ws.onerror = (err) => { console.error('WebSocket error:', err); };
    ws.onclose = () => { console.log('WebSocket cerrado'); };
    return () => { try { ws.close(); } catch {} };
  }, [API_PERSONAS, userRole]);

  // Calcular centro del mapa
  const ubicList = Object.values(ubicaciones);
  const defaultCenter = [-17.7833, -63.1821]; // Default: Santa Cruz
  const initialCenter = ubicList.length > 0 ? [ubicList[0].lat, ubicList[0].lng] : defaultCenter;

  // Función para centrar el mapa en una persona
  const centerOnPerson = (lat, lng) => {
    setMapCenter([lat, lng]);
    setMapZoom(16); // Zoom más cercano para ver mejor
  };

  // Obtener personas activas (con ubicación)
  const personasConUbicacion = personas.filter(p => ubicaciones[p.id_persona]);
  const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 minutos como "reciente"
  const personasActivasRecientes = personasConUbicacion.filter(p => {
    const u = ubicaciones[p.id_persona];
    if (!u || !u.updated_at) return false;
    const td = Date.now() - new Date(u.updated_at).getTime();
    return td >= 0 && td < ACTIVE_WINDOW_MS;
  });
  const personasActivas = showAll ? personasConUbicacion : personasActivasRecientes;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2 dark:text-white">Personas en tiempo real</h2>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium">{personasActivasRecientes.length}</span> activa{personasActivasRecientes.length !== 1 ? 's' : ''} recientes
          {!showAll && personasConUbicacion.length > personasActivasRecientes.length && (
            <span className="ml-2 text-xs text-gray-500">({personasConUbicacion.length} con última ubicación)</span>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" className="form-checkbox" checked={showAll} onChange={(e)=>setShowAll(e.target.checked)} />
          <span className="text-gray-700 dark:text-gray-300">Mostrar todos (incluye antiguos)</span>
        </label>
      </div>
      {loading ? <div className="text-gray-600 dark:text-gray-400">Cargando personas...</div> : error ? <div className="text-red-600">{error}</div> : null}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Mapa */}
        <div className="lg:col-span-2">
          <div className="w-full h-[500px] rounded shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <MapContainer center={initialCenter} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
              <MapController center={mapCenter} zoom={mapZoom} />
              {personas.map(p => {
                const u = ubicaciones[p.id_persona];
                if (!u) return null;
                const personIcon = createPersonIcon(p.fotoPersona, API_PERSONAS);
                return (
                  <React.Fragment key={p.id_persona}>
                    <Marker position={[u.lat, u.lng]} icon={personIcon}>
                      <Popup>
                        <div className="min-w-[200px]">
                          <div className="font-bold text-lg">{p.nombres_persona} {p.apellido_paternoPersona}</div>
                          {p.apellido_maternoPer && <div className="text-sm text-gray-600">{p.apellido_maternoPer}</div>}
                          <div className="text-xs text-gray-500 mt-1">ID: {p.id_persona}</div>
                          <div className="text-xs text-gray-500">
                            {u.updated_at ? new Date(u.updated_at).toLocaleString('es-BO', {
                              dateStyle: 'short',
                              timeStyle: 'medium'
                            }) : 'Sin fecha'}
                          </div>
                          {u.accuracy && <div className="text-xs text-blue-600 mt-1">Precisión: ±{Math.round(u.accuracy)}m</div>}
                        </div>
                      </Popup>
                    </Marker>
                    {u.accuracy && u.accuracy > 0 && (
                      <Circle 
                        center={[u.lat, u.lng]} 
                        radius={u.accuracy} 
                        pathOptions={{ 
                          color: '#3b82f6', 
                          fillColor: '#3b82f6', 
                          fillOpacity: 0.1,
                          weight: 1
                        }} 
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </MapContainer>
          </div>
        </div>

        {/* Lista de personas activas */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold mb-3 dark:text-white text-lg">
              📍 Personas Activas
            </h3>
            {personasActivas.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No hay personas con ubicación activa en este momento.
              </p>
            ) : (
              <div className="space-y-2 max-h-[440px] overflow-y-auto">
                {personasActivas.map(p => {
                  const u = ubicaciones[p.id_persona];
                  const timeDiff = u.updated_at ? Date.now() - new Date(u.updated_at).getTime() : null;
                  const isRecent = timeDiff != null && timeDiff < ACTIVE_WINDOW_MS; // dentro de ventana reciente
                  
                  return (
                    <div 
                      key={p.id_persona} 
                      className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-100 dark:border-gray-600"
                    >
                      {/* Foto o avatar */}
                      <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border-2 border-green-500 bg-gray-200">
                        {p.fotoPersona && p.fotoPersona !== 'null' && p.fotoPersona !== '' ? (
                          <img 
                            src={`${API_PERSONAS}/uploads/personas/${p.fotoPersona}`} 
                            alt={p.nombres_persona}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }}
                          />
                        ) : null}
                        <div 
                          className="w-full h-full flex items-center justify-center bg-blue-500 text-white font-bold text-lg"
                          style={{ display: p.fotoPersona && p.fotoPersona !== 'null' && p.fotoPersona !== '' ? 'none' : 'flex' }}
                        >
                          👤
                        </div>
                      </div>
                      
                      {/* Información */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm dark:text-white truncate">
                          {p.nombres_persona} {p.apellido_paternoPersona}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                          <span className={`inline-block w-2 h-2 rounded-full ${isRecent ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                          <span>
                            {u.updated_at 
                              ? new Date(u.updated_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
                              : '--:--'}
                          </span>
                          {!isRecent && (
                            <span className="ml-1 text-[10px] text-gray-400">(antiguo)</span>
                          )}
                        </div>
                        <button
                          onClick={() => centerOnPerson(u.lat, u.lng)}
                          className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Ubicar en mapa
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
