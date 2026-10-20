import { Controller, Get } from '@nestjs/common';
import type { DashboardDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

/** US08/US09 — visão da operação, exclusiva do gestor. */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Roles(Perfil.GESTOR)
  @Get()
  async obter(): Promise<DashboardDTO> {
    return this.dashboard.obter();
  }
}
