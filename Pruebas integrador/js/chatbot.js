// Asistente de la mesa de ayuda. Responde las dudas más comunes con reglas simples
// (sin inteligencia artificial) y, si no resuelve, abre un caso guardado en la base de datos.
import { $ } from './util.js';
import { abrirCaso, plazoTexto } from './ayuda.js';
import { puedeVer } from './estado.js';

const TEMAS = [
  { texto: 'No puedo iniciar sesión', tipo: 'incidente',
    respuesta: 'Revisa que tu correo y contraseña sean correctos. El registro público está cerrado: las cuentas las crea el administrador, así que si no tienes una, solicítala.' },
  { texto: 'No veo resultados', tipo: 'incidente', vista: 'historial',
    respuesta: 'El historial se actualiza solo cada 10 segundos. Si está vacío, puede que aún no se haya ejecutado ninguna simulación o que el filtro de método esté ocultando los datos: elige "Todos" y recarga la página.' },
  { texto: 'Mi solicitud no avanza', tipo: 'incidente', vista: 'simular',
    respuesta: 'El clúster ejecuta una simulación a la vez, en orden de llegada, y cada una dura máximo una hora. Mira el semáforo y la cola en la pestaña Simular: si hay una en ejecución, tu solicitud espera su turno.' },
  { texto: 'Otro problema', tipo: 'incidente', respuesta: null },
];

let historial = [];
let alCrear = () => {};

function decir(de, texto) {
  historial.push((de === 'bot' ? 'Asistente: ' : 'Usuario: ') + texto);
  const d = document.createElement('div');
  d.className = 'burbuja ' + de;
  d.textContent = texto;
  const caja = $('#chatMsgs');
  caja.appendChild(d);
  caja.scrollTop = caja.scrollHeight;
}

function opciones(lista) {
  const caja = $('#chatOpc');
  caja.replaceChildren();
  lista.forEach(([texto, accion]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn sec sm';
    b.textContent = texto;
    b.addEventListener('click', () => { decir('yo', texto); accion(); });
    caja.appendChild(b);
  });
}

function inicio() {
  historial = [];
  $('#chatMsgs').replaceChildren();
  decir('bot', 'Hola, soy el asistente de la mesa de ayuda. ¿Qué te pasa?');
  // Cada rol ve solo los temas que le corresponden (soporte, por ejemplo, no ve temas de simulaciones).
  const temas = TEMAS.filter(t => (!t.vista || puedeVer(t.vista)) && (!t.sinVista || !puedeVer(t.sinVista)));
  opciones(temas.map(t => [t.texto, () => responder(t)]));
}

function responder(t) {
  if (!t.respuesta) return pedirUrgencia(t);
  decir('bot', t.respuesta);
  decir('bot', '¿Esto resolvió tu duda?');
  opciones([
    ['Sí, gracias', () => { decir('bot', '¡Perfecto! Si necesitas algo más, aquí estoy.'); opciones([['Volver al inicio', inicio]]); }],
    ['No, quiero abrir un caso', () => pedirUrgencia(t)],
  ]);
}

function pedirUrgencia(t) {
  decir('bot', 'Voy a registrar un caso para que el equipo lo atienda. ¿Qué tan urgente es?');
  opciones([
    ['Alta: no puedo usar el clúster', () => pedirDetalle(t, 'alta')],
    ['Media: puedo seguir trabajando', () => pedirDetalle(t, 'media')],
    ['Baja: es una consulta', () => pedirDetalle(t, 'baja')],
  ]);
}

function pedirDetalle(t, urgencia) {
  decir('bot', 'Cuéntame en una frase qué ocurre.');
  const caja = $('#chatOpc');
  caja.replaceChildren();
  const f = document.createElement('form');
  const i = document.createElement('input');
  i.placeholder = 'Describe el problema';
  i.maxLength = 300;
  i.required = true;
  const b = document.createElement('button');
  b.className = 'btn sm';
  b.textContent = 'Enviar';
  f.append(i, b);
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const texto = i.value.trim();
    if (!texto) return;
    decir('yo', texto);
    caja.replaceChildren();
    await crearCaso(t, urgencia, texto);
  });
  caja.appendChild(f);
  i.focus();
}

async function crearCaso(t, urgencia, texto) {
  const { id, error } = await abrirCaso({
    tipo: t.tipo, urgencia, asunto: t.texto, descripcion: texto,
    origen: 'chatbot', conversacion: historial.join('\n'),
  });
  if (error) {
    decir('bot', 'No pude registrar el caso. Intenta de nuevo en unos minutos.');
  } else {
    decir('bot', `Listo: registré el caso #${id}. Te responderán ${plazoTexto(urgencia)}. Si no hay respuesta en ese plazo, se escala al otro integrante con acceso al clúster.`);
    alCrear();
  }
  opciones([['Volver al inicio', inicio]]);
}

export function conectarChat(alCrearCaso) {
  alCrear = alCrearCaso;
  // Botón flotante "Ayuda" (visible en todas las pestañas): abre o cierra el asistente.
  $('#chatBtn').addEventListener('click', () => {
    const panel = $('#chat');
    panel.hidden = !panel.hidden;
    if (!panel.hidden && !$('#chatMsgs').children.length) inicio();
  });
  // "Nuevo caso" (en la Mesa de ayuda): abre el asistente con una conversación limpia.
  $('#nuevoCaso').addEventListener('click', () => {
    $('#chat').hidden = false;
    inicio();
  });
  $('#chatCerrar').addEventListener('click', () => { $('#chat').hidden = true; });
}
