import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookieParser = require('cookie-parser');
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Serve uploaded product images statically
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  const port = process.env.API_PORT || 3002;
  await app.listen(port, '0.0.0.0', () => {
    console.log(`✅ API running on http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start API:', error);
  process.exit(1);
});
