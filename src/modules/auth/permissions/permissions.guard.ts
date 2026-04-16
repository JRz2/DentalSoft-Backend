import { CanActivate, ExecutionContext, Injectable, } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from './auth.permissions.enum';
import { rolePermissions } from '../roles-permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<Permission[]>(
      'permissions',
      context.getHandler(),
    );

    if (!requiredPermissions) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const userPermissions = rolePermissions[user.role] || [];

    return requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
  }
}