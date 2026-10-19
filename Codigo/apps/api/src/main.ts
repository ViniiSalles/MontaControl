import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { configurarProxyConfiavel } from './common/ip-cliente';
import { configurarLimiteCorpo } from './common/limite-corpo';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  configurarProxyConfiavel(app, config.get<number>('TRUST_PROXY_HOPS', 0));
  configurarLimiteCorpo(app);
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
