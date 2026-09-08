$file = "D:\proyectosweb\YesYes\frontend\src\pages\AdminImport.tsx"
$content = Get-Content $file -Raw

# 1. "Editable si CJ no lo informa" → "Si viene 0 → 9.17 por defecto"
$content = $content.Replace("Editable si CJ no lo informa", "Si viene 0 → 9.17 por defecto")

# 2. DOLLAR_RATE → dollarRate en el párrafo de USD
$content = $content.Replace("DOLLAR_RATE", "dollarRate")

# 3. Costo Total: onChange → readOnly
$content = $content.Replace(
    "onChange={(e) => updateForm({ totalCost: Number(e.target.value) })}",
    "readOnly"
)

# 4. Agregar bloque de "Venta:" después del div de Ganancia real
$oldGanancia = '<div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ganancia real:</span>
                  <span className="font-medium text-green-600">${Number((form.totalCost * (form.margin - 1)).toFixed(2))} USD</span>
                </div>'
$newGanancia = '<div className="flex justify-between text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <span className="text-gray-700 font-medium">Venta:</span>
                  <span className="font-bold text-green-700">
                    ${form.finalPriceUSD.toFixed(2)} USD / ${form.finalPriceCLP.toLocaleString("es-CL")} CLP
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ganancia real:</span>
                  <span className="font-medium text-green-600">${Number((form.totalCost * (form.margin - 1)).toFixed(2))} USD</span>
                </div>'
$content = $content.Replace($oldGanancia, $newGanancia)

Set-Content $file -Value $content -NoNewline
Write-Host "Done"
