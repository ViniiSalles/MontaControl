import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../src/app.module';
import { configurarLimiteCorpo } from '../../src/common/limite-corpo';

/** Sobe a aplicação completa (guards, pipes, filtro de exceção reais) contra o MontaControlDev. */
export async function criarApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configurarLimiteCorpo(app);
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}
