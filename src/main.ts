import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

   // Habilitar los Cors
  app.enableCors({
    origin: 'http://localhost:5173', // URL de tu frontend
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // validación global de las solicitudes entrantes utilizando ValidationPipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Elimina propiedades no definidas en los DTOs
    forbidNonWhitelisted: true, // Lanza un error si se envían propiedades no definidas
    transform: true, // Transforma los payloads a los tipos definidos en los DTOs
    transformOptions: {
        enableImplicitConversion: true // Permite la conversión implícita de tipos (por ejemplo, string a number)
    }, 
  }));

  // ✅ Configuración de Swagger (ANTES del setGlobalPrefix)
  const config = new DocumentBuilder()
    .setTitle('Proyecto Dent API')
    .setDescription(`
      API para la gestión de clínica odontológica.
      
      ## Características:
      - Autenticación JWT
      - Gestión de pacientes
      - Historia clínica
      - Tratamientos multisession
      - Agenda de citas
      
      ## Roles:
      - **ADMIN**: Acceso completo
      - **DOCTOR**: Gestión de pacientes, citas y tratamientos
    `)
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Ingrese su token JWT para autenticarse',
      in: 'header',
    }, 'JWT-Auth')
    .addTag('auth', 'Autenticación y usuarios')
    .addTag('patients', 'Gestión de pacientes')
    .addTag('clinical-history', 'Historia clínica')
    .addTag('treatments', 'Tratamientos odontológicos')
    .addTag('appointments', 'Citas y agenda')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // ✅ configuración de la UI de swagger en la ruta /docs (sin /api)
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { // ✅ CORREGIDO: swaggerOptions (no swaggerOprions)
      persistAuthorization: true, // Mantiene el token JWT en la UI de Swagger después de recargar la página
      docExpansion: 'none', // Colapsa las secciones de la documentación por defecto
      filter: true, // Habilita el filtro de búsqueda en la UI de Swagger
      showRequestDuration: true, // ✅ CORREGIDO: showRequestDuration (no showquestDuration)
    },
    customSiteTitle: 'Proyecto Dent API Documentation', // Título personalizado para la página de documentación
    customCss: '.swagger-ui .topbar { display: none }', // Personalización del estilo de la UI de Swagger
  });

  await app.listen(process.env.PORT ?? 3000);

  console.log(`🚀 Application running on: http://localhost:${process.env.PORT || 3000}`);
  console.log(`📚 API: http://localhost:${process.env.PORT || 3000}/api`);
  console.log(`📚 Swagger docs: http://localhost:${process.env.PORT || 3000}/docs`); // ✅ Corregido: /docs
}
bootstrap();