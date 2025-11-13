# Ollantay Mobile App

App móvil React Native (Expo) para el sistema de gestión Ollantay.

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+
- npm o yarn
- Expo CLI
- Expo Go app en tu dispositivo móvil

### Instalación

```bash
cd mobile
npm install
```

### Configuración

1. Copiar archivo de configuración:
```bash
copy .env.example .env
```

2. Editar `.env` y configurar la IP de tu servidor:
```env
API_BASE_URL=http://192.168.1.100:3000
```

**Importante**: Reemplazar `192.168.1.100` con la IP real de tu máquina donde corre Docker.

### Ejecutar

```bash
# Iniciar metro bundler
npm start

# Para Android
npm run android

# Para iOS
npm run ios
```

Escanea el código QR con Expo Go en tu dispositivo.

## 📱 Características

### Autenticación
- Login con usuario/contraseña
- Token JWT guardado en SecureStore
- Sesión persistente
- Sistema de permisos integrado

### Pantallas
- **Login**: Autenticación de usuarios
- **Home**: Dashboard con accesos rápidos
- **Ventas**: Listado y gestión de ventas
- **Productos**: Catálogo de productos
- **Entregas**: Para rol chofer
- **Mis Deudas**: Para rol cliente
- **Perfil**: Información del usuario y configuración

### Temas
- Modo claro/oscuro
- Persistencia de preferencias
- Detección automática del tema del sistema

### Permisos
- Control de acceso basado en roles
- Validación de permisos por recurso/acción
- Interfaz adaptativa según permisos

## 🏗️ Estructura

```
mobile/
├── src/
│   ├── api/              # Cliente API y endpoints
│   │   ├── client.js     # Configuración axios
│   │   └── index.js      # Endpoints organizados
│   ├── context/          # Contextos React
│   │   ├── AuthContext.js
│   │   └── ThemeContext.js
│   ├── navigation/       # Navegación
│   │   └── AppNavigator.js
│   ├── screens/          # Pantallas
│   │   ├── Auth/
│   │   ├── Home/
│   │   ├── Ventas/
│   │   ├── Productos/
│   │   ├── Entregas/
│   │   ├── Clientes/
│   │   ├── MisDeudas/
│   │   └── Profile/
│   └── components/       # Componentes reutilizables (por crear)
├── assets/               # Imágenes e iconos
├── App.js               # Componente raíz
├── index.js             # Entry point
├── app.json             # Configuración Expo
└── package.json         # Dependencias
```

## 🔧 API Integration

### Headers Automáticos

El cliente API agrega automáticamente:
- `Authorization: Bearer <token>`
- `X-User-Company: <empresaId>`
- `X-User-Role: <role>`

### Endpoints Disponibles

```javascript
import { authAPI, ventasAPI, productosAPI } from './src/api';

// Autenticación
await authAPI.login(usuario, contrasena);
await authAPI.getSession();
await authAPI.logout();

// Ventas
await ventasAPI.getAll({ limit: 20 });
await ventasAPI.getById(id);
await ventasAPI.create(data);
await ventasAPI.getCreditos(clienteId);

// Productos
await productosAPI.getAll();
await productosAPI.getById(id);
await productosAPI.getByBarcode(codigo);
```

## 🎨 Theming

```javascript
import { useTheme } from './src/context/ThemeContext';

function MyComponent() {
  const { colors, isDark, toggleTheme } = useTheme();
  
  return (
    <View style={{ backgroundColor: colors.background }}>
      <Text style={{ color: colors.text }}>Hello</Text>
    </View>
  );
}
```

## 🔐 Autenticación

```javascript
import { useAuth } from './src/context/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, hasPermission } = useAuth();
  
  if (hasPermission('ventas', 'view')) {
    return <VentasScreen />;
  }
  
  return <Text>No tienes permisos</Text>;
}
```

## 📦 Build

### Android APK

```bash
eas build -p android --profile preview
```

### iOS IPA

```bash
eas build -p ios --profile preview
```

## 🐛 Troubleshooting

### No se puede conectar al backend

1. Verificar que el backend esté corriendo: `docker ps`
2. Verificar la IP en `.env` es correcta
3. Asegurarse que el firewall permite conexiones
4. En Windows: `New-NetFirewallRule -DisplayName "Ollantay" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow`

### Errores de cache

```bash
# Limpiar cache de Expo
expo start -c

# Limpiar node_modules
rm -rf node_modules
npm install
```

## 🚀 Próximas Funcionalidades

- [ ] Escaneo de códigos de barras
- [ ] Cámara para fotos de productos
- [ ] Mapas para entregas
- [ ] Notificaciones push
- [ ] Modo offline con sincronización
- [ ] Firma digital para entregas
- [ ] Reportes y gráficas

## 📝 Notas de Desarrollo

- Usar componentes funcionales con hooks
- Implementar lazy loading para pantallas
- Agregar componentes reutilizables en `src/components/`
- Mantener la lógica de negocio en contextos
- Usar FlatList para listas largas
- Implementar paginación en listados

## 🤝 Contribuir

1. Crear feature branch: `git checkout -b ft/nueva-funcionalidad`
2. Desarrollar y probar
3. Commit: `git commit -m "Agrega nueva funcionalidad"`
4. Push: `git push origin ft/nueva-funcionalidad`
5. Crear Pull Request

---

**Version**: 1.0.0  
**Platform**: React Native (Expo)  
**Node**: 18+
