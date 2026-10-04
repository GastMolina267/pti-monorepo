import { ValidationPipe } from '@nestjs/common';

/**
 * ValidationPipe global: descarta y rechaza propiedades no declaradas en el DTO y
 * transforma tipos. Los mensajes por campo se definen en español en cada DTO.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    validationError: { target: false, value: false },
  });
}
