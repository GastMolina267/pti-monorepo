/**
 * Datos del sitio que el equipo tiene que mantener a mano.
 *
 * `contactEmail` es un marcador: reemplazalo por la casilla real del equipo antes
 * de publicar la landing (el formulario de Instituciones abre el cliente de correo
 * con ese destinatario).
 */
export const SITE = {
  contactEmail: 'contacto@vitalia.example',
  repoUrl: 'https://github.com/GastMolina267/pti-monorepo',
  university: 'Universidad Blas Pascal',
  career: 'Ingeniería Informática',
  year: 2026,
  team: [
    { name: 'Facundo Gomez Geneiro', role: 'Hardware, firmware IoMT y red' },
    { name: 'Gastón Molina', role: 'Backend del gateway: API, base y broker MQTT' },
    { name: 'Tomás Molina', role: 'Interfaces: consola, llamador y portal del paciente' },
  ],
  tutor: 'Oscar Luis Gencarelli',
} as const;

/** Fuente citable de una cifra que aparece en la landing. */
export interface Source {
  readonly id: string;
  readonly label: string;
  readonly url: string;
}

/** Fuentes externas usadas en la página de Instituciones (consultadas el 25/10/2026). */
export const SOURCES = {
  refes: {
    id: 'refes',
    label: 'REFES 2023, Ministerio de Salud de la Nación, citado por CAMARCO',
    url: 'https://www.camarco.org.ar/wp-content/uploads/2023/07/03-Salud.pdf',
  },
  guardias: {
    id: 'guardias',
    label: 'Encuesta Adecra+Cedim (28 instituciones), Los Andes, 7/10/2024',
    url: 'https://www.losandes.com.ar/sociedad/guardias-saturadas-en-mendoza-el-85-de-las-consultas-que-se-atienden-en-clinicas-privadas-no-son-urgencias/',
  },
  iomt: {
    id: 'iomt',
    label: 'Latin America IoT in Healthcare Market, Towards Healthcare',
    url: 'https://www.towardshealthcare.com/outlook/latin-america-iot-in-healthcare-market',
  },
  pricing: {
    id: 'pricing',
    label: 'Remote Patient Monitoring Pricing Models, HealthArc',
    url: 'https://healtharc.io/blogs/remote-patient-monitoring-pricing-structure-and-models-for-healthcare-providers/',
  },
  validation: {
    id: 'validation',
    label: 'Validación de rendimiento del 25/10/2026 (docs/10-validacion.md)',
    url: 'https://github.com/GastMolina267/pti-monorepo/blob/main/docs/10-validacion.md',
  },
} as const satisfies Record<string, Source>;
