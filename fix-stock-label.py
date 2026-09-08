import re

f = r"D:\proyectosweb\YesYes\frontend\src\pages\AdminImport.tsx"
c = open(f, encoding='utf-8').read()

# Actualizar la etiqueta de Stock
old = '<p className="text-xs text-gray-500 mt-1">CJ: {Number(preview.inventory ?? preview.stock ?? 0).toLocaleString(\'es-CL\')} unidades</p>'
new = '<p className="text-xs text-gray-500 mt-1">Si viene 0 → 100 por defecto · CJ: {Number(preview.inventory ?? preview.stock ?? 0).toLocaleString(\'es-CL\')} unidades</p>'

if old in c:
    c = c.replace(old, new, 1)
    open(f, 'w', encoding='utf-8').write(c)
    print('Done - etiqueta de Stock actualizada')
else:
    print('NO SE ENCONTRO la etiqueta de Stock')
    # Buscar la línea con "CJ:" para debug
    for i, line in enumerate(c.split('\n'), start=1):
        if 'CJ:' in line and 'unidades' in line:
            print(f'{i}: {repr(line)}')
