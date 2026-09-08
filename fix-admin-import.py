import re

f = r"D:\proyectosweb\YesYes\frontend\src\pages\AdminImport.tsx"
c = open(f, encoding='utf-8').read()

# Buscar el div de Ganancia real y reemplazarlo con Venta + Ganancia
# El texto exacto del archivo (con indentación de 12 espacios)
old = '''              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Ganancia real:</span>
                <span className="font-medium text-green-600">${Number((form.totalCost * (form.margin - 1)).toFixed(2))} USD</span>
              </div>'''

new = '''              <div className="flex justify-between text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <span className="text-gray-700 font-medium">Venta:</span>
                <span className="font-bold text-green-700">
                  ${form.finalPriceUSD.toFixed(2)} USD / ${form.finalPriceCLP.toLocaleString('es-CL')} CLP
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Ganancia real:</span>
                <span className="font-medium text-green-600">${Number((form.totalCost * (form.margin - 1)).toFixed(2))} USD</span>
              </div>'''

if old in c:
    c = c.replace(old, new, 1)
    open(f, 'w', encoding='utf-8').write(c)
    print('Done - bloque Venta agregado')
else:
    print('NO SE ENCONTRO el bloque de Ganancia real')
    # Imprimir las líneas 387-391 del archivo para debug
    lines = c.split('\n')
    for i, line in enumerate(lines[386:392], start=387):
        print(f'{i}: {repr(line)}')
