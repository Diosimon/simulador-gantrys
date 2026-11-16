"""Prueba de estrés del simulador: corre cada escenario 30 min simulados y verifica que la
producción siga subiendo (si se queda igual = la lógica se trabó / deadlock).

Requisitos:  pip install playwright  &&  python -m playwright install chromium
Uso:         python herramientas/prueba_estres.py
"""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright

PAGE = (pathlib.Path(__file__).resolve().parent.parent / "simulador" / "index.html").as_uri()
ESCENARIOS = ["normal", "f1", "f2", "b1low", "slow", "pair"]

async def main():
    ok = True
    async with async_playwright() as p:
        kw = {}
        if len(sys.argv) > 1: kw["executable_path"] = sys.argv[1]   # ruta opcional a Chrome
        b = await p.chromium.launch(**kw)
        pg = await b.new_page()
        errores = []
        pg.on("pageerror", lambda e: errores.append(str(e)))
        await pg.goto(PAGE)
        for sc in ESCENARIOS:
            await pg.evaluate(f"__sim.init('{sc}')")
            hechos, b1min, b1raw, pals, dmax = [], 99, [], set(), 0
            for _ in range(6):
                for _ in range(30):                          # 5 min simulados, revisando cada 10 s
                    await pg.evaluate("__sim.run(10)")
                    g = await pg.evaluate("__sim.get()")
                    b1min = min(b1min, g["b1"]); pals.add(g["pal"]); dmax = max(dmax, g["desc"])
                st = await pg.evaluate("__sim.get()")
                hechos.append(st["done"]); b1raw.append(st["b1raw"])
            trabado = hechos[-1] == hechos[-2]
            # Bufer 1 siempre lleno: 15 pallets (14 solo durante un intercambio, con un pallet en la mano)
            b1mal = b1min < 14
            perdidos = len(pals) != 1                         # el total de pallets nunca cambia
            dmal = dmax > 1                                   # descarga: siempre un solo pallet
            av = st["alimVac"]; amal = av > 6                 # alimentación: G1 toma la pieza y deja el vacío en el mismo viaje
            ok &= not trabado and not b1mal and not perdidos and not dmal and not amal
            print(f"{sc:7s} piezas cada 5 min: {hechos}  piezas en B1: {b1raw}  "
                  f"pallets: {sorted(pals)}  "
                  f"{'<-- CAMBIO EL TOTAL DE PALLETS' if perdidos else ''}"
                  f"{'<-- DESCARGA CON 2 PALLETS ' if dmal else ''}"
                  f"alim. sin pallet máx {av}s {'<-- NO HIZO INTERCAMBIO EN ALIMENTACIÓN ' if amal else ''}"
                  f"{'<-- TRABADO' if trabado else ('<-- BUFER 1 PERDIO PALLETS (min %d)' % b1min if b1mal else 'OK')}")
            if trabado: print("        estado:", await pg.evaluate("__sim.dump()"))
        # Barrido: la línea no debe trabarse con 0–3 pallets en el Bufer 2 (en home son 4, ya probado arriba)
        for n in range(4):
            fila = []
            for sc in ["normal", "f1", "f2"]:
                await pg.fill("#nB2", str(n)); await pg.evaluate(f"__sim.init('{sc}')")
                h = []
                for _ in range(6):
                    await pg.evaluate("__sim.run(300)"); h.append((await pg.evaluate("__sim.get()"))["done"])
                trab = h[-1] == h[-2]; ok &= not trab
                fila.append(f"{sc}={h[-1]}{' <-- TRABADO' if trab else ''}")
            print(f"Bufer 2 con {n} pallets: " + "  ".join(fila))
        await pg.fill("#nB2", "4")
        if errores: ok = False; print("ERRORES JS:", errores)
        await b.close()
    sys.exit(0 if ok else 1)

asyncio.run(main())
