import { SOURCES, type Source } from '../../core/site';
import type { FaqItem } from '../../shared/faq';
import type { FactViz } from './fact-viz';

/** Copy de la página para instituciones e inversores (B2B). */

export interface MarketFact {
  readonly value: string;
  readonly label: string;
  readonly source: Source;
  /** Gráfico chico con los mismos datos de la fuente. */
  readonly viz: FactViz;
}

export const MARKET_FACTS: readonly MarketFact[] = [
  {
    value: '6.729',
    label:
      'establecimientos con internación en la Argentina: 1.743 públicos y 4.986 privados, con 236.183 camas.',
    source: SOURCES.refes,
    viz: {
      kind: 'split',
      parts: [
        { label: 'Públicos', value: 1743 },
        { label: 'Privados', value: 4986 },
      ],
    },
  },
  {
    value: '84,5 %',
    label:
      'de las consultas en guardias de clínicas y sanatorios privados podría resolverse en consultorio u otros canales.',
    source: SOURCES.guardias,
    viz: {
      kind: 'share',
      value: 84.5,
      label: '84,5 % podría resolverse en otro canal',
      rest: '15,5 % de riesgo medio o alto',
    },
  },
  {
    value: 'US$ 4.200 M',
    label:
      'mercado de IoT en salud en América Latina en 2025, con un crecimiento estimado del 23,1 % anual hasta 2035.',
    source: SOURCES.iomt,
    viz: {
      kind: 'growth',
      from: { year: 2025, value: 4.2, label: 'US$ 4.200 M' },
      to: { year: 2035, value: 33.56, label: 'US$ 33.560 M' },
      cagr: 0.231,
    },
  },
];

export interface RevenueStream {
  readonly name: string;
  readonly how: string;
  readonly includes: string;
  readonly reference: string;
  readonly status: 'base' | 'roadmap';
}

export const REVENUE_STREAMS: readonly RevenueStream[] = [
  {
    name: 'Abono por pulsera activa',
    how: 'Mensual, por cada pulsera en uso',
    includes:
      'Software de la consola, el llamador, el portal y la app del paciente (en desarrollo), actualizaciones, soporte y reposición de pulseras.',
    reference: 'Licencias de monitoreo remoto: US$ 10 a 40 por paciente y mes.',
    status: 'base',
  },
  {
    name: 'Implementación por sede',
    how: 'Pago único al instalar',
    includes:
      'Gateway configurado, integración con la red del hospital, carga de servicios y capacitación del personal.',
    reference: 'Implementación y capacitación: US$ 1.000 a 10.000.',
    status: 'base',
  },
  {
    name: 'Pulseras en comodato o venta',
    how: 'Incluidas en el abono o compradas',
    includes: 'Hardware de componentes de mercado (ESP32-C3) con firmware propio y cifrado desde el origen.',
    reference: 'Dispositivos de monitoreo básicos: US$ 30 a 100.',
    status: 'base',
  },
  {
    name: 'Servicios para redes de salud',
    how: 'Mensual, por sede adicional',
    includes:
      'Réplica multisede en la nube, reportes PDF con la curva biométrica y soporte con acuerdo de nivel de servicio.',
    reference: 'Se cotiza por red: forma parte de la hoja de ruta.',
    status: 'roadmap',
  },
];

export const SUSTAINABILITY = [
  {
    icon: 'server',
    title: 'Corre dentro del hospital',
    body: 'Con 50 pulseras se generan unas 1,4 millones de lecturas por día. Se procesan en el gateway local, así que no hay costo de nube por lectura ni dependencia de la conexión.',
  },
  {
    icon: 'layers',
    title: 'Un mismo producto para cada sede',
    body: 'Sumar un hospital es instalar un gateway y aprovisionar sus pulseras con scripts reproducibles. El software no se reescribe por cliente.',
  },
  {
    icon: 'trend',
    title: 'El ingreso crece con el uso',
    body: 'El abono depende de las pulseras activas: si el hospital amplía la sala o suma servicios, el ingreso sube sin una venta nueva.',
  },
  {
    icon: 'tool',
    title: 'Hardware barato y reemplazable',
    body: 'La pulsera usa componentes de mercado. Si una se rompe, se repone dentro del abono y el hospital no frena.',
  },
] as const;

export interface Measurement {
  readonly metric: string;
  readonly target: string;
  readonly measured: string;
  /** Parte del objetivo que se usó (medido ÷ objetivo), para la barra. Sin barra si no aplica. */
  readonly budget?: number;
}

/** Resultados reales de `pnpm perf:load` / `perf:stress` (25/10/2026, 2 vCPU). */
export const MEASUREMENTS: readonly Measurement[] = [
  {
    metric: 'Pérdida de lecturas con 50 pulseras cada 3 s',
    target: '0 %',
    measured: '0 % (10.043 de 10.043)',
  },
  {
    metric: 'Caída detectada → alerta en la consola',
    target: '< 500 ms',
    measured: '6 ms (p95)',
    budget: 6 / 500,
  },
  { metric: 'Lectura de la pulsera → consola', target: '< 500 ms', measured: '7 ms (p95)', budget: 7 / 500 },
  { metric: 'Llamado → TV de la sala', target: '< 100 ms', measured: '13 ms (p95)', budget: 13 / 100 },
  {
    metric: 'Fila de turnos por API bajo carga',
    target: '< 50 ms',
    measured: '8,7 ms (p95)',
    budget: 8.7 / 50,
  },
  { metric: 'Consola con 10.000 turnos del día', target: '< 2 s', measured: '1,6 s', budget: 1.6 / 2 },
];

export interface RoadmapStep {
  readonly title: string;
  readonly body: string;
  /** `done`: terminado · `now`: en desarrollo · `next`: lo que sigue. */
  readonly state: 'done' | 'now' | 'next';
}

export const ROADMAP: readonly RoadmapStep[] = [
  {
    title: 'Prototipo validado',
    body: 'Software completo, gateway en Docker y pruebas de carga con números. Es donde estamos hoy (octubre de 2026).',
    state: 'done',
  },
  {
    title: 'App del paciente',
    body: 'La estamos desarrollando: el turno y los llamados en una app instalable. Se suma al portal sin descargas, que sigue siendo la puerta de entrada para todos.',
    state: 'now',
  },
  {
    title: 'Piloto en un hospital',
    body: 'Instalación en una sala de espera real, con la prueba de 24 h sin internet y la pulsera definitiva.',
    state: 'next',
  },
  {
    title: 'Pulsera de producto',
    body: 'Carcasa, batería y calibración clínica de los sensores de pulso, oxígeno y temperatura.',
    state: 'next',
  },
  {
    title: 'Certificación e integración',
    body: 'Registro ante ANMAT e integración con la historia clínica electrónica (HL7/FHIR).',
    state: 'next',
  },
];

export const FAQ_INSTITUCIONES: readonly FaqItem[] = [
  {
    q: '¿Los pacientes tienen que descargar una app?',
    a: 'No para usar Vitalia: el portal se abre solo al conectarse al Wi-Fi, así nadie queda afuera por falta de espacio, datos o ganas de instalar algo. En paralelo estamos desarrollando la app del paciente, que suma una opción instalable sin reemplazar al portal.',
  },
  {
    q: '¿Qué infraestructura necesita el hospital?',
    a: 'Un router gestionado con las redes separadas (pacientes, personal, pulseras y TV) y un equipo chico con Docker para el gateway: una mini PC o una notebook alcanzan.',
  },
  {
    q: '¿Funciona si se corta internet?',
    a: 'Sí. Check-in, alertas, consola y llamados corren en el gateway. Lo que se replica a la nube queda en espera y se envía cuando vuelve la conexión.',
  },
  {
    q: '¿Cómo se protegen los datos de pacientes?',
    a: 'Cada lectura se cifra con AES-256-GCM en la pulsera, cada pulsera tiene su propia identidad y permisos en el broker, y a la nube sale solo lo mínimo, sin DNI (Ley 25.326).',
  },
  {
    q: '¿Está certificado como dispositivo médico?',
    a: 'Todavía no. Hoy es un prototipo académico validado. La certificación ANMAT es parte de la hoja de ruta y de lo que financia una inversión.',
  },
  {
    q: '¿Se integra con nuestra historia clínica?',
    a: 'Hoy no: usa sus propios turnos y pacientes. La integración HL7/FHIR está prevista para la etapa de producto.',
  },
  {
    q: '¿Cuántas pulseras soporta un gateway?',
    a: 'Se validó con 50 pulseras publicando cada 3 segundos durante 10 minutos, con 0 % de pérdida, en un equipo de 2 vCPU. El gateway real tiene más margen.',
  },
  {
    q: '¿Los precios de la calculadora son la tarifa?',
    a: 'No. Son supuestos editables dentro de rangos de referencia del mercado, para dimensionar el negocio. La tarifa se define con el piloto.',
  },
];
