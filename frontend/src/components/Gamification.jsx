import React, { useState, useEffect } from 'react';

const Gamification = ({ dark }) => {
  const [userStats, setUserStats] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [allBadges, setAllBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('stats'); // 'stats', 'rankings', 'badges'

  useEffect(() => {
    loadGamificationData();
  }, []);

  const loadGamificationData = async () => {
    setLoading(true);
    try {
      const base = `${window.location.protocol}//${window.location.host}`;
      const meRes = await fetch(`${base}/api/personas/auth/me`, { credentials: 'include' });
      if (!meRes.ok) throw new Error('No autenticado');
      const me = await meRes.json();
      const userId = me?.sub || me?.id_persona;
      if (!userId) throw new Error('ID de usuario no disponible');

      // Cargar stats del usuario
      const statsRes = await fetch(`${base}/api/gamification/user-stats/${userId}`, { credentials: 'include' });
      const statsData = await statsRes.json();
      setUserStats(statsData);

      // Cargar rankings
      const rankRes = await fetch(`${base}/api/gamification/rankings?limit=50`, { credentials: 'include' });
      const rankData = await rankRes.json();
      setRankings(rankData.rankings || []);

      // Cargar todos los badges
      const badgesRes = await fetch(`${base}/api/gamification/badges`, { credentials: 'include' });
      const badgesData = await badgesRes.json();
      setAllBadges(badgesData.badges || []);

    } catch (error) {
      console.error('Error cargando gamificación:', error);
    } finally {
      setLoading(false);
    }
  };

  const badgeColors = {
    bronce: 'from-amber-700 to-amber-500',
    plata: 'from-gray-500 to-gray-300',
    oro: 'from-yellow-500 to-yellow-300',
    platino: 'from-cyan-400 to-blue-500',
    especial: 'from-purple-600 to-pink-500'
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${dark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} p-6`}>
      {/* Header con Stats Principales */}
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
            🎮 Gamificación
          </h1>
          <p className={dark ? 'text-gray-400' : 'text-gray-600'}>
            Sistema de puntos, insignias y rankings
          </p>
        </div>

        {/* Stats Card */}
        {userStats && (
          <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-8`}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Puntos Totales */}
              <div className="text-center">
                <div className="text-5xl mb-2">⭐</div>
                <div className="text-3xl font-bold text-teal-500">{userStats.puntos_totales}</div>
                <div className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>Puntos Totales</div>
              </div>

              {/* Nivel */}
              <div className="text-center">
                <div className="text-5xl mb-2">🏆</div>
                <div className="text-3xl font-bold text-blue-500">Nivel {userStats.nivel}</div>
                <div className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>Nivel Actual</div>
              </div>

              {/* Racha */}
              <div className="text-center">
                <div className="text-5xl mb-2">🔥</div>
                <div className="text-3xl font-bold text-orange-500">{userStats.racha_dias} días</div>
                <div className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>Racha Actual</div>
              </div>

              {/* Badges */}
              <div className="text-center">
                <div className="text-5xl mb-2">🎖️</div>
                <div className="text-3xl font-bold text-purple-500">{userStats.badges?.length || 0}</div>
                <div className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>Insignias</div>
              </div>
            </div>

            {/* Barra de Progreso al siguiente nivel */}
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span>Progreso al Nivel {userStats.nivel + 1}</span>
                <span>{userStats.puntos_totales % 100} / 100 puntos</span>
              </div>
              <div className={`w-full h-3 ${dark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                <div 
                  className="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-500"
                  style={{ width: `${(userStats.puntos_totales % 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setView('stats')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              view === 'stats'
                ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg'
                : dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            📊 Mis Estadísticas
          </button>
          <button
            onClick={() => setView('rankings')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              view === 'rankings'
                ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg'
                : dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            🏅 Rankings
          </button>
          <button
            onClick={() => setView('badges')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              view === 'badges'
                ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg'
                : dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            🎖️ Insignias
          </button>
        </div>

        {/* Content */}
        {view === 'stats' && userStats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Mis Badges */}
            <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                🎖️ Mis Insignias
                <span className={`text-sm px-3 py-1 rounded-full ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  {userStats.badges?.length || 0}
                </span>
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {userStats.badges?.map((badge, idx) => (
                  <div 
                    key={idx}
                    className={`p-4 rounded-xl border-2 ${dark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <div className={`text-4xl mb-2 p-3 rounded-lg bg-gradient-to-br ${badgeColors[badge.tipo_badge]} inline-block`}>
                      {badge.icono_badge}
                    </div>
                    <div className="font-semibold text-sm">{badge.nombre_badge}</div>
                    <div className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                      {badge.descripcion}
                    </div>
                    <div className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-500'} mt-2`}>
                      {new Date(badge.fecha_obtencion).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                {(!userStats.badges || userStats.badges.length === 0) && (
                  <div className="col-span-2 text-center py-8 text-gray-500">
                    Aún no tienes insignias. ¡Sigue usando el sistema para desbloquearlas!
                  </div>
                )}
              </div>
            </div>

            {/* Historial de Puntos */}
            <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
              <h2 className="text-2xl font-bold mb-4">📜 Historial de Puntos</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                {userStats.historial?.map((entry, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded-lg ${dark ? 'bg-gray-700' : 'bg-gray-50'} flex justify-between items-center`}
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{entry.razon}</div>
                      <div className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {entry.modulo} • {new Date(entry.fecha_registro).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-teal-500">+{entry.puntos}</div>
                  </div>
                ))}
                {(!userStats.historial || userStats.historial.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    No hay historial de puntos aún
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'rankings' && (
          <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
            <h2 className="text-2xl font-bold mb-6">🏅 Tabla de Clasificación</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <th className="px-4 py-3 text-left rounded-tl-lg">Posición</th>
                    <th className="px-4 py-3 text-left">Usuario</th>
                    <th className="px-4 py-3 text-center">Puntos</th>
                    <th className="px-4 py-3 text-center">Nivel</th>
                    <th className="px-4 py-3 text-center">Racha</th>
                    <th className="px-4 py-3 text-center rounded-tr-lg">Badges</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((rank, idx) => {
                    const medalEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                    return (
                      <tr 
                        key={idx}
                        className={`border-b ${dark ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
                      >
                        <td className="px-4 py-4 font-bold">
                          {medalEmoji} #{rank.posicion}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold">{rank.nombre_display}</div>
                          <div className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                            @{rank.username}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-teal-500">
                          {rank.puntos_totales}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full ${dark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                            Nv. {rank.nivel}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          🔥 {rank.racha_dias}d
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full ${dark ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                            {rank.total_badges} 🎖️
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'badges' && (
          <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
            <h2 className="text-2xl font-bold mb-6">🎖️ Todas las Insignias Disponibles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allBadges.map((badge, idx) => {
                const isUnlocked = userStats?.badges?.some(b => b.nombre_badge === badge.nombre_badge);
                return (
                  <div 
                    key={idx}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isUnlocked
                        ? dark ? 'bg-gray-700 border-teal-500' : 'bg-gray-50 border-teal-400'
                        : dark ? 'bg-gray-900 border-gray-700 opacity-60' : 'bg-gray-100 border-gray-300 opacity-60'
                    }`}
                  >
                    <div className={`text-5xl mb-3 p-4 rounded-lg bg-gradient-to-br ${badgeColors[badge.tipo_badge]} inline-block ${!isUnlocked && 'grayscale'}`}>
                      {badge.icono_badge}
                    </div>
                    <div className="font-bold text-lg">{badge.nombre_badge}</div>
                    <div className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mt-2`}>
                      {badge.descripcion}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`text-xs px-2 py-1 rounded ${dark ? 'bg-gray-600' : 'bg-gray-200'}`}>
                        {badge.puntos_requeridos} pts
                      </span>
                      {isUnlocked && (
                        <span className="text-green-500 font-bold text-sm">✅ Desbloqueado</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Gamification;
