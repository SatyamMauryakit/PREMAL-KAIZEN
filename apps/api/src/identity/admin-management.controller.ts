import { Controller, Get, Put, Param, Query, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PermissionGuard } from '../common/rbac/permission.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { isAdminRole } from '../common/rbac/permissions';

/**
 * Admin/staff management: list administrators, change their granular role,
 * activate/deactivate accounts, and view per-admin action history. Every
 * route here requires admins:manage, which only SUPER_ADMIN holds - this is
 * the controller-level enforcement of "only a Super Admin manages admins".
 */
@UseGuards(AuthGuard, AdminGuard, PermissionGuard)
@RequirePermission('admins:manage')
@Controller('api/admin/admins')
export class AdminManagementController {
  constructor(private identityService: IdentityService) {}

  @Get()
  async list() {
    return this.identityService.listAdmins();
  }

  @Put(':id/role')
  async changeRole(@Param('id') id: string, @Body() body: { adminRole: string }, @Req() req: any) {
    if (!body.adminRole || !isAdminRole(body.adminRole)) {
      throw new BadRequestException('A valid adminRole is required');
    }
    return this.identityService.changeAdminRole(id, body.adminRole, {
      id: req.user.id,
      email: req.user.email,
      adminRole: req.user.adminRole,
    });
  }

  @Put(':id/status')
  async setStatus(@Param('id') id: string, @Body() body: { isActive: boolean }, @Req() req: any) {
    if (body.isActive === undefined) {
      throw new BadRequestException('isActive is required');
    }
    return this.identityService.setAdminStatus(id, body.isActive, {
      id: req.user.id,
      email: req.user.email,
      adminRole: req.user.adminRole,
    });
  }

  @Get(':id/activity')
  async activity(@Param('id') id: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.identityService.getAdminActivity(id, limit ? parseInt(limit) : undefined, offset ? parseInt(offset) : undefined);
  }
}
