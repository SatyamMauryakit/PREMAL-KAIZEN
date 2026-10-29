import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.API_PORT || 3002;
  await app.listen(port, '0.0.0.0', () => {
    console.log(`✅ API running on http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start API:', error);
  process.exit(1);
});
