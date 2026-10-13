// Inicio de sesión, cierre de sesión y perfil (rol) del usuario.
import { CFG } from './config.js';
import { $ } from './util.js';
import { estado } from './estado.js';

export function crearCliente() {
  if (CFG.url.startsWith('PEGA') || CFG.key.startsWith('PEGA')) {
    $('#loginMsg').textContent = 'Falta configurar la URL y la llave pública (anon) en js/config.js.';
    return false;
  }
  estado.sb = supabase.createClient(CFG.url, CFG.key); // "supabase" viene de la librería cargada en index.html
  return true;
}

export async function sesionActual() {
  const { data } = await estado.sb.auth.getSession();
  return data.session ? data.session.user : null;
}

export function conectarLogin(alEntrar) {
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('#loginMsg').textContent = '';
    const { data, error } = await estado.sb.auth.signInWithPassword({ email: $('#correo').value, password: $('#clave').value });
    if (error) {
      $('#loginMsg').textContent = 'No se pudo iniciar sesión. Revisa tu correo y tu contraseña.';
      return;
    }
    alEntrar(data.user);
  });
  $('#salir').addEventListener('click', async () => {
    await estado.sb.auth.signOut();
    location.reload();
  });
}

export async function cargarPerfil(user) {
  estado.user = user;
  const { data } = await estado.sb.from('perfiles').select('nombre,rol').eq('id', user.id).single();
  if (data) estado.perfil = data;
  $('#nombre').textContent = estado.perfil.nombre || user.email;
  $('#rol').textContent = estado.perfil.rol;
}
