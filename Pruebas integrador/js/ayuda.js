// Mesa de ayuda: lista de casos con filtros y una ventana por caso.
// Cada usuario ve los suyos; el personal (soporte, administrador, desarrollador) ve todos,
// los atiende y los cierra escribiendo la respuesta en la ventana. Los casos nuevos se abren desde el chatbot.
import { $, esc, fecha, reportar } from './util.js';
import { estado, esStaff } from './estado.js';

const ESTADO_CASO = { abierto: 'Abierto', en_proceso: 'En proceso', cerrado: 'Cerrado' };
const URGENCIA = { alta: 'Alta', media: 'Media', baja: 'Baja' };
export const plazoTexto = u => ({ alta: 'el mismo día', media: 'en 24 horas', baja: 'en 48 horas' }[u]);

let lista = [];

// Plazos de la gobernanza: alta = el mismo día, media = 24 h, baja = 48 h.
function vence(c) {
  const f = new Date(c.creado_en);
  if (c.urgencia === 'alta') return new Date(f.getFullYear(), f.getMonth(), f.getDate(), 23, 59, 59);
  return new Date(f.getTime() + (c.urgencia === 'media' ? 24 : 48) * 3600 * 1000);
}
const estaVencido = c => c.estado !== 'cerrado' && new Date() > vence(c);

// Registra un caso en la tabla "casos". Lo usa el chatbot.
export async function abrirCaso({ tipo, urgencia, asunto, descripcion, origen = 'chatbot', conversacion = null }) {
  const { data, error } = await estado.sb.from('casos')
    .insert({ tipo, urgencia, asunto, descripcion, origen, conversacion }).select('id').single();
  return { id: data ? data.id : null, error };
}

export async function cargarCasos() {
  const { data, error } = await estado.sb.from('casos').select('*').order('id', { ascending: false }).limit(50);
  reportar('los casos', error);
  if (data) { lista = data; pintarCasos(); }
}

function pintarCasos() {
  const abiertos = lista.filter(c => c.estado !== 'cerrado').length;
  const vencidos = lista.filter(estaVencido).length;
  $('#casosTitulo').firstChild.textContent = esStaff() ? 'Casos de la mesa de ayuda ' : 'Mis casos ';
  $('#casosAbiertos').innerHTML = esStaff()
    ? `(${abiertos} abiertos${vencidos ? ` · <span class="vencidos">${vencidos} vencido${vencidos > 1 ? 's' : ''}</span>` : ''})`
    : '';

  const fe = $('#fEstado').value, fu = $('#fUrg').value;
  const filas = lista.filter(c =>
    (!fe || (fe === 'vencido' ? estaVencido(c) : c.estado === fe)) && (!fu || c.urgencia === fu));

  $('#casos').innerHTML = filas.length ? filas.map(c => {
    const vencido = estaVencido(c);
    const plazo = c.estado === 'cerrado' ? 'Cerrado ' + fecha(c.cerrado_en) : vencido ? 'Vencido' : 'Hasta ' + fecha(vence(c));
    const resp = c.respuesta ? (c.respuesta.length > 40 ? c.respuesta.slice(0, 40) + '…' : c.respuesta) : '—';
    return `<tr class="${vencido ? 'vencido' : ''}"><td class="num">${esc(c.id)}</td><td>${esc(c.asunto)}</td>
      <td>${esc(URGENCIA[c.urgencia])}</td><td><span class="pill ${esc(c.estado)}">${esc(ESTADO_CASO[c.estado])}</span></td>
      <td>${esc(plazo)}</td><td>${esc(resp)}</td>
      <td><button class="btn sec sm" data-abrir="${esc(c.id)}">${esStaff() && c.estado !== 'cerrado' ? 'Atender' : 'Ver'}</button></td></tr>`;
  }).join('') : `<tr><td colspan="7">${lista.length ? 'Ningún caso coincide con los filtros.' : 'Aún no hay casos.'}</td></tr>`;
}

// ---- Ventana de un caso ----
let abierto = null;

function abrirVentana(id) {
  const c = lista.find(x => String(x.id) === String(id));
  if (!c) return;
  abierto = c;
  $('#dlgTitulo').textContent = `Caso #${c.id} · ${c.asunto}`;
  $('#dlgDatos').innerHTML = [
    ['Estado', ESTADO_CASO[c.estado]], ['Urgencia', URGENCIA[c.urgencia]], ['Tipo', c.tipo || '—'],
    ['Abierto', fecha(c.creado_en)],
    [c.estado === 'cerrado' ? 'Cerrado' : 'Plazo', c.estado === 'cerrado' ? fecha(c.cerrado_en) : fecha(vence(c)) + (estaVencido(c) ? ' (vencido)' : '')],
  ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  $('#dlgDesc').textContent = c.descripcion || '—';
  $('#dlgConvBox').hidden = !c.conversacion;
  $('#dlgConv').textContent = c.conversacion || '';
  const atendible = esStaff() && c.estado !== 'cerrado';
  $('#dlgRespBox').hidden = atendible;           // si se puede atender, se muestra el formulario en su lugar
  $('#dlgResp').textContent = c.respuesta || (c.estado === 'cerrado' ? '—' : 'Aún no hay respuesta. Te responderán dentro del plazo.');
  $('#dlgForm').hidden = !atendible;
  $('#dlgAtender').hidden = c.estado !== 'abierto';
  $('#dlgTexto').value = '';
  $('#dlgMsg').textContent = '';
  $('#dlgCaso').showModal();
}

export function conectarAyuda(alCambiar) {
  $('#fEstado').addEventListener('change', pintarCasos);
  $('#fUrg').addEventListener('change', pintarCasos);
  $('#casos').addEventListener('click', e => { if (e.target.dataset.abrir) abrirVentana(e.target.dataset.abrir); });
  $('#dlgCerrar').addEventListener('click', () => $('#dlgCaso').close());

  $('#dlgAtender').addEventListener('click', async () => {
    const { error } = await estado.sb.from('casos').update({ estado: 'en_proceso', responsable_id: estado.user.id }).eq('id', abierto.id);
    if (error) { $('#dlgMsg').textContent = 'No se pudo marcar el caso. Intenta de nuevo.'; return; }
    $('#dlgCaso').close();
    alCambiar();
  });

  $('#dlgForm').addEventListener('submit', async e => {
    e.preventDefault();
    const respuesta = $('#dlgTexto').value.trim();
    if (!respuesta) { $('#dlgMsg').textContent = 'Escribe la respuesta para el usuario antes de cerrar el caso.'; return; }
    const { error } = await estado.sb.from('casos')
      .update({ estado: 'cerrado', respuesta, cerrado_en: new Date().toISOString() }).eq('id', abierto.id);
    if (error) { $('#dlgMsg').textContent = 'No se pudo cerrar el caso. Intenta de nuevo.'; return; }
    $('#dlgCaso').close();
    alCambiar();
  });
}
