# 🧪 Plan de Testing - Sistema de Asistencia

**Fecha:** 2025-11-13  
**Versión:** 3.1.0  
**Objetivo:** Validar mejoras implementadas en sistema de asistencia

---

## 📋 Checklist de Testing

### ✅ Test 1: Botón QR Individual en Tabla de Empleados

**Objetivo:** Verificar que el botón QR en cada fila funciona correctamente

**Pasos:**
1. Login como admin o superadmin
2. Navegar a módulo "Empleados"
3. Localizar cualquier empleado en la tabla
4. Buscar botón "QR" en la columna de acciones (color teal)
5. Click en botón "QR"

**Resultado Esperado:**
- ✅ Modal se abre inmediatamente
- ✅ QR code se genera y muestra como SVG
- ✅ Token se muestra debajo del QR
- ✅ Countdown inicia desde 60 segundos
- ✅ Modal tiene botón de cerrar funcional

**Criterios de Aceptación:**
- Modal abre en <1 segundo
- QR es escaneable con celular
- Countdown disminuye cada segundo
- Token es string largo (JWT)

---

### ✅ Test 2: Reportes de Asistencia - Vista Estadísticas

**Objetivo:** Verificar que las estadísticas se cargan y exportan correctamente

**Pasos:**
1. Login como admin o superadmin
2. Click en sidebar → "Reportes de Asistencia" (botón con gradiente cyan-blue)
3. Verificar que filtros cargan:
   - **Desde:** Primer día del mes actual
   - **Hasta:** Día actual
   - **Empleado:** Dropdown con lista
4. Click en "Consultar"
5. Esperar carga de datos
6. Revisar tabla de estadísticas
7. Click en "Exportar Excel"

**Resultado Esperado:**
- ✅ Vista carga con filtros predeterminados
- ✅ Dropdown de empleados tiene opciones
- ✅ Tabla muestra columnas: ID Persona, Nombre, Entradas, Salidas, Diferencia
- ✅ Badges de entradas son verdes (🟢)
- ✅ Badges de salidas son amarillos (🟡)
- ✅ Diferencia muestra badge naranja (+) o azul (-)
- ✅ CSV se descarga automáticamente
- ✅ CSV contiene datos correctos

**Criterios de Aceptación:**
- Carga de datos <3 segundos
- Tabla responsive en mobile
- Dark mode funciona correctamente
- CSV tiene formato: `ID Persona,Nombre,Entradas,Salidas`
- Números en CSV coinciden con tabla

---

### ✅ Test 3: Reportes de Asistencia - Vista Registros Detallados

**Objetivo:** Verificar que los registros individuales se muestran correctamente

**Pasos:**
1. Desde módulo "Reportes de Asistencia"
2. Click en tab "📋 Registros Detallados"
3. Ajustar filtros si es necesario
4. Click en "Consultar"
5. Esperar carga de datos
6. Revisar tabla de registros
7. Click en link de GPS de algún registro
8. Click en "Exportar Excel"

**Resultado Esperado:**
- ✅ Tab cambia a "Registros Detallados"
- ✅ Tabla muestra columnas: ID, Empleado, Tipo, Fecha y Hora, Ubicación GPS, Nota
- ✅ Campo "Tipo" muestra badges: 🟢 Entrada (verde) o 🔴 Salida (rojo)
- ✅ Fecha y hora formateadas correctamente (español)
- ✅ GPS muestra link clickeable a Google Maps
- ✅ Link abre mapa en nueva pestaña
- ✅ CSV se descarga con columnas correctas
- ✅ CSV incluye columna "Nota"

**Criterios de Aceptación:**
- Registros ordenados por timestamp DESC (más recientes primero)
- GPS links funcionales
- Formato fecha: DD/MM/YYYY
- Formato hora: HH:MM:SS
- CSV formato: `ID,ID Persona,Nombre,Tipo,Fecha/Hora,Latitud,Longitud,Nota`

---

### ✅ Test 4: Integración con Backend - Nuevo Endpoint

**Objetivo:** Verificar que endpoint `/asistencia/registros` funciona correctamente

**Pasos:**
1. Abrir herramienta de desarrollo (F12)
2. Ir a tab "Network"
3. En módulo "Reportes de Asistencia", click tab "Registros Detallados"
4. Click en "Consultar"
5. Buscar request a `/asistencia/registros` en Network tab
6. Verificar status code y respuesta

**Resultado Esperado:**
- ✅ Request sale como GET
- ✅ URL incluye parámetros: `?desde=...&hasta=...`
- ✅ Status code: 200 OK
- ✅ Response JSON tiene estructura:
  ```json
  {
    "items": [
      {
        "id_asistencia": 123,
        "id_persona": 45,
        "nombre_empleado": "Juan Pérez López",
        "tipo": "entrada",
        "timestamp": "2025-11-13T08:30:15",
        "geo_lat": -16.123456,
        "geo_lng": -68.654321,
        "nota": "Entrada desde app móvil"
      }
    ],
    "total": 1
  }
  ```
- ✅ Header `X-User-Role` presente
- ✅ Cookie `ollantay_token` enviada

**Criterios de Aceptación:**
- Response time <2 segundos
- Array items contiene todos los campos necesarios
- Campo `nombre_empleado` no es null
- Timestamp en formato ISO 8601
- Coordenadas GPS son números (no strings)

---

### ✅ Test 5: Filtros Dinámicos

**Objetivo:** Verificar que filtros afectan correctamente los resultados

**Test 5.1: Filtro por Rango de Fechas**
1. Seleccionar "Desde": Hace 7 días
2. Seleccionar "Hasta": Hoy
3. Click "Consultar"
4. Verificar que solo aparecen registros dentro del rango

**Test 5.2: Filtro por Empleado**
1. Seleccionar empleado específico en dropdown
2. Click "Consultar"
3. Verificar que solo aparecen registros de ese empleado
4. Cambiar a "Todos"
5. Verificar que aparecen todos los empleados

**Test 5.3: Combinación de Filtros**
1. Seleccionar rango de 1 día
2. Seleccionar empleado específico
3. Click "Consultar"
4. Verificar que resultados cumplen ambos filtros

**Resultado Esperado:**
- ✅ Filtros se aplican correctamente
- ✅ Backend recibe parámetros correctos
- ✅ Tabla actualiza con datos filtrados
- ✅ Empty state aparece si no hay datos

**Criterios de Aceptación:**
- Filtros persisten al cambiar de tab
- Botón "Consultar" dispara nueva request
- Loading spinner aparece durante carga
- Toast notification si hay error

---

### ✅ Test 6: Exportación CSV

**Objetivo:** Validar que archivos CSV generados son correctos

**Test 6.1: CSV de Estadísticas**
1. Generar reporte de estadísticas
2. Click "Exportar Excel"
3. Abrir archivo descargado en Excel/LibreOffice
4. Verificar estructura

**Resultado Esperado:**
- ✅ Archivo nombre: `asistencia_estadisticas_2025-11-13.csv`
- ✅ Encoding: UTF-8 con BOM
- ✅ Delimitador: coma
- ✅ Headers: `ID Persona,Nombre,Entradas,Salidas`
- ✅ Nombres sin caracteres raros (tildes correctas)
- ✅ Números sin comillas

**Test 6.2: CSV de Registros Detallados**
1. Generar reporte de registros detallados
2. Click "Exportar Excel"
3. Abrir archivo descargado
4. Verificar estructura

**Resultado Esperado:**
- ✅ Archivo nombre: `asistencia_detalles_2025-11-13.csv`
- ✅ Headers: `ID,ID Persona,Nombre,Tipo,Fecha/Hora,Latitud,Longitud,Nota`
- ✅ Coordenadas GPS con 6 decimales
- ✅ Timestamp formato ISO
- ✅ Campo Nota entre comillas si tiene comas

**Criterios de Aceptación:**
- Archivos abren sin errores en Excel
- Datos coinciden con tabla en pantalla
- Encoding preserva caracteres especiales
- Sin filas vacías adicionales

---

### ✅ Test 7: Permisos y Roles

**Objetivo:** Verificar que permisos se respetan correctamente

**Test 7.1: Usuario Admin**
1. Login como admin (role: admin)
2. Ir a "Reportes de Asistencia"
3. Verificar que solo ve empleados de su empresa

**Test 7.2: Usuario Superadmin**
1. Login como superadmin
2. Ir a "Reportes de Asistencia"
3. Verificar que ve empleados de todas las empresas

**Test 7.3: Usuario Editor**
1. Login como editor
2. Verificar que tiene acceso a módulo

**Resultado Esperado:**
- ✅ Admin: Filtrado por `company_id`
- ✅ Superadmin: Sin filtrado (todas las empresas)
- ✅ Editor: Acceso solo lectura
- ✅ Backend valida rol en cada request

**Criterios de Aceptación:**
- Header `X-User-Role` presente
- Backend responde 403 si rol inválido
- Multiempresa funciona correctamente

---

### ✅ Test 8: UI/UX - Dark Mode

**Objetivo:** Verificar que dark mode funciona en todos los componentes

**Pasos:**
1. Activar dark mode (toggle en header)
2. Navegar a "Reportes de Asistencia"
3. Verificar colores de:
   - Background principal
   - Cards/containers
   - Tablas (headers, rows, borders)
   - Botones
   - Inputs
   - Dropdowns
   - Badges
   - Text (títulos, párrafos)

**Resultado Esperado:**
- ✅ Todos los elementos usan paleta dark
- ✅ Contraste suficiente para legibilidad
- ✅ Hover states visibles
- ✅ Gradientes se mantienen
- ✅ Sin texto blanco sobre blanco

**Criterios de Aceptación:**
- Paleta consistente con resto de app
- WCAG AA compliance (contraste 4.5:1)
- Smooth transition al cambiar modo

---

### ✅ Test 9: Responsive Design

**Objetivo:** Validar que interfaz funciona en diferentes tamaños de pantalla

**Test 9.1: Desktop (1920x1080)**
- ✅ Tabla con todas las columnas visibles
- ✅ Filtros en grid 4 columnas

**Test 9.2: Tablet (768x1024)**
- ✅ Tabla con scroll horizontal si necesario
- ✅ Filtros en grid 2 columnas

**Test 9.3: Mobile (375x667)**
- ✅ Tabla compacta con scroll
- ✅ Filtros en 1 columna
- ✅ Botones full-width
- ✅ Tabs apilados o con scroll horizontal

**Criterios de Aceptación:**
- Breakpoints: 640px (sm), 768px (md), 1024px (lg)
- Sin overflow horizontal en body
- Touch targets >44px
- Texto legible sin zoom

---

### ✅ Test 10: Performance

**Objetivo:** Medir tiempos de carga y respuesta

**Métricas a Medir:**
1. **Carga inicial de módulo:** <2 segundos
2. **Carga de dropdown empleados:** <1 segundo
3. **Request a `/asistencia/estadisticas`:** <3 segundos
4. **Request a `/asistencia/registros`:** <3 segundos
5. **Generación de CSV:** <1 segundo
6. **Cambio de tab:** Instantáneo

**Herramientas:**
- Chrome DevTools > Performance tab
- Network tab (timing details)
- Lighthouse audit

**Resultado Esperado:**
- ✅ First Contentful Paint: <1.5s
- ✅ Time to Interactive: <3s
- ✅ No memory leaks al cambiar tabs repetidamente
- ✅ CSV generation no bloquea UI

**Criterios de Aceptación:**
- Lighthouse score >90
- Bundle size del componente <50KB
- API responses <3s con 1000 registros

---

## 🐛 Registro de Bugs Encontrados

| ID | Descripción | Severidad | Estado | Fecha |
|----|-------------|-----------|--------|-------|
| - | - | - | - | - |

**Template para reportar bugs:**
```
### Bug #X: [Título breve]
- **Severidad:** Crítico/Alto/Medio/Bajo
- **Módulo:** AsistenciaReportes / Backend Endpoint
- **Pasos para reproducir:**
  1. ...
  2. ...
- **Resultado esperado:** ...
- **Resultado actual:** ...
- **Screenshot/Logs:** ...
- **Asignado a:** ...
- **Estado:** Abierto/En progreso/Resuelto
```

---

## ✅ Checklist Final

Antes de marcar como completado, verificar:

- [ ] Todos los tests 1-10 ejecutados
- [ ] Bugs encontrados documentados
- [ ] Bugs críticos resueltos
- [ ] Screenshots capturados
- [ ] Logs revisados (sin errores en consola)
- [ ] Performance aceptable
- [ ] Dark mode funcional
- [ ] Responsive en 3 tamaños
- [ ] Permisos validados
- [ ] Exportación CSV funcional
- [ ] Endpoint backend documentado
- [ ] README actualizado (si necesario)

---

## 📸 Screenshots de Evidencia

### 1. Botón QR en Tabla
![Botón QR](./screenshots/boton-qr-tabla.png)

### 2. Modal QR Generado
![Modal QR](./screenshots/modal-qr-generado.png)

### 3. Reportes - Estadísticas
![Estadísticas](./screenshots/reportes-estadisticas.png)

### 4. Reportes - Registros Detallados
![Registros](./screenshots/reportes-registros.png)

### 5. Exportación CSV
![CSV](./screenshots/exportacion-csv.png)

### 6. Dark Mode
![Dark Mode](./screenshots/dark-mode.png)

### 7. Mobile View
![Mobile](./screenshots/mobile-responsive.png)

---

## 🚀 Comando de Testing Automatizado

```powershell
# Ejecutar suite de tests (cuando estén implementados)
npm run test:asistencia

# Test específico
npm run test:asistencia -- --grep "Botón QR"

# Coverage report
npm run test:coverage -- src/components/AsistenciaReportes.jsx
```

---

## 📊 Resultados de Testing

**Fecha de Ejecución:** [PENDIENTE]  
**Ejecutado por:** [NOMBRE]  
**Entorno:** Desarrollo / Staging / Producción

| Test | Estado | Tiempo | Notas |
|------|--------|--------|-------|
| Test 1: Botón QR | ⏳ Pendiente | - | - |
| Test 2: Estadísticas | ⏳ Pendiente | - | - |
| Test 3: Registros Detallados | ⏳ Pendiente | - | - |
| Test 4: Endpoint Backend | ⏳ Pendiente | - | - |
| Test 5: Filtros | ⏳ Pendiente | - | - |
| Test 6: Exportación CSV | ⏳ Pendiente | - | - |
| Test 7: Permisos | ⏳ Pendiente | - | - |
| Test 8: Dark Mode | ⏳ Pendiente | - | - |
| Test 9: Responsive | ⏳ Pendiente | - | - |
| Test 10: Performance | ⏳ Pendiente | - | - |

**Resultado General:** ⏳ En espera de ejecución

---

**Próximo Paso:** Ejecutar testing manual según este plan y documentar resultados.
