// Pestañas: cada rol ve solo las suyas y entra directo a la primera.
import { $ } from './util.js';
import { vistasDelRol, puedeVer } from './estado.js';

export function mostrarVista(nombre) {
  if (!puedeVer(nombre)) return;
  document.querySelectorAll('.vista').forEach(v => { v.hidden = v.id !== 'v-' + nombre; });
  document.querySelectorAll('.tab').forEach(t => {
    const activa = t.dataset.vista === nombre;
    t.classList.toggle('activa', activa);
    t.setAttribute('aria-current', activa ? 'page' : 'false');
  });
}

export function conectarVistas() {
  const mias = vistasDelRol();
  document.querySelectorAll('.tab').forEach(t => { t.hidden = !mias.includes(t.dataset.vista); });
  $('#tabs').hidden = mias.length < 2; // con una sola vista no hacen falta pestañas
  $('#tabs').addEventListener('click', e => {
    if (e.target.dataset.vista) mostrarVista(e.target.dataset.vista);
  });
  mostrarVista(mias[0]);
}
