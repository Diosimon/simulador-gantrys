# Simulador · Línea de pallets con 2 gantrys

Simulador interactivo (vista isométrica) de una línea de pallets atendida por **2 gantrys con 2 grippers cada uno**:

**Bufer 1** (torre 5×3) → **Alimentación** → **Banco 1** → **Bufer 2** (torre 5×2) → **Banco 2** → **Descarga**

**Abrir en línea:** https://diosimon.github.io/simulador-gantrys/

## Qué muestra
- Cada movimiento de los gantrys (viaje en Y, brazo en X, sube/baja en Z) y la regla que lo decidió.
- La línea arranca "en home": 25 pallets (Bufer 1 lleno, 4 en el Bufer 2, uno en alimentación, en cada banco, en descarga y en un gripper de cada gantry).
- Todo es **intercambio**: en cada lugar un gripper saca y el otro deja.
- Escenarios: normal, falla de un banco, Bufer 1 casi vacío, descarga lenta.
- Ajustes en pantalla: tiempos (prueba, carga, descarga), velocidad de los gantrys, pallets en el Bufer 2 y sentido de la línea.
- Toca una posición para cambiar lo que tiene, o un banco para ponerlo en falla.

## Usarlo sin internet
Descarga `simulador/simulador_un_archivo.html` y ábrelo con doble clic (no necesita servidor).
Para trabajar en el código, abre `simulador/index.html` (scripts clásicos, sin compilar).

| Archivo | Qué tiene |
|---|---|
| `simulador/js/rules.js` | Lógica de decisión de G1 y G2 |
| `simulador/js/motion.js` | Movimientos en L / vertical |
| `simulador/js/world.js` | Posiciones, pallets y escenarios |
| `simulador/js/config.js` | Tiempos y velocidades |
| `simulador/js/render.js` | Dibujo isométrico |
| `simulador/js/ui.js` | Controles de la pantalla |

## Prueba de estrés
Corre cada escenario 30 min simulados y revisa que la línea no se trabe, que no se pierdan pallets,
que descarga tenga siempre un solo pallet y que en alimentación siempre haya intercambio.

```bash
pip install playwright
python -m playwright install chromium
python herramientas/prueba_estres.py
```

## Publicación
GitHub Pages publica la rama `main` tal cual. El `index.html` de la raíz manda a `simulador/`. Cada cambio que se sube a `main` se publica solo.
