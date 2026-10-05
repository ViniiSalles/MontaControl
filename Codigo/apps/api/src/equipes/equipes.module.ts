import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { EquipesController } from './equipes.controller';
import { EquipesRepository } from './equipes.repository';
import { EquipesService } from './equipes.service';

@Module({
  imports: [PrismaModule, UsuariosModule],
  controllers: [EquipesController],
  providers: [EquipesService, EquipesRepository],
})
export class EquipesModule {}
