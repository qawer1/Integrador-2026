// Semáforo del clúster y cola de simulaciones.
import { ESTADOS, COL_SOLICITANTE } from './config.js';
import { $, esc, nombreMetodo, reportar } from './util.js';
import { estado } from './estado.js';

export async function cargarCola() {
  const columnas = 'id,metodo,estado,creada_en' + (COL_SOLICITANTE ? ',' + COL_SOLICITANTE : '');
  const { data, error } = await estado.sb.from('solicitudes').select(columnas).order('id', { ascending: false }).limit(10);
  reportar('la cola', error);
  if (data) pintarCola(data);
}

// Se puede cancelar lo que está en fila o en ejecución.
// El administrador cancela cualquiera; cada quien, la suya (si se configuró COL_SOLICITANTE).
const CANCELABLES = ['pendiente', 'en_ejecucion'];
const puedeCancelar = s => CANCELABLES.includes(s.estado) &&
  (estado.perfil.rol === 'administrador' || (COL_SOLICITANTE && s[COL_SOLICITANTE] === estado.user.id));

function pintarCola(lista) {
  const ejecutando = lista.find(s => s.estado === 'en_ejecucion');
  const enFila = lista.filter(s => s.estado === 'pendiente').length;
  const luz = $('#luz');
  if (ejecutando) {
    luz.classList.add('ocupado');
    $('#estadoTxt').textContent = `Hay una simulación en ejecución (${nombreMetodo(ejecutando.metodo)}). ${enFila ? enFila + ' en fila, por favor espera.' : 'Nadie más está en fila.'}`;
  } else if (enFila) {
    luz.classList.add('ocupado');
    $('#estadoTxt').textContent = `Hay ${enFila} solicitud${enFila > 1 ? 'es' : ''} en fila. Se ejecutarán en orden.`;
  } else {
    luz.classList.remove('ocupado');
    $('#estadoTxt').textContent = 'Clúster libre: puedes solicitar una simulación.';
  }
  $('#cola').innerHTML = lista.length
    ? lista.map(s => `<tr>
        <td class="num">${esc(s.id)}</td><td>${esc(nombreMetodo(s.metodo))}</td>
        <td><span class="pill ${esc(s.estado)}">${esc(ESTADOS[s.estado] || s.estado)}</span></td>
        <td>${puedeCancelar(s) ? `<button class="btn sec sm" data-cancelar="${esc(s.id)}">Cancelar</button>` : ''}</td>
      </tr>`).join('')
    : '<tr><td colspan="4">No hay solicitudes todavía.</td></tr>';
}

// Botón "Cancelar" (administrador: cualquiera; los demás: solo la suya).
export function conectarCancelar(alCambiar) {
  $('#cola').addEventListener('click', async e => {
    const id = e.target.dataset.cancelar;
    if (!id) return;
    const corriendo = !!e.target.closest('tr').querySelector('.pill.en_ejecucion');
    const pregunta = corriendo
      ? `La solicitud #${id} ya está en ejecución. ¿Marcarla como cancelada y liberar la cola?`
      : `¿Cancelar la solicitud #${id}?`;
    if (!confirm(pregunta)) return;
    // .in('estado', ...) evita pisar una solicitud que terminó justo ahora; .select() devuelve las filas
    // cambiadas (con RLS, un UPDATE no permitido no da error: simplemente no cambia nada).
    const { data, error } = await estado.sb.from('solicitudes')
      .update({ estado: 'cancelada' }).eq('id', id).in('estado', CANCELABLES).select('id');
    if (error || !data || !data.length) alert('No se pudo cancelar: la solicitud ya terminó o tu rol no lo permite.');
    alCambiar();
  });
}