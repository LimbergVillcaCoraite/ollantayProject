-- MySQL dump 10.13  Distrib 8.0.32, for Linux (x86_64)
--
-- Host: localhost    Database: SystemaOllantay
-- ------------------------------------------------------
-- Server version	8.0.32

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `SystemaOllantay`
--

/*!40000 DROP DATABASE IF EXISTS `SystemaOllantay`*/;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `SystemaOllantay` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `SystemaOllantay`;

--
-- Table structure for table `entrega_ubicacion_O`
--

DROP TABLE IF EXISTS `entrega_ubicacion_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entrega_ubicacion_O` (
  `idEntrega` int NOT NULL,
  `idEmpresa` int NOT NULL,
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `accuracy` double DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idEntrega`),
  CONSTRAINT `fk_entrega_ubic_entrega` FOREIGN KEY (`idEntrega`) REFERENCES `entrega_ruta_O` (`idEntrega`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entrega_ubicacion_O`
--

LOCK TABLES `entrega_ubicacion_O` WRITE;
/*!40000 ALTER TABLE `entrega_ubicacion_O` DISABLE KEYS */;
-- Seed sample last-known locations for existing entregas (ids 1..4)
INSERT INTO `entrega_ubicacion_O` (`idEntrega`, `idEmpresa`, `lat`, `lng`, `accuracy`, `updated_at`) VALUES
  (1, 2, -17.7889000, -63.1812340, 12.5, '2025-11-05 23:59:59'),
  (2, 2, -17.7901200, -63.1765400, 10.0, '2025-11-05 23:59:59'),
  (3, 2, -17.7923450, -63.1743210, 8.0,  '2025-11-05 23:59:59');
/*!40000 ALTER TABLE `entrega_ubicacion_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `compra_pago_O`
--

DROP TABLE IF EXISTS `compra_pago_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compra_pago_O` (
  `idPago` int NOT NULL AUTO_INCREMENT,
  `idCompra` int NOT NULL,
  `monto` decimal(10,2) NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `metodo` varchar(50) DEFAULT NULL,
  `observaciones` varchar(255) DEFAULT NULL,
  `idUsuario` int DEFAULT NULL,
  PRIMARY KEY (`idPago`),
  KEY `idx_compra_pago_compra` (`idCompra`),
  CONSTRAINT `fk_pago_compra` FOREIGN KEY (`idCompra`) REFERENCES `compra_O` (`idCompra`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

-- Optional: seed sample payments for demo
LOCK TABLES `compra_pago_O` WRITE;
/*!40000 ALTER TABLE `compra_pago_O` DISABLE KEYS */;
INSERT INTO `compra_pago_O` (`idCompra`, `monto`, `metodo`, `observaciones`) VALUES
  (1, 200.00, 'efectivo', 'Abono inicial'),
  (1, 150.00, 'transferencia', 'Abono 2');
/*!40000 ALTER TABLE `compra_pago_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `compra_O`
--

DROP TABLE IF EXISTS `compra_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compra_O` (
  `idCompra` int NOT NULL AUTO_INCREMENT,
  `numeroCompra` varchar(64) NOT NULL,
  `fechaCompra` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `idProveedor` int NOT NULL,
  `idEmpresa` int NOT NULL,
  `idTipoPago` int NOT NULL,
  `montoTotal` decimal(10,2) NOT NULL DEFAULT '0.00',
  `estado_pago` enum('Pagado','Pendiente','Parcial') DEFAULT 'Pendiente' COMMENT 'Estado del pago: Pendiente (sin pagar), Pagado (completamente pagado), Parcial (pago parcial registrado)',
  `montoPagado` decimal(10,2) NOT NULL DEFAULT '0.00',
  `saldo` decimal(10,2) GENERATED ALWAYS AS ((`montoTotal` - `montoPagado`)) STORED,
  `estado` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=activa, 0=anulada',
  `observaciones` text,
  `idUsuario` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idCompra`),
  UNIQUE KEY `numeroCompra` (`numeroCompra`),
  UNIQUE KEY `numeroCompra_2` (`numeroCompra`),
  KEY `fk_compra_empresa` (`idEmpresa`),
  KEY `fk_compra_tipopago` (`idTipoPago`),
  KEY `fk_compra_usuario` (`idUsuario`),
  KEY `idx_compra_fecha_empresa` (`fechaCompra`,`idEmpresa`),
  KEY `idx_compra_proveedor` (`idProveedor`),
  KEY `idx_compra_saldo` (`saldo`),
  KEY `idx_compra_numero` (`numeroCompra`),
  KEY `idx_compra_estadoPago` (`estado_pago`),
  CONSTRAINT `fk_compra_empresa` FOREIGN KEY (`idEmpresa`) REFERENCES `empresa_O` (`id_empresa`),
  CONSTRAINT `fk_compra_proveedor` FOREIGN KEY (`idProveedor`) REFERENCES `proveedor_O` (`idProveedor`),
  CONSTRAINT `fk_compra_tipopago` FOREIGN KEY (`idTipoPago`) REFERENCES `tipoPago` (`idPago`),
  CONSTRAINT `fk_compra_usuario` FOREIGN KEY (`idUsuario`) REFERENCES `user_O` (`id_user`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Compras (cabecera)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `compra_O`
--

LOCK TABLES `compra_O` WRITE;
/*!40000 ALTER TABLE `compra_O` DISABLE KEYS */;
INSERT INTO `compra_O` (`idCompra`, `numeroCompra`, `fechaCompra`, `idProveedor`, `idEmpresa`, `idTipoPago`, `montoTotal`, `estado_pago`, `montoPagado`, `estado`, `observaciones`, `idUsuario`, `created_at`, `updated_at`) VALUES (1,'CMP-2025-001','2025-10-21 00:00:00',1,1,1,850.00,'Pendiente',0.00,1,NULL,1,'2025-10-21 02:57:14','2025-10-21 02:57:14'),(2,'1','2025-10-29 00:00:00',2,2,1,500.00,'Pendiente',0.00,0,'Compra de ejemplo - 5 cajas de Coca-Cola 300ml',NULL,'2025-10-30 03:48:22','2025-10-30 13:19:47'),(3,'2','2025-10-29 00:00:00',2,2,1,500.00,'Pendiente',0.00,0,'Compra de ejemplo - 5 cajas de Coca-Cola 300ml',NULL,'2025-10-30 03:48:59','2025-10-30 13:19:52'),(4,'3','2025-10-29 00:00:00',2,2,1,500.00,'Pendiente',0.00,0,'Compra de ejemplo - 5 cajas de Coca-Cola 300ml',NULL,'2025-10-30 03:49:33','2025-10-30 13:34:20'),(5,'4','2025-10-29 00:00:00',2,2,1,500.00,'Pendiente',0.00,1,'Compra de ejemplo - 5 cajas de Coca-Cola 300ml',1,'2025-10-30 03:50:05','2025-10-30 03:50:05'),(6,'5','2025-10-29 00:00:00',2,2,1,500.00,'Pendiente',0.00,1,'Compra de ejemplo - 5 cajas de Coca-Cola 300ml',1,'2025-10-30 03:54:38','2025-10-30 03:54:38'),(7,'6','2025-10-29 00:00:00',2,2,1,500.00,'Pendiente',0.00,1,'Compra de ejemplo - 5 cajas de Coca-Cola 300ml',1,'2025-10-30 03:57:43','2025-10-30 03:57:43'),(8,'7','2025-10-30 00:00:00',2,2,2,360.00,'Pendiente',0.00,1,NULL,3,'2025-10-30 14:30:55','2025-10-30 14:30:55'),(9,'8','2025-10-30 00:00:00',2,2,2,90.00,'Pendiente',0.00,1,NULL,3,'2025-10-30 14:58:01','2025-10-30 14:58:01'),(10,'9','2025-10-30 00:00:00',4,2,2,950.00,'Pendiente',0.00,1,NULL,3,'2025-10-30 15:20:32','2025-10-30 15:20:32'),(11,'10','2025-10-30 00:00:00',4,2,2,0.00,'Pendiente',0.00,0,NULL,3,'2025-10-30 15:26:25','2025-10-30 15:52:57'),(12,'11','2025-10-30 00:00:00',2,2,2,0.00,'Pendiente',0.00,0,NULL,3,'2025-10-30 15:38:50','2025-10-30 15:52:27'),(13,'CMP-2025-10-001','2025-10-30 00:00:00',5,2,2,330.00,'Pendiente',0.00,1,NULL,3,'2025-10-30 20:11:11','2025-10-30 20:11:11'),(14,'CMP-2025-10-002','2025-10-30 00:00:00',5,2,2,40.00,'Pendiente',0.00,1,NULL,3,'2025-10-30 21:17:02','2025-10-30 21:17:02'),(15,'CMP-2025-10-003','2025-10-30 00:00:00',5,2,2,180.00,'Pendiente',0.00,1,NULL,3,'2025-10-30 21:21:58','2025-10-30 21:21:58'),(16,'CMP-2025-10-004','2025-10-30 00:00:00',5,2,2,120.00,'Pendiente',0.00,1,NULL,3,'2025-10-30 21:34:12','2025-10-30 21:34:12'),(17,'CMP-2025-10-005','2025-10-30 00:00:00',5,2,2,190.00,'Pendiente',0.00,1,NULL,3,'2025-10-30 21:36:55','2025-10-30 21:36:55'),(18,'CMP-2025-10-006','2025-10-31 00:00:00',5,2,2,140.00,'Pendiente',0.00,1,NULL,3,'2025-10-31 02:16:46','2025-10-31 02:16:46'),(19,'CC-COMP-2025-11-01-001','2025-11-01 00:00:00',5,2,2,0.00,'Pendiente',0.00,0,NULL,3,'2025-11-01 01:58:53','2025-11-01 02:09:28');
/*!40000 ALTER TABLE `compra_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `compra_comprobante_O`
--

DROP TABLE IF EXISTS `compra_comprobante_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compra_comprobante_O` (
  `idComprobante` int NOT NULL AUTO_INCREMENT,
  `idCompra` int NOT NULL,
  `rutaArchivo` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombreArchivo` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mimeType` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idComprobante`),
  KEY `idx_comprobante_compra` (`idCompra`),
  CONSTRAINT `compra_comprobante_O_ibfk_1` FOREIGN KEY (`idCompra`) REFERENCES `compra_O` (`idCompra`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Purchase receipts and invoices';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `compra_comprobante_O`
--

LOCK TABLES `compra_comprobante_O` WRITE;
/*!40000 ALTER TABLE `compra_comprobante_O` DISABLE KEYS */;
INSERT INTO `compra_comprobante_O` VALUES (1,9,'/uploads/comprobantes/compra_9_1761836061_5195615722106541197.png','coca300ml-removebg-preview.png','image/png','2025-10-30 14:58:01'),(2,10,'/uploads/comprobantes/compra_10_1761837527_-6070681689744456781.pdf','diagrama.pdf','application/pdf','2025-10-30 15:20:32'),(3,11,'/uploads/comprobantes/compra_11_1761837527_6035343970724854548.png','coca300ml-removebg-preview.png','image/png','2025-10-30 15:26:25'),(4,12,'/uploads/comprobantes/compra_12_1761837527_9181895735619250043.pdf','6.2.7-lab---build-a-sample-web-app-in-a-docker-container_es-XL.pdf','application/pdf','2025-10-30 15:38:51'),(5,10,'/uploads/comprobantes/compra_10_1761845274_-121898097540572145.pdf','diagrama.pdf','application/pdf','2025-10-30 17:32:36'),(6,12,'/uploads/comprobantes/compra_12_1761845274_-121898097540572145.pdf','diagrama.pdf','application/pdf','2025-10-30 17:33:05'),(7,13,'/uploads/comprobantes/compra_13_1761853798_5477129402151544820.pdf','diagrama.pdf','application/pdf','2025-10-30 20:11:11'),(8,14,'/uploads/comprobantes/compra_14_1761855760_-9200086490709928627.webp','coca300ml.webp','image/webp','2025-10-30 21:17:03'),(9,15,'/uploads/comprobantes/compra_15_1761855760_-2472170397437961387.webp','CocaColaOrignal_1024x1024@2x.webp','image/webp','2025-10-30 21:21:58'),(10,16,'/uploads/comprobantes/compra_16_1761855760_-1551040880989877400.webp','CocaColaOrignal_1024x1024@2x.webp','image/webp','2025-10-30 21:34:12'),(11,17,'/uploads/comprobantes/compra_17_1761855760_3751877362480547471.webp','coca300ml.webp','image/webp','2025-10-30 21:36:55'),(12,18,'/uploads/comprobantes/compra_18_1761855760_-4715566303869361035.webp','coca300ml.webp','image/webp','2025-10-31 02:16:47'),(13,19,'/uploads/comprobantes/compra_19_1761960240_-7642169883689460469.webp','coca300ml.webp','image/webp','2025-11-01 01:58:53');
/*!40000 ALTER TABLE `compra_comprobante_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cuenta_corriente_O`
--

DROP TABLE IF EXISTS `cuenta_corriente_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cuenta_corriente_O` (
  `idCuentaCorriente` int NOT NULL AUTO_INCREMENT,
  `tipo` enum('cliente','proveedor') NOT NULL,
  `idPersona` int DEFAULT NULL,
  `idProveedor` int DEFAULT NULL,
  `idEmpresa` int NOT NULL,
  `fechaMovimiento` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tipoMovimiento` enum('venta','compra','pago','cobro','ajuste') NOT NULL,
  `idReferencia` int DEFAULT NULL COMMENT 'ID de venta_O, compra_O, pago_O seg??n tipo',
  `debe` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Monto a favor del cliente/proveedor',
  `haber` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Monto a favor de la empresa',
  `saldo` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Saldo acumulado',
  `descripcion` varchar(255) DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idCuentaCorriente`),
  KEY `idx_ctacte_persona` (`idPersona`,`fechaMovimiento`),
  KEY `idx_ctacte_proveedor` (`idProveedor`,`fechaMovimiento`),
  KEY `idx_ctacte_empresa` (`idEmpresa`,`tipo`),
  KEY `idx_ctacte_fecha` (`fechaMovimiento`),
  CONSTRAINT `fk_ctacte_empresa` FOREIGN KEY (`idEmpresa`) REFERENCES `empresa_O` (`id_empresa`),
  CONSTRAINT `fk_ctacte_persona` FOREIGN KEY (`idPersona`) REFERENCES `persona_O` (`id_persona`),
  CONSTRAINT `fk_ctacte_proveedor` FOREIGN KEY (`idProveedor`) REFERENCES `proveedor_O` (`idProveedor`),
  CONSTRAINT `chk_ctacte_tipo` CHECK ((((`tipo` = _latin1'cliente') and (`idPersona` is not null) and (`idProveedor` is null)) or ((`tipo` = _latin1'proveedor') and (`idProveedor` is not null) and (`idPersona` is null))))
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Cuenta corriente (movimientos de clientes y proveedores)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cuenta_corriente_O`
--

LOCK TABLES `cuenta_corriente_O` WRITE;
/*!40000 ALTER TABLE `cuenta_corriente_O` DISABLE KEYS */;
INSERT INTO `cuenta_corriente_O` VALUES (1,'cliente',8,NULL,2,'2025-11-04 00:00:00','cobro',2,0.00,24.00,24.00,'Entrega #ENT2202511035906 finalizada - Efectivo de ventas en ruta',1,'2025-11-04 00:06:45'),(2,'cliente',8,NULL,2,'2025-11-04 00:00:00','cobro',4,0.00,128.00,128.00,'Entrega #ENT2202511043933 finalizada - Efectivo de ventas en ruta',1,'2025-11-04 21:13:42'),(4,'cliente',1,NULL,1,'2025-11-05 00:00:00','cobro',1,0.00,10.00,-10.00,'Cobro venta #1 (contado) Ref:TEST-REF',1,'2025-11-05 02:28:20'),(5,'cliente',1,NULL,2,'2025-11-04 00:00:00','cobro',NULL,0.00,5.00,-5.00,'COCAC-COB-2025-11-04-001 - Cobro via cuentas_service',1,'2025-11-05 02:35:22');
/*!40000 ALTER TABLE `cuenta_corriente_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `detalle_compra_O`
--

DROP TABLE IF EXISTS `detalle_compra_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `detalle_compra_O` (
  `idDetalleCompra` int NOT NULL AUTO_INCREMENT,
  `idCompra` int NOT NULL,
  `idProducto` int NOT NULL,
  `cantidad_caja` int NOT NULL,
  `botellas_por_caja` int DEFAULT NULL,
  `fechaVencimiento` date DEFAULT NULL,
  `precio_unitario` decimal(10,2) NOT NULL,
  `precio_paquete` decimal(10,2) DEFAULT NULL,
  `precio_por_botella` decimal(10,4) DEFAULT NULL,
  `subtotal` decimal(10,2) GENERATED ALWAYS AS ((`cantidad_caja` * `precio_unitario`)) STORED,
  PRIMARY KEY (`idDetalleCompra`),
  KEY `idx_detalle_compra` (`idCompra`),
  KEY `idx_detalle_compra_producto` (`idProducto`),
  CONSTRAINT `fk_detalle_compra` FOREIGN KEY (`idCompra`) REFERENCES `compra_O` (`idCompra`) ON DELETE CASCADE,
  CONSTRAINT `fk_detalle_compra_producto` FOREIGN KEY (`idProducto`) REFERENCES `producto_O` (`idProducto`),
  CONSTRAINT `detalle_compra_O_chk_precio` CHECK ((`precio_unitario` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Detalle de compras (l??neas de compra)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `detalle_compra_O`
--

LOCK TABLES `detalle_compra_O` WRITE;
/*!40000 ALTER TABLE `detalle_compra_O` DISABLE KEYS */;
INSERT INTO `detalle_compra_O` (`idDetalleCompra`, `idCompra`, `idProducto`, `cantidad_caja`, `botellas_por_caja`, `fechaVencimiento`, `precio_unitario`, `precio_paquete`, `precio_por_botella`) VALUES (2,5,15,5,NULL,NULL,100.00,NULL,NULL),(3,6,15,5,NULL,NULL,100.00,NULL,NULL),(4,7,15,5,NULL,NULL,100.00,NULL,NULL),(5,8,15,20,NULL,NULL,18.00,NULL,NULL),(6,9,15,5,NULL,NULL,18.00,NULL,NULL),(7,10,15,50,NULL,NULL,19.00,NULL,NULL),(8,11,15,10,NULL,NULL,14.00,NULL,NULL),(9,12,15,20,NULL,NULL,15.00,NULL,NULL),(10,13,16,10,NULL,NULL,25.00,NULL,NULL),(11,13,15,5,NULL,NULL,16.00,NULL,NULL),(12,14,16,2,NULL,NULL,20.00,NULL,NULL),(13,15,15,10,NULL,NULL,18.00,NULL,NULL),(14,16,16,5,NULL,NULL,24.00,NULL,NULL),(15,17,16,10,NULL,NULL,19.00,NULL,NULL),(16,18,15,7,NULL,NULL,20.00,NULL,NULL),(17,19,16,10,6,'2025-12-20',15.00,15.00,2.5000);
/*!40000 ALTER TABLE `detalle_compra_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `detalle_venta_O`
--

DROP TABLE IF EXISTS `detalle_venta_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `detalle_venta_O` (
  `idDetalleVenta` int NOT NULL AUTO_INCREMENT,
  `idVenta` int NOT NULL,
  `idProducto` int NOT NULL,
  `cantidad_caja` int NOT NULL,
  `precio_unitario` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) GENERATED ALWAYS AS ((`cantidad_caja` * `precio_unitario`)) STORED,
  `idLote` int DEFAULT NULL,
  PRIMARY KEY (`idDetalleVenta`),
  KEY `idx_detalle_venta` (`idVenta`),
  KEY `idx_detalle_producto` (`idProducto`),
  KEY `fk_detalle_venta_lote` (`idLote`),
  CONSTRAINT `fk_detalle_producto` FOREIGN KEY (`idProducto`) REFERENCES `producto_O` (`idProducto`),
  CONSTRAINT `fk_detalle_venta` FOREIGN KEY (`idVenta`) REFERENCES `venta_O` (`idVenta`) ON DELETE CASCADE,
  CONSTRAINT `fk_detalle_venta_lote` FOREIGN KEY (`idLote`) REFERENCES `lote_producto` (`idLote`) ON DELETE SET NULL,
  CONSTRAINT `detalle_venta_O_chk_precio` CHECK ((`precio_unitario` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Detalle de ventas (l??neas de venta)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `detalle_venta_O`
--

LOCK TABLES `detalle_venta_O` WRITE;
/*!40000 ALTER TABLE `detalle_venta_O` DISABLE KEYS */;
INSERT INTO `detalle_venta_O` (`idDetalleVenta`, `idVenta`, `idProducto`, `cantidad_caja`, `precio_unitario`, `idLote`) VALUES (1,13,15,1,32.00,NULL),(2,14,16,1,32.00,NULL);
/*!40000 ALTER TABLE `detalle_venta_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `empresa_O`
--

DROP TABLE IF EXISTS `empresa_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `empresa_O` (
  `id_empresa` int NOT NULL AUTO_INCREMENT,
  `nombre_empresa` varchar(100) NOT NULL,
  `direccion_empresa` varchar(100) NOT NULL,
  `estado_empresa` tinyint(1) NOT NULL,
  PRIMARY KEY (`id_empresa`),
  KEY `idx_empresa_nombre_direccion` (`nombre_empresa`(50),`direccion_empresa`(50))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Se anota el nombre de la empresa la empresa';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `empresa_O`
--

LOCK TABLES `empresa_O` WRITE;
/*!40000 ALTER TABLE `empresa_O` DISABLE KEYS */;
INSERT INTO `empresa_O` VALUES (1,'Pollos rico','Avenida Epifanio Rios 466',1),(2,'Coca cola','Yapacani',1),(3,'bbb','Yacacani',1);
/*!40000 ALTER TABLE `empresa_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `entrega_ruta_O`
--

DROP TABLE IF EXISTS `entrega_ruta_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entrega_ruta_O` (
  `idEntrega` int NOT NULL AUTO_INCREMENT,
  `numeroEntrega` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `idRuta` int NOT NULL,
  `idEmpresa` int NOT NULL,
  `idEncargado` int NOT NULL COMMENT 'id_persona del chofer/encargado',
  `fechaSalida` date NOT NULL,
  `fechaRetorno` date DEFAULT NULL,
  `estado` enum('pendiente','en_ruta','finalizado','cancelado') COLLATE utf8mb4_unicode_ci DEFAULT 'pendiente',
  `observaciones` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idEntrega`),
  UNIQUE KEY `numeroEntrega` (`numeroEntrega`),
  KEY `idx_entrega_ruta` (`idRuta`),
  KEY `idx_entrega_empresa` (`idEmpresa`),
  KEY `idx_entrega_encargado` (`idEncargado`),
  KEY `idx_entrega_estado` (`estado`),
  KEY `idx_entrega_fechas` (`fechaSalida`,`fechaRetorno`),
  CONSTRAINT `entrega_ruta_O_ibfk_1` FOREIGN KEY (`idRuta`) REFERENCES `ruta_O` (`idRuta`) ON DELETE RESTRICT,
  CONSTRAINT `entrega_ruta_O_ibfk_2` FOREIGN KEY (`idEmpresa`) REFERENCES `empresa_O` (`id_empresa`) ON DELETE RESTRICT,
  CONSTRAINT `entrega_ruta_O_ibfk_3` FOREIGN KEY (`idEncargado`) REFERENCES `persona_O` (`id_persona`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entrega_ruta_O`
--

LOCK TABLES `entrega_ruta_O` WRITE;
/*!40000 ALTER TABLE `entrega_ruta_O` DISABLE KEYS */;
INSERT INTO `entrega_ruta_O` VALUES (1,'ENT2202511038324',2,2,7,'2025-11-04',NULL,'pendiente','','2025-11-03 19:49:43','2025-11-03 19:49:43'),(2,'ENT2202511035906',2,2,8,'2025-11-03','2025-11-04','finalizado',' | Retorno: ','2025-11-03 19:57:33','2025-11-04 00:06:45'),(3,'ENT2202511042716',2,2,8,'2025-11-04','2025-11-04','finalizado',' | Retorno: ','2025-11-04 17:47:59','2025-11-04 20:26:34'),(4,'ENT2202511043933',2,2,8,'2025-11-04','2025-11-04','finalizado',' | Retorno: ','2025-11-04 21:13:03','2025-11-04 21:13:42');
/*!40000 ALTER TABLE `entrega_ruta_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `entrega_ruta_detalle_O`
--

DROP TABLE IF EXISTS `entrega_ruta_detalle_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entrega_ruta_detalle_O` (
  `idDetalle` int NOT NULL AUTO_INCREMENT,
  `idEntrega` int NOT NULL,
  `idProducto` int NOT NULL,
  `idLote` int DEFAULT NULL COMMENT 'Lote espec??fico del que se sacaron los productos',
  `cantidadEnviada` decimal(10,2) NOT NULL,
  `cantidadDevuelta` decimal(10,2) DEFAULT '0.00',
  `cantidadVendida` decimal(10,2) GENERATED ALWAYS AS ((`cantidadEnviada` - `cantidadDevuelta`)) STORED,
  `precioUnitario` decimal(10,2) NOT NULL COMMENT 'Precio seg??n ruta al momento del env??o',
  `montoTotal` decimal(12,2) GENERATED ALWAYS AS ((`cantidadVendida` * `precioUnitario`)) STORED,
  `observaciones` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`idDetalle`),
  KEY `idx_detalle_entrega` (`idEntrega`),
  KEY `idx_detalle_producto` (`idProducto`),
  KEY `idx_detalle_lote` (`idLote`),
  KEY `idx_detalle_cantidades` (`cantidadEnviada`,`cantidadDevuelta`),
  CONSTRAINT `entrega_ruta_detalle_O_ibfk_1` FOREIGN KEY (`idEntrega`) REFERENCES `entrega_ruta_O` (`idEntrega`) ON DELETE CASCADE,
  CONSTRAINT `entrega_ruta_detalle_O_ibfk_2` FOREIGN KEY (`idProducto`) REFERENCES `producto_O` (`idProducto`) ON DELETE RESTRICT,
  CONSTRAINT `entrega_ruta_detalle_O_ibfk_3` FOREIGN KEY (`idLote`) REFERENCES `lote_producto` (`idLote`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entrega_ruta_detalle_O`
--

LOCK TABLES `entrega_ruta_detalle_O` WRITE;
/*!40000 ALTER TABLE `entrega_ruta_detalle_O` DISABLE KEYS */;
INSERT INTO `entrega_ruta_detalle_O` (`idDetalle`, `idEntrega`, `idProducto`, `idLote`, `cantidadEnviada`, `cantidadDevuelta`, `precioUnitario`, `observaciones`) VALUES (1,1,16,14,5.00,0.00,32.00,''),(2,1,15,15,5.00,0.00,24.00,''),(3,2,15,15,1.00,0.00,24.00,''),(4,3,16,14,1.00,1.00,32.00,''),(5,4,15,10,5.00,1.00,24.00,''),(6,4,16,14,4.00,3.00,32.00,'');
/*!40000 ALTER TABLE `entrega_ruta_detalle_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `entrega_venta_vinculo_O`
--

DROP TABLE IF EXISTS `entrega_venta_vinculo_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entrega_venta_vinculo_O` (
  `id` int NOT NULL AUTO_INCREMENT,
  `idEntrega` int NOT NULL,
  `idVenta` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_entrega_venta` (`idEntrega`,`idVenta`),
  KEY `idx_vinculo_entrega` (`idEntrega`),
  KEY `idx_vinculo_venta` (`idVenta`),
  CONSTRAINT `entrega_venta_vinculo_O_ibfk_1` FOREIGN KEY (`idEntrega`) REFERENCES `entrega_ruta_O` (`idEntrega`) ON DELETE CASCADE,
  CONSTRAINT `entrega_venta_vinculo_O_ibfk_2` FOREIGN KEY (`idVenta`) REFERENCES `venta_O` (`idVenta`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entrega_venta_vinculo_O`
--

LOCK TABLES `entrega_venta_vinculo_O` WRITE;
/*!40000 ALTER TABLE `entrega_venta_vinculo_O` DISABLE KEYS */;
/*!40000 ALTER TABLE `entrega_venta_vinculo_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lote_producto`
--

DROP TABLE IF EXISTS `lote_producto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lote_producto` (
  `idLote` int NOT NULL AUTO_INCREMENT,
  `codigoLote` varchar(64) DEFAULT NULL,
  `idProducto` int NOT NULL,
  `idProveedor` int DEFAULT NULL,
  `fechaCompra` date NOT NULL,
  `fechaVencimiento` date DEFAULT NULL,
  `precioCompra` decimal(10,2) NOT NULL,
  `cantidadCajas` int NOT NULL DEFAULT '0',
  `botellasPorCaja` int DEFAULT NULL,
  `stockActual` int NOT NULL DEFAULT '0',
  `idEmpresa` int NOT NULL,
  `idUsuarioCreador` int NOT NULL,
  `idCompra` int DEFAULT NULL,
  `fechaCreacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `precio_minorista` decimal(10,2) DEFAULT NULL,
  `precio_mayorista` decimal(10,2) DEFAULT NULL,
  `precio_especial` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`idLote`),
  UNIQUE KEY `uq_lote_empresa_codigo` (`idEmpresa`,`codigoLote`),
  KEY `idProveedor` (`idProveedor`),
  KEY `idUsuarioCreador` (`idUsuarioCreador`),
  KEY `idx_producto_stock` (`idProducto`,`stockActual`),
  KEY `idx_fecha_vencimiento` (`fechaVencimiento`),
  KEY `idx_empresa` (`idEmpresa`),
  KEY `idx_lote_idCompra` (`idCompra`),
  KEY `idx_lote_codigo` (`codigoLote`),
  CONSTRAINT `fk_lote_compra` FOREIGN KEY (`idCompra`) REFERENCES `compra_O` (`idCompra`) ON DELETE SET NULL,
  CONSTRAINT `lote_producto_ibfk_1` FOREIGN KEY (`idProducto`) REFERENCES `producto_O` (`idProducto`) ON DELETE CASCADE,
  CONSTRAINT `lote_producto_ibfk_2` FOREIGN KEY (`idProveedor`) REFERENCES `proveedor_O` (`idProveedor`) ON DELETE SET NULL,
  CONSTRAINT `lote_producto_ibfk_3` FOREIGN KEY (`idEmpresa`) REFERENCES `empresa_O` (`id_empresa`) ON DELETE CASCADE,
  CONSTRAINT `lote_producto_ibfk_4` FOREIGN KEY (`idUsuarioCreador`) REFERENCES `persona_O` (`id_persona`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Gestiona lotes de productos con fechas de vencimiento y precios variables por compra';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lote_producto`
--

LOCK TABLES `lote_producto` WRITE;
/*!40000 ALTER TABLE `lote_producto` DISABLE KEYS */;
INSERT INTO `lote_producto` VALUES (1,NULL,15,2,'2025-10-29',NULL,100.00,5,NULL,5,2,1,5,'2025-10-30 03:50:05',NULL,NULL,NULL),(2,NULL,15,2,'2025-10-29',NULL,100.00,5,NULL,5,2,1,6,'2025-10-30 03:54:38',NULL,NULL,NULL),(3,NULL,15,2,'2025-10-29',NULL,100.00,5,NULL,5,2,1,7,'2025-10-30 03:57:44',NULL,NULL,NULL),(4,NULL,15,2,'2025-10-30',NULL,18.00,20,NULL,20,2,3,8,'2025-10-30 14:30:55',NULL,NULL,NULL),(5,NULL,15,2,'2025-10-30',NULL,18.00,5,NULL,5,2,3,9,'2025-10-30 14:58:01',NULL,NULL,NULL),(6,NULL,15,4,'2025-10-30','2025-12-19',19.00,50,NULL,50,2,3,10,'2025-10-30 15:20:32',NULL,NULL,NULL),(7,NULL,15,4,'2025-10-30','2025-11-06',14.00,10,NULL,0,2,3,11,'2025-10-30 15:26:25',NULL,NULL,NULL),(8,NULL,15,2,'2025-10-30','2025-11-09',15.00,20,NULL,0,2,3,12,'2025-10-30 15:38:50',NULL,NULL,NULL),(9,NULL,16,5,'2025-10-30','2025-11-29',25.00,10,NULL,10,2,3,13,'2025-10-30 20:11:11',NULL,NULL,NULL),(10,NULL,15,5,'2025-10-30','2025-11-21',16.00,5,NULL,1,2,3,13,'2025-10-30 20:11:11',NULL,NULL,NULL),(11,NULL,16,5,'2025-10-30','2025-12-19',20.00,2,NULL,2,2,3,14,'2025-10-30 21:17:02',NULL,NULL,NULL),(12,NULL,15,5,'2025-10-30','2025-12-19',18.00,10,NULL,10,2,3,15,'2025-10-30 21:21:58',NULL,NULL,NULL),(13,NULL,16,5,'2025-10-30','2025-12-19',24.00,5,NULL,5,2,3,16,'2025-10-30 21:34:12',NULL,NULL,NULL),(14,NULL,16,5,'2025-10-30','2025-11-09',19.00,10,NULL,3,2,3,17,'2025-10-30 21:36:55',30.00,28.50,29.00),(15,NULL,15,5,'2025-10-31','2025-11-09',20.00,7,NULL,0,2,3,18,'2025-10-31 02:16:46',NULL,NULL,NULL),(16,NULL,16,5,'2025-11-01','2025-12-20',15.00,10,6,0,2,3,19,'2025-11-01 01:58:53',NULL,NULL,NULL);
/*!40000 ALTER TABLE `lote_producto` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = latin1 */ ;
/*!50003 SET character_set_results = latin1 */ ;
/*!50003 SET collation_connection  = latin1_swedish_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `tr_actualizar_stock_producto_insert` AFTER INSERT ON `lote_producto` FOR EACH ROW BEGIN
    UPDATE producto_O 
    SET stockCaja = (
        SELECT COALESCE(SUM(stockActual), 0) 
        FROM lote_producto 
        WHERE idProducto = NEW.idProducto
    )
    WHERE idProducto = NEW.idProducto;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = latin1 */ ;
/*!50003 SET character_set_results = latin1 */ ;
/*!50003 SET collation_connection  = latin1_swedish_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `tr_actualizar_stock_producto_update` AFTER UPDATE ON `lote_producto` FOR EACH ROW BEGIN
    UPDATE producto_O 
    SET stockCaja = (
        SELECT COALESCE(SUM(stockActual), 0) 
        FROM lote_producto 
        WHERE idProducto = NEW.idProducto
    )
    WHERE idProducto = NEW.idProducto;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = latin1 */ ;
/*!50003 SET character_set_results = latin1 */ ;
/*!50003 SET collation_connection  = latin1_swedish_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `tr_actualizar_stock_producto_delete` AFTER DELETE ON `lote_producto` FOR EACH ROW BEGIN
    UPDATE producto_O 
    SET stockCaja = (
        SELECT COALESCE(SUM(stockActual), 0) 
        FROM lote_producto 
        WHERE idProducto = OLD.idProducto
    )
    WHERE idProducto = OLD.idProducto;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `margen_ganancia`
--

DROP TABLE IF EXISTS `margen_ganancia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `margen_ganancia` (
  `idMargen` int NOT NULL AUTO_INCREMENT,
  `idEmpresa` int NOT NULL,
  `tipoCliente` enum('minorista','mayorista','especial') NOT NULL,
  `porcentajeMargen` decimal(5,2) NOT NULL DEFAULT '30.00',
  `fechaActualizacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idMargen`),
  UNIQUE KEY `uk_empresa_tipo` (`idEmpresa`,`tipoCliente`),
  CONSTRAINT `margen_ganancia_ibfk_1` FOREIGN KEY (`idEmpresa`) REFERENCES `empresa_O` (`id_empresa`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Define porcentajes de margen de ganancia por tipo de cliente y empresa';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `margen_ganancia`
--

LOCK TABLES `margen_ganancia` WRITE;
/*!40000 ALTER TABLE `margen_ganancia` DISABLE KEYS */;
INSERT INTO `margen_ganancia` VALUES (1,3,'minorista',40.00,'2025-10-29 10:29:45'),(2,2,'minorista',40.00,'2025-10-29 10:29:45'),(3,1,'minorista',40.00,'2025-10-29 10:29:45'),(4,3,'mayorista',25.00,'2025-10-29 10:29:45'),(5,2,'mayorista',25.00,'2025-10-29 10:29:45'),(6,1,'mayorista',25.00,'2025-10-29 10:29:45'),(7,3,'especial',15.00,'2025-10-29 10:29:45'),(8,2,'especial',15.00,'2025-10-29 10:29:45'),(9,1,'especial',15.00,'2025-10-29 10:29:45');
/*!40000 ALTER TABLE `margen_ganancia` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `negocio`
--

DROP TABLE IF EXISTS `negocio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `negocio` (
  `idNegocio` int NOT NULL AUTO_INCREMENT,
  `fechaNegocio` date NOT NULL,
  `idTipoNegocio` int DEFAULT NULL,
  `idProducto` int DEFAULT NULL,
  `idTipopago` int DEFAULT NULL,
  `nota` varchar(15) DEFAULT NULL,
  PRIMARY KEY (`idNegocio`),
  KEY `idProducto` (`idProducto`),
  KEY `idTipopago` (`idTipopago`),
  KEY `idTipoNegocio` (`idTipoNegocio`),
  CONSTRAINT `negocio_ibfk_1` FOREIGN KEY (`idProducto`) REFERENCES `producto_O` (`idProducto`),
  CONSTRAINT `negocio_ibfk_2` FOREIGN KEY (`idTipopago`) REFERENCES `tipoPago` (`idPago`),
  CONSTRAINT `negocio_ibfk_3` FOREIGN KEY (`idTipoNegocio`) REFERENCES `tipoNegocio` (`idTipoNegocio`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `negocio`
--

LOCK TABLES `negocio` WRITE;
/*!40000 ALTER TABLE `negocio` DISABLE KEYS */;
/*!40000 ALTER TABLE `negocio` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pago_O`
--

DROP TABLE IF EXISTS `pago_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pago_O` (
  `idPago` int NOT NULL AUTO_INCREMENT,
  `numeroPago` varchar(20) NOT NULL,
  `fechaPago` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tipo` enum('cobro','pago') NOT NULL COMMENT 'cobro=cliente paga, pago=empresa paga a proveedor',
  `idPersona` int DEFAULT NULL,
  `idProveedor` int DEFAULT NULL,
  `idEmpresa` int NOT NULL,
  `monto` decimal(10,2) NOT NULL,
  `idTipoPago` int NOT NULL,
  `numeroReferencia` varchar(50) DEFAULT NULL COMMENT 'Nro. de transacci??n/cheque',
  `observaciones` text,
  `idUsuario` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idPago`),
  UNIQUE KEY `numeroPago` (`numeroPago`),
  KEY `fk_pago_empresa` (`idEmpresa`),
  KEY `fk_pago_tipopago` (`idTipoPago`),
  KEY `fk_pago_usuario` (`idUsuario`),
  KEY `idx_pago_fecha_empresa` (`fechaPago`,`idEmpresa`),
  KEY `idx_pago_persona` (`idPersona`),
  KEY `idx_pago_proveedor` (`idProveedor`),
  KEY `idx_pago_numero` (`numeroPago`),
  CONSTRAINT `fk_pago_empresa` FOREIGN KEY (`idEmpresa`) REFERENCES `empresa_O` (`id_empresa`),
  CONSTRAINT `fk_pago_persona` FOREIGN KEY (`idPersona`) REFERENCES `persona_O` (`id_persona`),
  CONSTRAINT `fk_pago_proveedor` FOREIGN KEY (`idProveedor`) REFERENCES `proveedor_O` (`idProveedor`),
  CONSTRAINT `fk_pago_tipopago` FOREIGN KEY (`idTipoPago`) REFERENCES `tipoPago` (`idPago`),
  CONSTRAINT `fk_pago_usuario` FOREIGN KEY (`idUsuario`) REFERENCES `user_O` (`id_user`),
  CONSTRAINT `chk_pago_tipo` CHECK ((((`tipo` = _latin1'cobro') and (`idPersona` is not null) and (`idProveedor` is null)) or ((`tipo` = _latin1'pago') and (`idProveedor` is not null) and (`idPersona` is null)))),
  CONSTRAINT `pago_O_chk_1` CHECK ((`monto` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Pagos (cobros de clientes / pagos a proveedores)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pago_O`
--

LOCK TABLES `pago_O` WRITE;
/*!40000 ALTER TABLE `pago_O` DISABLE KEYS */;
/*!40000 ALTER TABLE `pago_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permission_O`
--

DROP TABLE IF EXISTS `permission_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permission_O` (
  `id_perm` int NOT NULL AUTO_INCREMENT,
  `resource` varchar(50) NOT NULL,
  `action` varchar(20) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_perm`),
  UNIQUE KEY `resource` (`resource`,`action`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permission_O`
--

LOCK TABLES `permission_O` WRITE;
/*!40000 ALTER TABLE `permission_O` DISABLE KEYS */;
INSERT INTO `permission_O` VALUES (1,'tipos','view','Ver módulo Tipos'),(2,'tipos','create','Crear tipos'),(3,'tipos','update','Actualizar tipos'),(4,'tipos','delete','Eliminar tipos'),(5,'personas','view','Ver módulo Personas'),(6,'personas','create','Crear personas'),(7,'personas','update','Actualizar personas'),(8,'personas','delete','Eliminar personas'),(9,'empresas','view','Ver módulo Empresas'),(10,'empresas','create','Crear empresas'),(11,'empresas','update','Actualizar empresas'),(12,'empresas','delete','Eliminar empresas'),(13,'prestamos','view','Ver módulo Préstamos'),(14,'prestamos','create','Crear préstamos'),(15,'prestamos','update','Actualizar préstamos'),(16,'prestamos','delete','Eliminar préstamos'),(17,'roles','manage','Administrar roles y permisos'),(18,'tipocajas','view','Ver tipos de caja'),(19,'tipocajas','manage','CRUD tipos de caja'),(20,'productos','view','Ver productos'),(21,'productos','manage','CRUD productos'),(22,'ventas','view','Ver m??dulo Ventas'),(23,'ventas','create','Crear ventas'),(24,'ventas','update','Actualizar ventas'),(25,'ventas','delete','Anular ventas'),(26,'compras','view','Ver m??dulo Compras'),(27,'compras','create','Crear compras'),(28,'compras','update','Actualizar compras'),(29,'compras','delete','Anular compras'),(30,'proveedores','view','Ver proveedores'),(31,'proveedores','manage','CRUD proveedores'),(32,'cuentas','view','Ver cuentas corrientes'),(33,'pagos','create','Registrar pagos/cobros'),(34,'inventario','view','Ver movimientos de inventario'),(35,'productos','create',NULL),(36,'productos','update',NULL),(37,'productos','delete',NULL),(38,'caja','view','Ver reportes de caja'),(39,'rutas','view','Ver rutas'),(40,'rutas','create','Crear rutas'),(41,'rutas','edit','Editar rutas'),(42,'rutas','delete','Eliminar rutas');
/*!40000 ALTER TABLE `permission_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `persona_O`
--

DROP TABLE IF EXISTS `persona_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `persona_O` (
  `nombres_persona` varchar(50) NOT NULL,
  `apellido_paternoPersona` varchar(30) DEFAULT NULL,
  `apellido_maternoPer` varchar(50) DEFAULT NULL,
  `telefono_persona` varchar(15) DEFAULT NULL,
  `id_tipoPersona` int NOT NULL,
  `id_persona` int NOT NULL AUTO_INCREMENT,
  `ci_persona` varchar(10) NOT NULL,
  `direccion_persona` varchar(100) NOT NULL,
  `fotoPersona` varchar(100) NOT NULL,
  `id_empresa` int DEFAULT NULL,
  `tipo_cliente` enum('minorista','mayorista','especial') DEFAULT 'minorista',
  `idRuta` int DEFAULT NULL,
  PRIMARY KEY (`id_persona`),
  UNIQUE KEY `persona_O_unique` (`ci_persona`),
  KEY `id_tipoPersona` (`id_tipoPersona`),
  KEY `id_empresa` (`id_empresa`),
  CONSTRAINT `persona_O_ibfk_1` FOREIGN KEY (`id_tipoPersona`) REFERENCES `tipo_personaO` (`idtipoPers`),
  CONSTRAINT `persona_O_ibfk_2` FOREIGN KEY (`id_empresa`) REFERENCES `empresa_O` (`id_empresa`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `persona_O`
--

LOCK TABLES `persona_O` WRITE;
/*!40000 ALTER TABLE `persona_O` DISABLE KEYS */;
INSERT INTO `persona_O` VALUES ('Juan Carlos','Perez','Mamani','76559625',1,1,'9895653','Yapacani','/uploads/persona_9895653_1760751221.png',2,'minorista',2),('Doña','Gloria','Fuentes','79893418',1,2,'xxxx','San juan','/uploads/persona_xxxx_1760750488.png',1,'minorista',NULL),('Limberg','Villca','Coraite','67762923',3,3,'9059654','BDJKSVBK','/uploads/persona_3912028_1760737026.png',NULL,'minorista',NULL),('Juan','Perez','Perez','78945612',2,4,'12345648','Santa Fe','/uploads/persona_12345648_1760750501.png',1,'minorista',NULL),('Administrador','n','j','44',3,5,'00000000','Cuenta administrativa','/uploads/persona_00000000_1760750603.png',2,'minorista',NULL),('Ivan','Mora','Quispe','67762923',2,6,'123456','Santa fe','/uploads/persona_12345648_1760750501.png',2,'minorista',NULL),('Jorge','Castro','Montaño','12345678',2,7,'12345678','Santa fe','/uploads/persona_12345678_1761343264.jpg',2,'minorista',NULL),('Daniel','Macoño','Soliz','456123123',6,8,'45654564','San juan','/uploads/persona_45654564_1761752284.png',2,'minorista',NULL);
/*!40000 ALTER TABLE `persona_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `persona_ubicacion_O`
--

DROP TABLE IF EXISTS `persona_ubicacion_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `persona_ubicacion_O` (
  `id_persona` int NOT NULL,
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `accuracy` double DEFAULT '0',
  `updated_at` datetime NOT NULL,
  `id_empresa` int NOT NULL,
  PRIMARY KEY (`id_persona`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `persona_ubicacion_O`
--

LOCK TABLES `persona_ubicacion_O` WRITE;
/*!40000 ALTER TABLE `persona_ubicacion_O` DISABLE KEYS */;
INSERT INTO `persona_ubicacion_O` VALUES (1,-17.7907609905318,-63.16188999908528,14,'2025-11-06 00:54:10',2),(2,-17.779488854725276,-63.1956688559977,13,'2025-11-06 00:54:10',1),(4,-17.788982001850272,-63.17267686488663,10,'2025-11-06 00:54:10',1),(5,-17.291776,-63.8554115,141,'2025-11-06 02:14:41',2),(6,-17.759062190065126,-63.18772954287103,24,'2025-11-06 00:54:10',2);
/*!40000 ALTER TABLE `persona_ubicacion_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `precio_producto_O`
--

DROP TABLE IF EXISTS `precio_producto_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `precio_producto_O` (
  `idPrecio` int NOT NULL AUTO_INCREMENT,
  `idProducto` int NOT NULL,
  `tipoPrecio` enum('mayorista','minorista','especial') NOT NULL,
  `precio` decimal(10,2) NOT NULL,
  `fechaInicio` date NOT NULL DEFAULT (curdate()),
  `fechaFin` date DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idPrecio`),
  UNIQUE KEY `unique_producto_tipo_activo` (`idProducto`,`tipoPrecio`,`activo`),
  CONSTRAINT `precio_producto_O_ibfk_1` FOREIGN KEY (`idProducto`) REFERENCES `producto_O` (`idProducto`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `precio_producto_O`
--

LOCK TABLES `precio_producto_O` WRITE;
/*!40000 ALTER TABLE `precio_producto_O` DISABLE KEYS */;
INSERT INTO `precio_producto_O` VALUES (4,2,'minorista',2.30,'2025-10-27',NULL,1,'2025-10-27 01:20:39','2025-10-27 01:20:39'),(5,2,'mayorista',2.00,'2025-10-27',NULL,1,'2025-10-27 01:20:39','2025-10-27 01:20:39'),(6,2,'especial',1.80,'2025-10-27',NULL,1,'2025-10-27 01:20:39','2025-10-27 01:20:39'),(7,3,'minorista',1.00,'2025-10-27',NULL,1,'2025-10-27 01:20:39','2025-10-27 01:20:39'),(8,3,'mayorista',0.85,'2025-10-27',NULL,1,'2025-10-27 01:20:39','2025-10-27 01:20:39'),(9,3,'especial',0.75,'2025-10-27',NULL,1,'2025-10-27 01:20:39','2025-10-27 01:20:39'),(10,4,'minorista',4.50,'2025-10-27',NULL,1,'2025-10-27 01:20:39','2025-10-27 01:20:39'),(11,4,'mayorista',4.00,'2025-10-27',NULL,1,'2025-10-27 01:20:39','2025-10-27 01:20:39'),(12,4,'especial',3.50,'2025-10-27',NULL,1,'2025-10-27 01:20:39','2025-10-27 01:20:39'),(13,15,'minorista',22.00,'2025-10-29',NULL,1,'2025-10-29 01:16:51','2025-10-29 01:16:51'),(14,15,'mayorista',19.00,'2025-10-29',NULL,1,'2025-10-29 01:16:51','2025-10-29 01:16:51'),(15,15,'especial',20.00,'2025-10-29',NULL,1,'2025-10-29 01:16:51','2025-10-29 01:16:51'),(16,16,'minorista',30.00,'2025-11-02',NULL,1,'2025-11-02 20:06:25','2025-11-02 20:06:25'),(17,16,'mayorista',28.00,'2025-11-02',NULL,1,'2025-11-02 20:06:25','2025-11-02 20:06:25'),(18,16,'especial',28.96,'2025-11-02',NULL,1,'2025-11-02 20:06:25','2025-11-02 20:06:25');
/*!40000 ALTER TABLE `precio_producto_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prestamo_O`
--

DROP TABLE IF EXISTS `prestamo_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prestamo_O` (
  `id_prestamo` int NOT NULL AUTO_INCREMENT,
  `cantidad_envaseCaja` int DEFAULT '0',
  `cantidad_prestamoBotellas` int DEFAULT '0',
  `descripcion_envase` varchar(500) DEFAULT NULL,
  `fecha_prestamo` date DEFAULT NULL,
  `id_persona` int NOT NULL,
  `estado_prestamo` tinyint(1) DEFAULT '0',
  `fecha_devolucion` datetime DEFAULT NULL,
  `chofer` int NOT NULL,
  `idTipocaja` int NOT NULL,
  `idProducto` int DEFAULT NULL,
  `esRetornable` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=retornable, 0=no retornable',
  `montoGarantia` decimal(10,2) DEFAULT '0.00' COMMENT 'Monto cobrado como garant??a',
  `garantiaPagada` tinyint(1) DEFAULT '0' COMMENT '1=pag?? garant??a, 0=sin garant??a',
  `idEmpresa` int DEFAULT NULL COMMENT 'Empresa del pr??stamo para scoping directo',
  PRIMARY KEY (`id_prestamo`),
  KEY `id_persona` (`id_persona`),
  KEY `chofer` (`chofer`),
  KEY `idProducto` (`idProducto`),
  KEY `idTipocaja` (`idTipocaja`),
  KEY `idx_prestamo_empresa_estado` (`idEmpresa`,`estado_prestamo`),
  CONSTRAINT `fk_prestamo_empresa` FOREIGN KEY (`idEmpresa`) REFERENCES `empresa_O` (`id_empresa`),
  CONSTRAINT `prestamo_O_ibfk_1` FOREIGN KEY (`id_persona`) REFERENCES `persona_O` (`id_persona`),
  CONSTRAINT `prestamo_O_ibfk_2` FOREIGN KEY (`chofer`) REFERENCES `persona_O` (`id_persona`),
  CONSTRAINT `prestamo_O_ibfk_3` FOREIGN KEY (`idProducto`) REFERENCES `producto_O` (`idProducto`),
  CONSTRAINT `prestamo_O_ibfk_4` FOREIGN KEY (`idTipocaja`) REFERENCES `tipocaja_O` (`idTipocaja`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Prestamo de envases';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prestamo_O`
--

LOCK TABLES `prestamo_O` WRITE;
/*!40000 ALTER TABLE `prestamo_O` DISABLE KEYS */;
INSERT INTO `prestamo_O` VALUES (11,12,480,NULL,'2025-10-22',4,1,NULL,6,1,2,1,0.00,0,2),(12,90,3600,NULL,'2025-10-17',2,0,NULL,4,1,2,1,0.00,0,1),(13,50,2000,NULL,'2025-10-23',2,0,NULL,4,1,2,1,0.00,0,NULL),(14,2,12,NULL,'2025-10-31',1,0,NULL,5,2,15,1,0.00,0,NULL);
/*!40000 ALTER TABLE `prestamo_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `producto_O`
--

DROP TABLE IF EXISTS `producto_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `producto_O` (
  `idProducto` int NOT NULL AUTO_INCREMENT,
  `nombreProducto` varchar(100) NOT NULL,
  `codigoProducto` varchar(150) DEFAULT NULL,
  `imagen_producto` varchar(255) DEFAULT NULL,
  `stockCaja` int NOT NULL DEFAULT '0',
  `idEmpresa` int NOT NULL,
  `idTipoBotella` int NOT NULL,
  `idUsuarioCreador` int DEFAULT NULL,
  `precioMinorista` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Precio para clientes minoristas',
  `precioMayorista` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Precio para clientes mayoristas',
  `precioEspecial` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Precio para clientes especiales',
  PRIMARY KEY (`idProducto`),
  UNIQUE KEY `uq_producto_empresa_nombre` (`idEmpresa`,`nombreProducto`),
  UNIQUE KEY `uq_producto_codigo` (`codigoProducto`),
  KEY `idTipoBotella` (`idTipoBotella`),
  KEY `fk_producto_usuario` (`idUsuarioCreador`),
  KEY `idx_empresa_usuario` (`idEmpresa`,`idUsuarioCreador`),
  KEY `idx_producto_empresa_codigo` (`idEmpresa`,`codigoProducto`),
  CONSTRAINT `fk_producto_usuario` FOREIGN KEY (`idUsuarioCreador`) REFERENCES `persona_O` (`id_persona`) ON DELETE SET NULL,
  CONSTRAINT `producto_O_ibfk_2` FOREIGN KEY (`idTipoBotella`) REFERENCES `tipoBotella` (`idTipoBotella`),
  CONSTRAINT `producto_O_ibfk_4` FOREIGN KEY (`idEmpresa`) REFERENCES `empresa_O` (`id_empresa`),
  CONSTRAINT `chk_stockCaja_nonneg` CHECK ((`stockCaja` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `producto_O`
--

LOCK TABLES `producto_O` WRITE;
/*!40000 ALTER TABLE `producto_O` DISABLE KEYS */;
INSERT INTO `producto_O` VALUES (2,'Inca Kola 1.5L',NULL,NULL,80,1,1,NULL,0.00,0.00,0.00),(3,'Sprite 2L',NULL,NULL,60,1,1,NULL,0.00,0.00,0.00),(4,'Agua San Luis 625ml',NULL,NULL,200,1,2,NULL,0.00,0.00,0.00),(10,'Coca Cola 500ml',NULL,'/uploads/productos/coca-cola-500ml.jpg',50,1,1,NULL,0.00,0.00,0.00),(11,'Pepsi 500ml',NULL,'/uploads/productos/pepsi-500ml.jpg',30,1,2,NULL,0.00,0.00,0.00),(13,'Cerveza Pilsen 330ml',NULL,'/uploads/productos/cerveza-pilsen-330ml.jpg',24,1,1,NULL,0.00,0.00,0.00),(15,'Coca-Cola 300 ml',NULL,'/uploads/productos/producto_1761700611_-2216335351774697115.png',101,2,2,NULL,0.00,0.00,0.00),(16,'Coca cola 500ml','COCACOLA-PRD-2025-10-30-001','/uploads/productos/producto_1761856588_-8353643026920324123.png',20,2,2,5,0.00,0.00,0.00);
/*!40000 ALTER TABLE `producto_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `proveedor_O`
--

DROP TABLE IF EXISTS `proveedor_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `proveedor_O` (
  `idProveedor` int NOT NULL AUTO_INCREMENT,
  `idPersona` int DEFAULT NULL,
  `idEmpresaProveedor` int DEFAULT NULL,
  `nombreComercial` varchar(100) DEFAULT NULL,
  `codigoProveedor` varchar(180) DEFAULT NULL,
  `contacto` varchar(100) DEFAULT NULL,
  `telefono` varchar(15) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `esEmpresa` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=empresa, 0=persona',
  `estado` tinyint(1) NOT NULL DEFAULT '1',
  `observaciones` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idProveedor`),
  UNIQUE KEY `uq_proveedor_codigo` (`codigoProveedor`),
  KEY `idx_proveedor_empresa` (`idEmpresaProveedor`),
  KEY `idx_proveedor_persona` (`idPersona`),
  KEY `idx_proveedor_estado` (`estado`),
  CONSTRAINT `fk_proveedor_empresa` FOREIGN KEY (`idEmpresaProveedor`) REFERENCES `empresa_O` (`id_empresa`),
  CONSTRAINT `fk_proveedor_persona` FOREIGN KEY (`idPersona`) REFERENCES `persona_O` (`id_persona`),
  CONSTRAINT `chk_proveedor_tipo` CHECK ((((`esEmpresa` = 1) and (`idEmpresaProveedor` is not null) and (`idPersona` is null)) or ((`esEmpresa` = 0) and (`idPersona` is not null) and (`idEmpresaProveedor` is null))))
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Proveedores: empresas o personas particulares';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `proveedor_O`
--

LOCK TABLES `proveedor_O` WRITE;
/*!40000 ALTER TABLE `proveedor_O` DISABLE KEYS */;
INSERT INTO `proveedor_O` VALUES (1,NULL,1,'Distribuidora Bebidas SAC',NULL,NULL,'987654321','ventas@distribuidora.com','Av. Industrial 123',1,1,NULL,'2025-10-21 02:56:04','2025-10-21 02:56:04'),(2,NULL,2,'Importaciones del Sur',NULL,NULL,'965432198','contacto@importsur.com','Jr. Comercio 456',1,1,NULL,'2025-10-21 02:56:04','2025-10-21 02:56:04'),(3,NULL,1,'Distribuidora Bebidas SAC',NULL,NULL,'987654321','ventas@distribuidora.com','Av. Industrial 123',1,1,NULL,'2025-10-21 02:56:32','2025-10-21 02:56:32'),(4,NULL,2,'Importaciones del Sur',NULL,NULL,'965432198','contacto@importsur.com','Jr. Comercio 456',1,1,NULL,'2025-10-21 02:56:32','2025-10-30 15:22:37'),(5,NULL,2,'Agencia Zarate','COCACOLA-PRV-2025-10-30-001','Zarate','123456','zarate@gmail.com','Yapacani',1,1,NULL,'2025-10-30 18:37:21','2025-10-30 18:37:21');
/*!40000 ALTER TABLE `proveedor_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_O`
--

DROP TABLE IF EXISTS `role_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_O` (
  `idrole` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `id_empresa` int DEFAULT NULL,
  PRIMARY KEY (`idrole`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_empresa` (`id_empresa`),
  CONSTRAINT `role_O_ibfk_1` FOREIGN KEY (`id_empresa`) REFERENCES `empresa_O` (`id_empresa`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_O`
--

LOCK TABLES `role_O` WRITE;
/*!40000 ALTER TABLE `role_O` DISABLE KEYS */;
INSERT INTO `role_O` VALUES (1,'admin','Full access',NULL),(3,'viewer','Read-only',NULL),(4,'chofer','Create prestamos and edit',NULL),(5,'cliente','Cliente - solo puede ver sus propios prestamos',NULL),(6,'superadmin','Full access to all resources',NULL);
/*!40000 ALTER TABLE `role_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permission_O`
--

DROP TABLE IF EXISTS `role_permission_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permission_O` (
  `role_id` int NOT NULL,
  `perm_id` int NOT NULL,
  `id_empresa` int DEFAULT NULL COMMENT 'NULL = global (superadmin), valor = especÃ­fico de empresa',
  `id_empresa_norm` int GENERATED ALWAYS AS (ifnull(`id_empresa`,-(1))) STORED,
  PRIMARY KEY (`role_id`,`perm_id`),
  UNIQUE KEY `uq_role_perm_scope` (`role_id`,`perm_id`,`id_empresa_norm`),
  KEY `perm_id` (`perm_id`),
  KEY `idx_empresa_role` (`id_empresa`,`role_id`),
  CONSTRAINT `role_permission_O_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `role_O` (`idrole`) ON DELETE CASCADE,
  CONSTRAINT `role_permission_O_ibfk_2` FOREIGN KEY (`perm_id`) REFERENCES `permission_O` (`id_perm`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permission_O`
--

LOCK TABLES `role_permission_O` WRITE;
/*!40000 ALTER TABLE `role_permission_O` DISABLE KEYS */;
INSERT INTO `role_permission_O` (`role_id`, `perm_id`, `id_empresa`) VALUES (1,1,NULL),(1,2,NULL),(1,3,NULL),(1,4,NULL),(1,5,NULL),(1,6,NULL),(1,7,NULL),(1,8,NULL),(1,13,NULL),(1,14,NULL),(1,15,NULL),(1,16,NULL),(1,17,NULL),(1,18,NULL),(1,19,NULL),(1,20,NULL),(1,21,NULL),(1,22,NULL),(1,23,NULL),(1,24,NULL),(1,25,NULL),(1,26,NULL),(1,27,NULL),(1,28,NULL),(1,29,NULL),(1,30,NULL),(1,31,NULL),(1,32,NULL),(1,33,NULL),(1,34,NULL),(1,35,NULL),(1,36,NULL),(1,37,NULL),(1,38,NULL),(1,39,NULL),(1,40,NULL),(1,41,NULL),(1,42,NULL),(3,13,NULL),(3,20,NULL),(4,13,NULL),(4,18,NULL),(4,20,NULL),(5,13,2),(5,22,2),(6,1,NULL),(6,2,NULL),(6,3,NULL),(6,4,NULL),(6,5,NULL),(6,6,NULL),(6,7,NULL),(6,8,NULL),(6,9,NULL),(6,10,NULL),(6,11,NULL),(6,12,NULL),(6,13,NULL),(6,14,NULL),(6,15,NULL),(6,16,NULL),(6,17,NULL),(6,18,NULL),(6,19,NULL),(6,20,NULL),(6,21,NULL),(6,22,NULL),(6,23,NULL),(6,24,NULL),(6,25,NULL),(6,26,NULL),(6,27,NULL),(6,28,NULL),(6,29,NULL),(6,30,NULL),(6,31,NULL),(6,32,NULL),(6,33,NULL),(6,34,NULL),(6,35,NULL),(6,36,NULL),(6,37,NULL);
/*!40000 ALTER TABLE `role_permission_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ruta_O`
--

DROP TABLE IF EXISTS `ruta_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ruta_O` (
  `idRuta` int NOT NULL AUTO_INCREMENT,
  `nombreRuta` varchar(150) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `idEmpresa` int NOT NULL,
  `incremento_general` decimal(10,2) DEFAULT '0.00' COMMENT 'Incremento aplicado a todos los productos de esta ruta',
  PRIMARY KEY (`idRuta`),
  UNIQUE KEY `uq_ruta_empresa` (`idEmpresa`,`nombreRuta`),
  KEY `idx_ruta_empresa` (`idEmpresa`),
  CONSTRAINT `fk_ruta_empresa` FOREIGN KEY (`idEmpresa`) REFERENCES `empresa_O` (`id_empresa`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ruta_O`
--

LOCK TABLES `ruta_O` WRITE;
/*!40000 ALTER TABLE `ruta_O` DISABLE KEYS */;
INSERT INTO `ruta_O` VALUES (1,'Ayacucho-San Martin',NULL,1,0.00),(2,'Ayacucho','',2,2.00),(3,'San juan','',2,1.00),(4,'Yapacani','',2,-1.00);
/*!40000 ALTER TABLE `ruta_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ruta_precio`
--

DROP TABLE IF EXISTS `ruta_precio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ruta_precio` (
  `idRuta` int NOT NULL,
  `idProducto` int NOT NULL,
  `incremento_precio` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Incremento o decremento al precio base del producto',
  PRIMARY KEY (`idRuta`,`idProducto`),
  KEY `fk_ruta_precio_producto` (`idProducto`),
  CONSTRAINT `fk_ruta_precio_producto` FOREIGN KEY (`idProducto`) REFERENCES `producto_O` (`idProducto`) ON DELETE CASCADE,
  CONSTRAINT `fk_ruta_precio_ruta` FOREIGN KEY (`idRuta`) REFERENCES `ruta_O` (`idRuta`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ruta_precio`
--

LOCK TABLES `ruta_precio` WRITE;
/*!40000 ALTER TABLE `ruta_precio` DISABLE KEYS */;
INSERT INTO `ruta_precio` VALUES (1,15,32.00);
/*!40000 ALTER TABLE `ruta_precio` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schema_migrations`
--

DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `applied_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `filename` (`filename`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schema_migrations`
--

LOCK TABLES `schema_migrations` WRITE;
/*!40000 ALTER TABLE `schema_migrations` DISABLE KEYS */;
INSERT INTO `schema_migrations` VALUES (1,'2025_10_19_db_refactors.sql','2025-10-24 02:50:43'),(2,'2025_10_20_ventas_compras_schema.sql','2025-10-24 02:50:43');
/*!40000 ALTER TABLE `schema_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tipoBotella`
--

DROP TABLE IF EXISTS `tipoBotella`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tipoBotella` (
  `idTipoBotella` int NOT NULL AUTO_INCREMENT,
  `tipoBotella` varchar(100) NOT NULL,
  PRIMARY KEY (`idTipoBotella`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tipoBotella`
--

LOCK TABLES `tipoBotella` WRITE;
/*!40000 ALTER TABLE `tipoBotella` DISABLE KEYS */;
INSERT INTO `tipoBotella` VALUES (1,'Vidrio'),(2,'Desechable'),(3,'Retornable');
/*!40000 ALTER TABLE `tipoBotella` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tipoNegocio`
--

DROP TABLE IF EXISTS `tipoNegocio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tipoNegocio` (
  `idTipoNegocio` int NOT NULL AUTO_INCREMENT,
  `nombreTipoNegocio` varchar(100) NOT NULL,
  PRIMARY KEY (`idTipoNegocio`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tipoNegocio`
--

LOCK TABLES `tipoNegocio` WRITE;
/*!40000 ALTER TABLE `tipoNegocio` DISABLE KEYS */;
INSERT INTO `tipoNegocio` VALUES (1,'Compra'),(2,'Venta');
/*!40000 ALTER TABLE `tipoNegocio` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tipoPago`
--

DROP TABLE IF EXISTS `tipoPago`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tipoPago` (
  `idPago` int NOT NULL AUTO_INCREMENT,
  `nombrePago` varchar(100) NOT NULL,
  PRIMARY KEY (`idPago`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tipoPago`
--

LOCK TABLES `tipoPago` WRITE;
/*!40000 ALTER TABLE `tipoPago` DISABLE KEYS */;
INSERT INTO `tipoPago` VALUES (1,'Pago al credito'),(2,'Pago al contado'),(7,'Transferencia Bancaria');
/*!40000 ALTER TABLE `tipoPago` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tipoVenta`
--

DROP TABLE IF EXISTS `tipoVenta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tipoVenta` (
  `idTipoVenta` int NOT NULL AUTO_INCREMENT,
  `nombreTipoVenta` varchar(50) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idTipoVenta`),
  UNIQUE KEY `nombreTipoVenta` (`nombreTipoVenta`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Tipos de venta: Mayor, Menor';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tipoVenta`
--

LOCK TABLES `tipoVenta` WRITE;
/*!40000 ALTER TABLE `tipoVenta` DISABLE KEYS */;
INSERT INTO `tipoVenta` VALUES (1,'Mayorista','Venta al por mayor (distribuidores, restaurantes, etc.)',1,'2025-10-20 04:08:27'),(2,'Minorista','Venta al por menor (clientes individuales)',1,'2025-10-20 04:08:27'),(4,'Especial','Venta a clientes especiales con precios personalizados',1,'2025-11-03 12:07:05');
/*!40000 ALTER TABLE `tipoVenta` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tipo_personaO`
--

DROP TABLE IF EXISTS `tipo_personaO`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tipo_personaO` (
  `tipoPersona` varchar(100) DEFAULT NULL,
  `idtipoPers` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`idtipoPers`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tipo_personaO`
--

LOCK TABLES `tipo_personaO` WRITE;
/*!40000 ALTER TABLE `tipo_personaO` DISABLE KEYS */;
INSERT INTO `tipo_personaO` VALUES ('Cliente',1),('Chofer',2),('Propietario',3),('Encargado',5),('Ayudante',6);
/*!40000 ALTER TABLE `tipo_personaO` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tipocaja_O`
--

DROP TABLE IF EXISTS `tipocaja_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tipocaja_O` (
  `idTipocaja` int NOT NULL AUTO_INCREMENT,
  `nombretipo_caja` varchar(100) NOT NULL,
  `cantidadBotellasCaja` int NOT NULL,
  PRIMARY KEY (`idTipocaja`),
  UNIQUE KEY `uq_tipocaja_nombre` (`nombretipo_caja`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tipocaja_O`
--

LOCK TABLES `tipocaja_O` WRITE;
/*!40000 ALTER TABLE `tipocaja_O` DISABLE KEYS */;
INSERT INTO `tipocaja_O` VALUES (1,'Madera',40),(2,'Plastico',12),(3,'Retornable',8);
/*!40000 ALTER TABLE `tipocaja_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_O`
--

DROP TABLE IF EXISTS `user_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_O` (
  `id_user` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `id_role` int NOT NULL,
  `id_persona` int DEFAULT NULL,
  `estado` tinyint NOT NULL DEFAULT '1' COMMENT '1=activo, 0=inactivo',
  `profile_photo` longtext,
  PRIMARY KEY (`id_user`),
  UNIQUE KEY `username` (`username`),
  KEY `id_role` (`id_role`),
  KEY `id_persona` (`id_persona`),
  CONSTRAINT `user_O_ibfk_1` FOREIGN KEY (`id_role`) REFERENCES `role_O` (`idrole`),
  CONSTRAINT `user_O_ibfk_2` FOREIGN KEY (`id_persona`) REFERENCES `persona_O` (`id_persona`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_O`
--

LOCK TABLES `user_O` WRITE;
/*!40000 ALTER TABLE `user_O` DISABLE KEYS */;
INSERT INTO `user_O` VALUES (1,'LimbergVC','123456',6,3,1,NULL),(2,'Tania','123456',5,2,1,NULL),(3,'limberg','123456',1,5,1,NULL),(4,'Ever','$2b$12$vMe00DW.40M/BGdDyiTO9edbsHkB78ApP6/VVbypBnQpJOQRLt8NC',5,1,1,NULL),(5,'JorgeCastro','$2b$12$7H0ejGJiGgpPDbjmS0JFVuPuchvcMWMgTBApirxeO5PvPRqZYfn56',4,7,1,NULL),(6,'Daniel','$2b$12$3M.VIaiYVPeszKGVRobgXulrEuXhe0inUClTpK5Jb2lFyPiCKCTF2',3,8,1,NULL);
/*!40000 ALTER TABLE `user_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `v_producto_info_completa`
--

DROP TABLE IF EXISTS `v_producto_info_completa`;
/*!50001 DROP VIEW IF EXISTS `v_producto_info_completa`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_producto_info_completa` AS SELECT 
 1 AS `idProducto`,
 1 AS `nombreProducto`,
 1 AS `stockCaja`,
 1 AS `imagen_producto`,
 1 AS `idTipoBotella`,
 1 AS `idEmpresa`,
 1 AS `idUsuarioCreador`,
 1 AS `tipoBotella`,
 1 AS `lote_activo_id`,
 1 AS `idProveedor`,
 1 AS `nombreProveedor`,
 1 AS `fecha_vencimiento_proxima`,
 1 AS `precio_compra_actual`,
 1 AS `stock_lote_actual`,
 1 AS `precio_minorista`,
 1 AS `precio_mayorista`,
 1 AS `precio_especial`,
 1 AS `stock_total_lotes`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `venta_O`
--

DROP TABLE IF EXISTS `venta_O`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `venta_O` (
  `idVenta` int NOT NULL AUTO_INCREMENT,
  `codigoVenta` varchar(64) DEFAULT NULL,
  `numeroVenta` varchar(20) NOT NULL,
  `fechaVenta` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `idCliente` int NOT NULL,
  `idEmpresa` int NOT NULL,
  `idTipoVenta` int NOT NULL,
  `idTipoPago` int NOT NULL,
  `montoTotal` decimal(10,2) NOT NULL DEFAULT '0.00',
  `estado_pago` enum('Pagado','Pendiente','Parcial') DEFAULT 'Pendiente',
  `porcentaje_descuento` decimal(5,2) DEFAULT '0.00',
  `monto_descuento` decimal(10,2) DEFAULT '0.00',
  `montoPagado` decimal(10,2) NOT NULL DEFAULT '0.00',
  `saldo` decimal(10,2) GENERATED ALWAYS AS ((`montoTotal` - `montoPagado`)) STORED,
  `estado` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=activa, 0=anulada',
  `observaciones` text,
  `idUsuario` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idVenta`),
  UNIQUE KEY `numeroVenta` (`numeroVenta`),
  UNIQUE KEY `uq_venta_empresa_codigo` (`idEmpresa`,`codigoVenta`),
  KEY `fk_venta_tipoventa` (`idTipoVenta`),
  KEY `fk_venta_tipopago` (`idTipoPago`),
  KEY `fk_venta_usuario` (`idUsuario`),
  KEY `idx_venta_fecha_empresa` (`fechaVenta`,`idEmpresa`),
  KEY `idx_venta_cliente` (`idCliente`),
  KEY `idx_venta_saldo` (`saldo`),
  KEY `idx_venta_numero` (`numeroVenta`),
  KEY `idx_venta_codigo` (`codigoVenta`),
  KEY `idx_venta_estadoPago` (`estado_pago`),
  CONSTRAINT `fk_venta_cliente` FOREIGN KEY (`idCliente`) REFERENCES `persona_O` (`id_persona`),
  CONSTRAINT `fk_venta_empresa` FOREIGN KEY (`idEmpresa`) REFERENCES `empresa_O` (`id_empresa`),
  CONSTRAINT `fk_venta_tipopago` FOREIGN KEY (`idTipoPago`) REFERENCES `tipoPago` (`idPago`),
  CONSTRAINT `fk_venta_tipoventa` FOREIGN KEY (`idTipoVenta`) REFERENCES `tipoVenta` (`idTipoVenta`),
  CONSTRAINT `fk_venta_usuario` FOREIGN KEY (`idUsuario`) REFERENCES `user_O` (`id_user`),
  CONSTRAINT `venta_O_chk_monto` CHECK ((`monto_descuento` >= 0)),
  CONSTRAINT `venta_O_chk_porcentaje` CHECK (((`porcentaje_descuento` >= 0) and (`porcentaje_descuento` <= 100)))
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Ventas (cabecera): mayor/menor, contado/cr??dito';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `venta_O`
--

LOCK TABLES `venta_O` WRITE;
/*!40000 ALTER TABLE `venta_O` DISABLE KEYS */;
INSERT INTO `venta_O` (`idVenta`, `codigoVenta`, `numeroVenta`, `fechaVenta`, `idCliente`, `idEmpresa`, `idTipoVenta`, `idTipoPago`, `montoTotal`, `estado_pago`, `porcentaje_descuento`, `monto_descuento`, `montoPagado`, `estado`, `observaciones`, `idUsuario`, `created_at`, `updated_at`) VALUES (1,NULL,'VTA-2025-001','2025-10-21 00:00:00',1,1,2,1,45.50,'Parcial',0.00,0.00,10.00,1,'Venta minorista de prueba',1,'2025-10-21 02:56:04','2025-11-05 02:28:20'),(2,NULL,'VTA-2025-002','2025-10-20 00:00:00',2,1,1,1,250.00,'Pendiente',0.00,0.00,0.00,1,'Venta mayorista de prueba',1,'2025-10-21 02:56:04','2025-10-21 02:56:04'),(3,NULL,'VTA-2025-003','2025-10-19 00:00:00',3,1,2,1,78.00,'Pendiente',0.00,0.00,0.00,1,NULL,1,'2025-10-21 02:56:04','2025-10-21 02:56:04'),(4,NULL,'VTA-2025-004','2025-10-18 00:00:00',1,1,1,2,420.50,'Pendiente',0.00,0.00,0.00,1,'Venta a crÃ©dito - Cliente 1',1,'2025-10-21 02:56:04','2025-10-21 02:56:04'),(5,NULL,'VTA-2025-005','2025-10-16 00:00:00',2,1,2,2,156.00,'Pendiente',0.00,0.00,0.00,1,'Venta a crÃ©dito - Cliente 2',1,'2025-10-21 02:56:04','2025-10-21 02:56:04'),(6,NULL,'VTA-2025-006','2025-10-13 00:00:00',4,1,2,1,89.50,'Pendiente',0.00,0.00,0.00,1,NULL,1,'2025-10-21 02:56:04','2025-10-21 02:56:04'),(7,NULL,'VTA-2025-007','2025-10-11 00:00:00',3,1,1,1,340.00,'Pendiente',0.00,0.00,0.00,1,NULL,1,'2025-10-21 02:56:04','2025-10-21 02:56:04'),(8,NULL,'VTA-2025-008','2025-10-06 00:00:00',2,1,2,1,123.50,'Pendiente',0.00,0.00,0.00,1,NULL,1,'2025-10-21 02:56:04','2025-10-21 02:56:04'),(9,NULL,'VTA-2025-009','2025-10-01 00:00:00',3,1,1,2,580.00,'Pendiente',0.00,0.00,0.00,1,'Venta a crÃ©dito antigua',1,'2025-10-21 02:56:04','2025-10-21 02:56:04'),(10,NULL,'VTA-2025-010','2025-09-26 00:00:00',1,1,2,1,67.00,'Pendiente',0.00,0.00,0.00,1,NULL,1,'2025-10-21 02:56:04','2025-10-21 02:56:04'),(12,'COCACOLA-VTA-2025-11-02-001','VTA-20251102-0001','2025-11-02 00:00:00',1,2,2,1,32.00,'Pendiente',0.00,0.00,0.00,1,'test route price',NULL,'2025-11-02 21:41:24','2025-11-02 21:41:24'),(13,'COCACOLA-VTA-2025-11-02-002','VTA-20251102-0002','2025-11-02 00:00:00',1,2,2,1,32.00,'Pendiente',0.00,0.00,0.00,1,'test route price',NULL,'2025-11-02 21:42:34','2025-11-02 21:42:34'),(14,'COCACOLA-VTA-2025-11-03-001','VTA-20251103-0001','2025-11-03 00:00:00',1,2,2,1,32.00,'Pendiente',0.00,0.00,0.00,1,'',NULL,'2025-11-03 15:18:03','2025-11-03 15:18:03');
/*!40000 ALTER TABLE `venta_O` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'SystemaOllantay'
--

--
-- Dumping routines for database 'SystemaOllantay'
--

--
-- Current Database: `SystemaOllantay`
--

USE `SystemaOllantay`;

--
-- Final view structure for view `v_producto_info_completa`
--

/*!50001 DROP VIEW IF EXISTS `v_producto_info_completa`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = latin1 */;
/*!50001 SET character_set_results     = latin1 */;
/*!50001 SET collation_connection      = latin1_swedish_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_producto_info_completa` AS select `p`.`idProducto` AS `idProducto`,`p`.`nombreProducto` AS `nombreProducto`,`p`.`stockCaja` AS `stockCaja`,`p`.`imagen_producto` AS `imagen_producto`,`p`.`idTipoBotella` AS `idTipoBotella`,`p`.`idEmpresa` AS `idEmpresa`,`p`.`idUsuarioCreador` AS `idUsuarioCreador`,`tb`.`tipoBotella` AS `tipoBotella`,`l`.`idLote` AS `lote_activo_id`,`l`.`idProveedor` AS `idProveedor`,`prov`.`nombreComercial` AS `nombreProveedor`,`l`.`fechaVencimiento` AS `fecha_vencimiento_proxima`,`l`.`precioCompra` AS `precio_compra_actual`,`l`.`stockActual` AS `stock_lote_actual`,round((`l`.`precioCompra` * (1 + (coalesce(`m_min`.`porcentajeMargen`,40) / 100))),2) AS `precio_minorista`,round((`l`.`precioCompra` * (1 + (coalesce(`m_may`.`porcentajeMargen`,25) / 100))),2) AS `precio_mayorista`,round((`l`.`precioCompra` * (1 + (coalesce(`m_esp`.`porcentajeMargen`,15) / 100))),2) AS `precio_especial`,coalesce(sum(`l2`.`stockActual`),0) AS `stock_total_lotes` from (((((((`producto_O` `p` left join `tipoBotella` `tb` on((`p`.`idTipoBotella` = `tb`.`idTipoBotella`))) left join `lote_producto` `l` on(((`p`.`idProducto` = `l`.`idProducto`) and (`l`.`stockActual` > 0) and (`l`.`idLote` = (select `lote_producto`.`idLote` from `lote_producto` where ((`lote_producto`.`idProducto` = `p`.`idProducto`) and (`lote_producto`.`stockActual` > 0)) order by `lote_producto`.`fechaVencimiento`,`lote_producto`.`fechaCompra` limit 1))))) left join `proveedor_O` `prov` on((`l`.`idProveedor` = `prov`.`idProveedor`))) left join `lote_producto` `l2` on(((`p`.`idProducto` = `l2`.`idProducto`) and (`l2`.`stockActual` > 0)))) left join `margen_ganancia` `m_min` on(((`p`.`idEmpresa` = `m_min`.`idEmpresa`) and (`m_min`.`tipoCliente` = 'minorista')))) left join `margen_ganancia` `m_may` on(((`p`.`idEmpresa` = `m_may`.`idEmpresa`) and (`m_may`.`tipoCliente` = 'mayorista')))) left join `margen_ganancia` `m_esp` on(((`p`.`idEmpresa` = `m_esp`.`idEmpresa`) and (`m_esp`.`tipoCliente` = 'especial')))) group by `p`.`idProducto` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-06  2:23:50
