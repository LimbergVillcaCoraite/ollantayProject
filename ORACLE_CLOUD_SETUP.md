# 🌐 Configuración de Oracle Cloud para Sistema Ollantay

## Problema actual
- ✅ DuckDNS configurado correctamente apuntando a: `129.151.98.178`
- ✅ Puerto 80 abierto pero no responde
- ❌ Puerto 443 bloqueado
- ❌ Servicios no accesibles desde internet

## 🔧 Solución: 2 pasos obligatorios

### Paso 1: Configurar Security List en Oracle Cloud (Panel Web)

1. **Accede al panel de Oracle Cloud**
   - URL: https://cloud.oracle.com
   - Inicia sesión con tu cuenta

2. **Navega a Networking**
   ```
   Menú hamburguesa → Networking → Virtual Cloud Networks
   ```

3. **Selecciona tu VCN**
   - Click en el VCN donde está tu instancia
   - Usualmente se llama "vcn-..." o similar

4. **Abre Security Lists**
   ```
   Resources (panel izquierdo) → Security Lists
   → Click en "Default Security List for vcn-..."
   ```

5. **Agregar Ingress Rules**
   
   Click en **"Add Ingress Rules"** y agrega estos dos:

   **Regla 1 - HTTP (Puerto 80):**
   ```
   Stateless: ☐ (desmarcado)
   Source Type: CIDR
   Source CIDR: 0.0.0.0/0
   IP Protocol: TCP
   Source Port Range: All
   Destination Port Range: 80
   Description: HTTP para Sistema Ollantay
   ```

   **Regla 2 - HTTPS (Puerto 443):**
   ```
   Stateless: ☐ (desmarcado)
   Source Type: CIDR
   Source CIDR: 0.0.0.0/0
   IP Protocol: TCP
   Source Port Range: All
   Destination Port Range: 443
   Description: HTTPS para Sistema Ollantay
   ```

   Click en **"Add Ingress Rules"** para guardar.

### Paso 2: Configurar iptables dentro de la instancia

1. **Conectarse a la instancia por SSH**
   ```bash
   ssh ubuntu@129.151.98.178
   # o
   ssh opc@129.151.98.178
   ```

2. **Copiar scripts de configuración**
   
   En tu máquina local (Windows):
   ```powershell
   scp setup-produccion.sh diagnostico-produccion.sh ubuntu@129.151.98.178:~
   ```

3. **En el servidor, ejecutar el script de setup**
   ```bash
   cd ~
   sudo bash setup-produccion.sh
   ```

   Esto hará:
   - ✅ Abrir puertos 80, 443 en iptables
   - ✅ Guardar reglas de firewall
   - ✅ Iniciar contenedores Docker
   - ✅ Verificar servicios

4. **Verificar que todo funciona**
   ```bash
   # Ver contenedores corriendo
   docker ps
   
   # Probar desde dentro del servidor
   curl http://localhost
   curl -k https://localhost
   
   # Ver logs del proxy
   docker logs ollantay_reverse_proxy
   ```

## 🧪 Verificación final

Desde tu navegador o terminal local:

```bash
# Probar HTTP
curl http://archsoft-system.duckdns.org

# Probar HTTPS (ignorar advertencia de certificado)
curl -k https://archsoft-system.duckdns.org
```

En el navegador:
- http://archsoft-system.duckdns.org
- https://archsoft-system.duckdns.org (aceptar advertencia del certificado autofirmado)

## 📋 Checklist de verificación

- [ ] Security List configurado en Oracle Cloud con reglas para 80 y 443
- [ ] SSH conectado al servidor
- [ ] Script `setup-produccion.sh` ejecutado correctamente
- [ ] Contenedores Docker corriendo (`docker ps`)
- [ ] Prueba local exitosa (`curl http://localhost`)
- [ ] Prueba externa exitosa (navegador)

## ❓ Troubleshooting

### "Connection refused" o "Connection timed out"
- Verifica que Security List esté configurado
- Espera 1-2 minutos después de agregar las reglas
- Verifica iptables: `sudo iptables -L INPUT -n --line-numbers`

### "This site can't be reached"
- Verifica DuckDNS: `nslookup archsoft-system.duckdns.org`
- Verifica que Docker esté corriendo: `docker ps`
- Revisa logs: `docker logs ollantay_reverse_proxy`

### "SSL Certificate Error"
- Normal con certificado autofirmado
- Click en "Avanzado" → "Continuar al sitio"
- Para producción: configura Let's Encrypt después

### Contenedores no inician
```bash
# Ver errores
docker-compose logs

# Reiniciar todo
docker-compose down
docker-compose up -d

# Ver logs específicos
docker logs ollantay_frontend
docker logs persona_service
```

## 🔒 Seguridad adicional (Opcional)

Si quieres restringir el acceso solo a ciertas IPs:

```bash
# En lugar de 0.0.0.0/0, usa tu IP pública
Source CIDR: TU_IP_PUBLICA/32
```

## 📞 Comandos útiles

```bash
# Ver todas las reglas de iptables
sudo iptables -L -n -v

# Ver puertos en escucha
sudo netstat -tlnp | grep -E ':(80|443)'

# Reiniciar servicios
docker-compose restart

# Ver logs en tiempo real
docker-compose logs -f

# Estado de todos los servicios
docker-compose ps
```

## ✅ Resultado esperado

Después de completar los pasos:
- ✅ `http://archsoft-system.duckdns.org` → Carga el sistema
- ✅ `https://archsoft-system.duckdns.org` → Carga con advertencia SSL
- ✅ Login funciona
- ✅ APIs responden
- ✅ WebSockets funcionan para tracking en tiempo real
