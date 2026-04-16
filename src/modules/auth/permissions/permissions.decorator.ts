import { SetMetadata } from '@nestjs/common';
import { Permission } from './auth.permissions.enum';

export const Permissions = (...args: Permission[]) => SetMetadata('permissions', args);
