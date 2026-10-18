# 0017. Operar y recuperar el gateway con corridas identificables y respaldos verificables

- Estado: Aceptado
- Fecha: 2026-10-18
- Autores: Gastón Molina

## Contexto

El E2E de 4d acredita el recorrido funcional, pero una interrupción del proceso puede dejar turnos abiertos y una pulsera asignada. La demo necesita un ritmo observable y el equipo necesita verificar arranque, reinicios y recuperación con datos simulados. RF-O6 requiere persistencia local; RNF-O2 exige continuidad sin depender de servicios externos en ejecución.

## Decisión

- Reutilizar el recorrido Playwright de 4d para una demo con Chromium visible, acciones lentas y pausas explicadas en terminal. Sin duplicar reglas clínicas ni modificar contratos.
- Identificar cada corrida con UUID y marcador exacto en el motivo del turno. Escribir un diario local antes del primer check-in; recuperar IDs faltantes por una consulta de solo lectura a PostgreSQL y mutar únicamente mediante endpoints existentes, después de verificar pertenencia.
- Coordinar E2E, demo, recuperación y creación de respaldo mediante un bloqueo local exclusivo. Un bloqueo remanente requiere comprobar que su proceso terminó antes de retirarlo.
- Ofrecer `gateway:verify` como secuencia de checks sin reinicios y `gateway:operations` como prueba explícita que apaga/recrea el stack, reinicia el broker y exige persistencia y reconexión.
- Respaldar PostgreSQL y configuración local juntos, con hashes y manifiesto; ensayar la restauración en un contenedor sin red ni volumen compartido con la instalación. La restauración real queda como procedimiento operativo explícito.

## Alternativas consideradas

- Borrar la base o volver a sembrar en cada demo: elimina evidencia y puede alterar turnos ajenos.
- Limpiar por nombre del paciente o por cualquier motivo simulado: no distingue pertenencia a una corrida.
- Respaldar solo PostgreSQL: pierde las claves e identidades necesarias para continuar con los clientes.
- Probar la restauración sobre el gateway activo: reemplaza datos sin necesidad para validar un dump.

## Consecuencias

La demo y los checks se repiten conservando el historial. La recuperación es idempotente y acotada por UUID, también si se perdió una respuesta HTTP o cambió el día operativo. Los respaldos contienen secretos y requieren almacenamiento restringido; SHA-256 comprueba integridad, sin cifrar el bundle. Los procesos terminados abruptamente pueden dejar un bloqueo y un contenedor de restauración temporal que deben revisarse. Los fixtures antiguos de 4d no tienen diario y se revisan manualmente. Esta validación operativa local no acredita todavía WAN, carga prolongada, latencias ni dispositivos físicos.
