import re

# Leer el archivo
with open('c:/Users/atthort-win/Documents/ollantayProject/backend/compra_service/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Reemplazar tp.tipoPago por tp.nombrePago AS tipoPago
content = content.replace('tp.tipoPago', 'tp.nombrePago AS tipoPago')

# Escribir el archivo
with open('c:/Users/atthort-win/Documents/ollantayProject/backend/compra_service/main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Archivo actualizado correctamente")
