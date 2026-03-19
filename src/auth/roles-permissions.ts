import { Permission } from './permissions/auth.permissions.enum';
import { Role } from '@prisma/client'; 

export const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: [
    Permission.CREATE_USER,
    Permission.GET_USERS,
    Permission.DELETE_USER,
    Permission.CREATE_APPOINTMENT,
    Permission.VIEW_APPOINTMENT,
  ],
  DOCTOR: [
    Permission.CREATE_APPOINTMENT,
    Permission.VIEW_APPOINTMENT,
  ],
  PATIENT: [
    Permission.VIEW_APPOINTMENT,
  ],
};