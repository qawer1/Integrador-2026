// Estado compartido: el cliente de Supabase y el perfil de quien inició sesión.
export const estado = { sb: null, user: null, perfil: { rol: 'usuario' } };

// Cada rol tiene su propia vista: solo ve las pestañas que le sirven.
//  - administrador y usuario: simulan, consultan el historial y abren casos.
//  - soporte: solo atiende casos (no necesita datos de las simulaciones).
export const VISTAS_POR_ROL = {
  administrador: ['simular', 'historial', 'ayuda'],
  usuario: ['simular', 'historial', 'ayuda'],
  soporte: ['ayuda'],
};
export const vistasDelRol = () => VISTAS_POR_ROL[estado.perfil.rol] || ['historial', 'ayuda'];
export const puedeVer = vista => vistasDelRol().includes(vista);

// Administrador y usuario pueden pedir simulaciones.
export const puedeSimular = () => puedeVer('simular');

// Quienes atienden los casos de la mesa de ayuda: administrador y soporte.
export const esStaff = () => ['administrador', 'soporte'].includes(estado.perfil.rol);
