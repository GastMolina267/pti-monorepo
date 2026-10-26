import type { FaqItem } from '../../shared/faq';
import type { JourneyStep } from './journey';

/** Copy de la página para personas (B2C). Voz Vitalia: calma, clara, con voseo. */

export const PROBLEMS = [
  {
    title: 'Horas sin saber cuánto falta',
    body: 'En la guardia nadie te dice cuántas personas tenés adelante, así que no te animás a moverte de la silla.',
  },
  {
    title: 'Un punto ciego clínico',
    body: 'Mientras esperás, nadie mira tu pulso ni tu oxígeno. Si te descompensás o te caés, se enteran cuando alguien lo ve.',
  },
  {
    title: 'Fila, llamados y prioridades en papel',
    body: 'Planillas, gritos de nombres y una prioridad que depende de quién está mirando la sala en ese momento.',
  },
] as const;

export const JOURNEY: readonly JourneyStep[] = [
  {
    title: 'Llegás y te conectás',
    body: 'Te sumás al Wi-Fi del hospital y se abre el portal. Hacés el check-in y recibís tu turno, con cuántas personas tenés antes. No hace falta instalar nada.',
  },
  {
    title: 'Te dan una pulsera',
    body: 'Mide tu pulso, el oxígeno en sangre y la temperatura cada 3 segundos, y reconoce si te caés: caída libre, golpe y quietud.',
  },
  {
    title: 'Tus datos no salen del hospital',
    body: 'Viajan cifrados con AES-256 hasta un equipo que está dentro del edificio. Si se corta internet, la sala sigue funcionando igual.',
  },
  {
    title: 'El equipo de salud te ve',
    body: 'La consola ordena la fila por prioridad clínica. Si un valor se vuelve crítico o te caés, suena una alerta en el momento, con tu turno y tu sala.',
  },
  {
    title: 'Te llaman, estés donde estés',
    body: 'Cuando es tu turno, aparece en la TV de la sala, en tu celular y en la pantalla de la pulsera, con el consultorio al que tenés que ir.',
  },
];

export const TAGLINE = ['Mientras esperás,', 'el hospital no te', 'pierde de vista.'] as const;

export const PROMISES = [
  {
    icon: 'shield',
    title: 'Tus datos, cifrados y en el hospital',
    body: 'Las lecturas de la pulsera viajan cifradas y se guardan en el servidor local. A la nube solo se replica lo mínimo, sin tu DNI (Ley 25.326).',
  },
  {
    icon: 'offline',
    title: 'Funciona sin internet',
    body: 'Todo corre en un gateway dentro del hospital. Un corte de internet no frena el check-in, las alertas ni los llamados.',
  },
  {
    icon: 'phone',
    title: 'Sin apps para descargar',
    body: 'El portal se abre solo al conectarte al Wi-Fi. La pulsera se entrega en la recepción y se devuelve al terminar.',
  },
  {
    icon: 'stethoscope',
    title: 'Ayuda al equipo, no lo reemplaza',
    body: 'La pulsera avisa cuando algo se sale de lo normal; quien decide es el personal de salud. Es un prototipo académico, no un dispositivo certificado.',
  },
] as const;

export const FAQ_PERSONAS: readonly FaqItem[] = [
  {
    q: '¿Tengo que instalar algo en el celular?',
    a: 'No. Al conectarte al Wi-Fi del hospital se abre un portal en el navegador. Ahí hacés el check-in y seguís tu turno.',
  },
  {
    q: '¿La pulsera me diagnostica?',
    a: 'No. Mide signos vitales y detecta caídas para que el personal se entere antes. El diagnóstico lo hace siempre un profesional.',
  },
  {
    q: '¿Quién ve mis datos?',
    a: 'Solo el personal del hospital, desde la consola. Los datos viajan cifrados y se guardan en un servidor del propio hospital.',
  },
  {
    q: '¿Qué pasa si se corta internet?',
    a: 'Nada cambia en la sala: el sistema corre en el hospital. Cuando vuelve la conexión, se envía a la nube lo que quedó pendiente.',
  },
  {
    q: '¿Qué pasa si me caigo en la sala de espera?',
    a: 'La pulsera reconoce la caída y la consola del personal muestra una alerta roja con sonido, tu turno y la sala donde estás.',
  },
  {
    q: '¿Ya se usa en algún hospital?',
    a: 'Todavía no. Vitalia es un Proyecto Tecnológico Integrador de la Universidad Blas Pascal (2026) y hoy está en etapa de prototipo validado.',
  },
];
