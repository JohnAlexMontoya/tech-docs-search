import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/** Configuración global compartida por main.ts y las pruebas e2e (misma app en ambos). */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}
