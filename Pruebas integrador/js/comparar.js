// Comparación de métodos en el Historial: barras con el tiempo de Trapecio, Simpson, Monte Carlo
// y Newton-Raphson. Solo compara ejecuciones del MISMO modo, del MISMO n y del MISMO rango de años
// (si no, no es comparable).
// El panel se crea desde aquí, debajo del título "Ejecuciones registradas"; no necesita cambios en index.html.
import { METODOS, etiquetaModo } from './config.js';
import { $, esc } from './util.js';

const num = v => (v == null || v === '' ? null : Number(v));
const nDe = r => num(r.n) ?? num(r.parametros && r.parametros.n);
const miles = v => v.toLocaleString('es-CO');
// Rango de años que analizó la ejecución (columnas anos_desde / anos_hasta); si no hay, "Sin rango".
const anosDe = r => (r.anos_desde != null ? `${r.anos_desde}–${r.anos_hasta}` : 'Sin rango');

// Qué tiempo se compara. Por defecto el cómputo: el total lo domina la lectura del dataset por NFS.
const METRICAS = {
  computo: { nombre: 'Tiempo de cómputo', de: r => num(r.tiempo_s) },
  total: { nombre: 'Tiempo total', de: r => num(r.tiempo_total_s) ?? num(r.tiempo_segundos) },
  lectura: { nombre: 'Tiempo de lectura de datos', de: r => num(r.tiempo_lectura_s) },
};
const COLORES = { trapecio: '#f2b600', simpson: '#1b2a38', montecarlo: '#2f7d5b', newton_raphson: '#8a4fb3' };

let datos = [];        // ejecuciones con método, modo y n conocidos
let grafica = null;
let montado = false;
let tocado = false;    // si la persona ya eligió modo o n, no se los cambiamos al refrescar

function montar() {
  const sec = document.createElement('section');
  sec.id = 'comparar';
  sec.innerHTML = `
    <h3>Comparación de métodos</h3>
    <div class="filtros">
      <div><label for="cmpModo">Modo</label><select id="cmpModo"></select></div>
      <div><label for="cmpN">n</label><select id="cmpN"></select></div>
      <div><label for="cmpAnos">Años</label><select id="cmpAnos"></select></div>
      <div><label for="cmpMetrica">Tiempo a comparar</label><select id="cmpMetrica">
        <option value="computo">Solo cómputo</option><option value="total">Total</option><option value="lectura">Lectura de datos</option></select></div>
    </div>
    <div class="grafica" id="cmpCaja"><canvas id="cmpGrafica" aria-label="Tiempo de ejecución por método numérico"></canvas></div>
    <p class="nota" id="cmpNota"></p>`;
  $('#listaEjec').querySelector('h2').after(sec);
  ['#cmpModo', '#cmpN', '#cmpAnos'].forEach(s => $(s).addEventListener('change', () => { tocado = true; dibujar(); }));
  $('#cmpMetrica').addEventListener('change', dibujar);
  montado = true;
}

// La combinación (modo, n, años) con más métodos distintos; si empatan, la más reciente.
function mejorCombinacion() {
  const c = {};
  datos.forEach(r => {
    const k = `${r.nodos}|${nDe(r)}|${anosDe(r)}`;
    const x = (c[k] ??= { modo: String(r.nodos), n: String(nDe(r)), anos: anosDe(r), metodos: new Set(), id: 0 });
    x.metodos.add(r.metodo);
    x.id = Math.max(x.id, Number(r.id) || 0);
  });
  return Object.values(c).sort((a, b) => b.metodos.size - a.metodos.size || b.id - a.id)[0] || null;
}

function llenarSelects() {
  const mejor = mejorCombinacion();
  const selModo = $('#cmpModo'), selN = $('#cmpN'), selAnos = $('#cmpAnos');
  const modos = [...new Set(datos.map(r => String(r.nodos)))].sort((a, b) => a - b);
  const ns = [...new Set(datos.map(r => String(nDe(r))))].sort((a, b) => a - b);
  const anosLista = [...new Set(datos.map(anosDe))].sort();
  const modoAntes = selModo.value, nAntes = selN.value, anosAntes = selAnos.value;
  selModo.innerHTML = modos.map(m => `<option value="${esc(m)}">${esc(etiquetaModo(m))}</option>`).join('');
  selN.innerHTML = ns.map(n => `<option value="${esc(n)}">${esc(miles(Number(n)))}</option>`).join('');
  selAnos.innerHTML = anosLista.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  const modoOk = tocado && modos.includes(modoAntes), nOk = tocado && ns.includes(nAntes), anosOk = tocado && anosLista.includes(anosAntes);
  selModo.value = modoOk ? modoAntes : (mejor ? mejor.modo : '');
  selN.value = nOk ? nAntes : (mejor ? mejor.n : '');
  selAnos.value = anosOk ? anosAntes : (mejor ? mejor.anos : '');
}

function dibujar() {
  const m = METRICAS[$('#cmpMetrica').value] || METRICAS.computo;
  const modo = $('#cmpModo').value, n = Number($('#cmpN').value), anos = $('#cmpAnos').value;
  const g = {};
  datos.filter(r => String(r.nodos) === modo && nDe(r) === n && anosDe(r) === anos).forEach(r => {
    const t = m.de(r);
    if (t != null) (g[r.metodo] ??= []).push(t);
  });
  const claves = Object.keys(METODOS);
  const prom = claves.map(k => (g[k] ? g[k].reduce((a, b) => a + b, 0) / g[k].length : null));
  const hay = prom.some(v => v != null);

  $('#cmpCaja').hidden = !hay;
  if (!hay) {
    if (grafica) { grafica.destroy(); grafica = null; }
    $('#cmpNota').textContent = datos.length
      ? 'No hay tiempos de este tipo para ese modo, ese n y esos años.'
      : 'Aún no hay ejecuciones con n registrado para comparar.';
    return;
  }

  const etiquetas = claves.map(k => METODOS[k]);
  const colores = claves.map(k => COLORES[k] || '#1b2a38');
  if (grafica) {
    grafica.data.labels = etiquetas;
    grafica.data.datasets[0].data = prom;
    grafica.data.datasets[0].label = m.nombre + ' promedio (s)';
    grafica.update('none');
  } else {
    grafica = new Chart($('#cmpGrafica'), {
      type: 'bar',
      data: { labels: etiquetas, datasets: [{ label: m.nombre + ' promedio (s)', data: prom, backgroundColor: colores }] },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Segundos' } } },
      },
    });
  }

  const faltan = claves.filter((k, i) => prom[i] == null).map(k => METODOS[k]);
  const masRapido = claves.filter((k, i) => prom[i] != null).sort((a, b) => prom[claves.indexOf(a)] - prom[claves.indexOf(b)])[0];
  $('#cmpNota').textContent =
    `${m.nombre} promedio, ${etiquetaModo(modo)}, n = ${miles(n)}, años ${anos}. Menor tiempo: ${METODOS[masRapido]}.` +
    (faltan.length ? ` Falta ejecutar con este modo, este n y estos años: ${faltan.join(', ')}.` : '');
}

export function pintarComparacion(ejecuciones) {
  if (!$('#listaEjec')) return;
  if (!montado) montar();
  datos = ejecuciones.filter(r => r.metodo && r.nodos != null && nDe(r) != null);
  llenarSelects();
  dibujar();
}