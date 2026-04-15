import 'reflect-metadata';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  });
  const config = app.get(ConfigService);
  const reflector = app.get(Reflector);
  const logger = new Logger('Bootstrap');
  const apiPrefix = config.get<string>('API_PREFIX', 'api/v1');
  const frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:5173');

  app.enableCors({
    origin: frontendUrl.split(',').map((origin) => origin.trim()),
    credentials: true
  });
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SETTE Log API')
    .setDescription('API corporativa para gestão de frotas, telemetria, rastreamento, compliance e BI.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true
    }
  });

  const port = config.get<number>('API_PORT', 3333);
  await app.listen(port);
  logger.log(`API running on http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger available on http://localhost:${port}/${apiPrefix}/docs`);
}

void bootstrap();
