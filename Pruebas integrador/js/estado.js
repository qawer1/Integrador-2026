// Estado compartido: el cliente de Supabase y el perfil de quien inició sesión.
export const estado = { sb: null, user: null, perfil: { rol: 'usuario' } };

// Cada rol ve las pestañas que le sirven.
//  - administrador: todo.
//  - usuario: simula, consulta SU historial y abre casos.
//  - soporte: atiende casos y puede simular para reproducir los problemas que reportan los usuarios.
// OJO: esto solo cambia lo que se muestra. Quién puede simular y quién ve qué filas lo decide la base de datos (Supabase).
export const VISTAS_POR_ROL = {
  administrador: ['simular', 'historial', 'ayuda'],
  usuario: ['simular', 'historial', 'ayuda'],
  soporte: ['simular', 'historial', 'ayuda'],
};
export const vistasDelRol = () => VISTAS_POR_ROL[estado.perfil.rol] || ['historial', 'ayuda'];
export const puedeVer = vista => vistasDelRol().includes(vista);

// Quienes pueden pedir simulaciones.
export const puedeSimular = () => puedeVer('simular');

// Quienes atienden los casos de la mesa de ayuda: administrador y soporte.
export const esStaff = () => ['administrador', 'soporte'].includes(estado.perfil.rol);