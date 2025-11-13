# 🎮 Módulo de Gamificación

## Descripción General

Sistema completo de gamificación que incluye puntos, niveles, insignias (badges), rachas, rankings y historial de actividades. Diseñado para aumentar el engagement y motivar a los usuarios a usar el sistema de manera consistente.

## Arquitectura

### Backend: `gamification_service` (Puerto 8007)

**Tecnologías:**
- FastAPI
- MySQL 8.0
- JWT Authentication
- Docker

**Base de Datos:**

```sql
-- Tablas principales
badge_O              -- Insignias disponibles (15 badges iniciales)
user_gamification_O  -- Puntos, nivel y racha de cada usuario
user_badge_O         -- Badges asignados a usuarios
points_history_O     -- Historial de puntos ganados
```

### Frontend: `Gamification.jsx`

**Características:**
- Vista de estadísticas personales (puntos, nivel, racha, badges)
- Ranking global de usuarios
- Catálogo de todas las insignias disponibles
- Historial de puntos
- Barra de progreso al siguiente nivel
- UI responsive con dark mode

## Endpoints Principales

### 1. Otorgar Puntos
```http
POST /api/gamification/award-points
Authorization: Bearer {token}
Content-Type: application/json

{
  "id_user": 1,
  "puntos": 10,
  "razon": "Venta registrada",
  "modulo": "Ventas"
}
```

### 2. Estadísticas de Usuario
```http
GET /api/gamification/user-stats/{id_user}
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "puntos_totales": 350,
  "nivel": 4,
  "racha_dias": 7,
  "badges": [...],
  "historial": [...]
}
```

### 3. Rankings
```http
GET /api/gamification/rankings?limit=50
Authorization: Bearer {token}
```

### 4. Listar Badges
```http
GET /api/gamification/badges
Authorization: Bearer {token}
```

### 5. Trigger Automático de Venta
```http
POST /api/gamification/trigger/venta
Authorization: Bearer {token}

{
  "id_user": 1
}
```

## Sistema de Puntos

### Mecánica de Niveles
- **100 puntos = 1 nivel**
- Nivel inicial: 1
- Sin límite superior de niveles

### Sistema de Rachas
- **+1 día** si el usuario usa el sistema días consecutivos
- **Racha rota** si pasa más de 1 día sin actividad
- Mismo día no incrementa la racha

### Badges de Racha Automáticos
- 🔥 **Racha de 7 días** (70 pts)
- ⚡ **Racha de 30 días** (300 pts)

## Insignias Disponibles

### Categorías de Badges

| Badge | Descripción | Puntos | Tipo |
|-------|-------------|--------|------|
| 🎉 Bienvenido | Primer inicio de sesión | 0 | Bronce |
| 🏪 Vendedor Novato | 10 ventas | 100 | Bronce |
| 💼 Vendedor Experto | 50 ventas | 500 | Plata |
| 👑 Maestro de Ventas | 200 ventas | 2000 | Oro |
| 🛒 Comprador Eficiente | 20 compras | 200 | Plata |
| 👥 Gestor de Personas | 30 personas registradas | 300 | Plata |
| 🔥 Racha de 7 días | 7 días consecutivos | 70 | Bronce |
| ⚡ Racha de 30 días | 30 días consecutivos | 300 | Oro |
| 🌅 Madrugador | Login antes de 6 AM | 50 | Especial |
| 🌙 Nocturno | Trabajo después de 10 PM | 50 | Especial |
| ✨ Perfeccionista | Perfil 100% completo | 100 | Bronce |
| 💬 Comunicador | 50 mensajes en chat | 150 | Bronce |
| 🗺️ Organizador | 10 rutas creadas | 200 | Plata |
| 📊 Analista | 20 reportes generados | 300 | Oro |
| 🏆 Líder | Ser admin de empresa | 500 | Platino |

### Tipos de Badges
- **Bronce**: Logros básicos
- **Plata**: Logros intermedios
- **Oro**: Logros avanzados
- **Platino**: Logros máximos
- **Especial**: Logros únicos/divertidos

## Integración con Otros Módulos

### Ejemplo: Otorgar Puntos en Venta

```javascript
// En venta_service o frontend después de crear venta
const response = await fetch('http://localhost:8007/api/gamification/award-points', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    id_user: userId,
    puntos: 10,
    razon: 'Venta registrada exitosamente',
    modulo: 'Ventas'
  })
});
```

### Triggers Automáticos Recomendados

**Ventas:**
- +10 puntos por venta creada
- Badge "Vendedor Novato" a las 10 ventas
- Badge "Vendedor Experto" a las 50 ventas
- Badge "Maestro de Ventas" a las 200 ventas

**Compras:**
- +8 puntos por compra registrada
- Badge "Comprador Eficiente" a las 20 compras

**Personas:**
- +5 puntos por persona registrada
- Badge "Gestor de Personas" a las 30 personas

**Chat:**
- +2 puntos por mensaje enviado
- Badge "Comunicador" a los 50 mensajes

**Reportes:**
- +15 puntos por reporte generado
- Badge "Analista" a los 20 reportes

**Login:**
- +1 punto por día de login (racha)
- Badge "Madrugador" si login < 6 AM
- Badge "Nocturno" si actividad > 10 PM

## Configuración Docker

```yaml
# docker-compose.yml
gamification_service:
  build:
    context: ./backend/gamification_service
    dockerfile: Dockerfile
  container_name: gamification_service
  restart: unless-stopped
  depends_on:
    - mysql8032
  ports:
    - "8007:8007"
  environment:
    DB_HOST: mysql8032
    DB_PORT: "3306"
    DB_USER: root
    DB_PASSWORD: P4assw@rd
    DB_NAME: SystemaOllantay
    JWT_SECRET: supersecretkey123
```

## Migración de Base de Datos

```bash
# Ejecutar migración
mysql -u root -p SystemaOllantay < backend/migrations/gamification_module.sql
```

**El script crea:**
- 4 tablas nuevas
- 15 badges iniciales
- Índices optimizados

## UI - Componente Gamification.jsx

### Vistas Disponibles

1. **📊 Mis Estadísticas**
   - Card con stats principales (puntos, nivel, racha, badges)
   - Barra de progreso al siguiente nivel
   - Grid de badges obtenidos con fechas
   - Historial de puntos recientes (últimos 20)

2. **🏅 Rankings**
   - Tabla clasificatoria de todos los usuarios
   - Top 3 con medallas 🥇🥈🥉
   - Información: nombre, puntos, nivel, racha, badges
   - Ordenado por puntos totales DESC

3. **🎖️ Insignias**
   - Catálogo completo de todas las insignias
   - Visual diferenciado: desbloqueadas (color) vs bloqueadas (grayscale)
   - Información de cada badge: descripción, puntos requeridos, tipo
   - Grid responsive 4 columnas

### Features UI
- ✅ Dark mode completo
- ✅ Animaciones de carga
- ✅ Gradientes por tipo de badge
- ✅ Custom scrollbar
- ✅ Responsive mobile-first
- ✅ Estados de hover con scale transform

## Roadmap de Mejoras

### Corto Plazo
- [ ] Notificaciones push al obtener nuevo badge
- [ ] Animación de "nivel subido" con confetti
- [ ] Sonidos al ganar puntos/badges

### Mediano Plazo
- [ ] Logros ocultos (descubrir mediante exploración)
- [ ] Badges temporales (eventos especiales)
- [ ] Sistema de recompensas canjeables con puntos
- [ ] Ranking por empresa (multiempresa)

### Largo Plazo
- [ ] Torneos/competencias mensuales
- [ ] Insignias personalizadas por empresa
- [ ] Exportar certificados de logros
- [ ] Integración con LinkedIn para compartir badges

## Testing

### Pruebas Manuales

1. **Test de Puntos:**
```bash
curl -X POST http://localhost:8007/api/gamification/award-points \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id_user": 1, "puntos": 50, "razon": "Test", "modulo": "Test"}'
```

2. **Test de Stats:**
```bash
curl http://localhost:8007/api/gamification/user-stats/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Test de Rankings:**
```bash
curl http://localhost:8007/api/gamification/rankings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Casos de Prueba

✅ Usuario nuevo recibe badge "Bienvenido" automáticamente  
✅ Racha incrementa correctamente con días consecutivos  
✅ Racha se resetea si pasa más de 1 día  
✅ Nivel sube cada 100 puntos  
✅ Badges se asignan automáticamente según criterios  
✅ No se duplican badges (UNIQUE constraint)  
✅ Historial registra todas las transacciones de puntos  
✅ Rankings ordenados correctamente por puntos  

## Troubleshooting

### Problema: Badges no se asignan automáticamente
**Solución:** Verificar que los triggers (ej: `trigger/venta`) estén siendo llamados desde los servicios correspondientes

### Problema: Racha no incrementa
**Solución:** La racha requiere actividad (cualquier acción con puntos) en días consecutivos, no solo login

### Problema: Error al otorgar puntos
**Solución:** Verificar que `id_user` existe en `user_O` (FOREIGN KEY constraint)

### Problema: Frontend no carga stats
**Solución:** 
```javascript
// Verificar que el token tenga user_id
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('User ID:', payload.user_id);
```

## Contacto y Soporte

Para dudas o mejoras del módulo de gamificación:
- Revisar logs en container: `docker logs gamification_service`
- Health check: `http://localhost:8007/health`
- Documentación API interactiva: `http://localhost:8007/docs`

---

**Última actualización:** 2025-11-13  
**Versión:** 1.0.0  
**Mantenedor:** Sistema Ollantay Dev Team
