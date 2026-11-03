import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookieParser = require('cookie-parser');
import { join } from 'path';
import { AppModule } from './app.module';
import { getAllowedOrigins, createCorsOriginValidator } from './common/config/cors';
import { requestLoggerMiddleware } from './common/logging/request-logger.middleware';

async function bootstrap() {
  // rawBody: true also exposes req.rawBody (the exact raw bytes) alongside the normal
  // parsed req.body - needed to verify the Razorpay webhook signature, which Razorpay
  // computes over the raw request bytes, not a re-serialized JSON object.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  app.use(cookieParser());
  app.use(requestLoggerMiddleware);

  // This is a JSON/REST API plus a static-image route, not an HTML app - Helmet's default
  // Content-Security-Policy is meant for HTML responses and provides no benefit here, so
  // it's left off rather than risk it interacting unexpectedly with anything later. The
  // other headers (X-Content-Type-Options, HSTS, X-Frame-Options, etc.) are all kept.
  // crossOriginResourcePolicy must be "cross-origin" - the storefront/admin apps load
  // product images from this API's /uploads/* route from a different origin, and
  // Helmet's default ("same-origin") would silently break every product image.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: createCorsOriginValidator(getAllowedOrigins()),
    credentials: true,
  });

  // Validates/transforms every request body. No DTO classes exist in this codebase yet
  // (every @Body() is typed as `any` or an inline object type, which TypeScript erases
  // at runtime) - class-validator's ValidationPipe only acts on real decorated classes,
  // so whitelist/transform are no-ops against every current route and this changes no
  // existing behavior. It's wired now so future endpoints get real validation for free
  // the moment they adopt a proper DTO class.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Serve uploaded product images statically
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Lets Nest's onModuleDestroy/beforeApplicationShutdown hooks (e.g. PrismaService
  // closing its connection) actually run on SIGTERM/SIGINT, instead of the process
  // being killed immediately - matters for a clean exit during a Kubernetes rolling
  // update, where every pod receives SIGTERM.
  app.enableShutdownHooks();

  const port = process.env.API_PORT || 3002;
  await app.listen(port, '0.0.0.0', () => {
    console.log(`✅ API running on http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start API:', error);
  process.exit(1);
});
