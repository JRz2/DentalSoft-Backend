import { Permission } from './permissions/auth.permissions.enum';
import { Role } from '@prisma/client'; 

export const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: [
    Permission.CREATE_USER,
    Permission.GET_USERS,
    Permission.DELETE_USER,
    Permission.CREATE_APPOINTMENT,
    Permission.VIEW_APPOINTMENT,
    Permission.CREATE_PATIENT,
    Permission.VIEW_PATIENT,
    Permission.UPDATE_PATIENT,
    Permission.DELETE_PATIENT,
  ],
  DOCTOR: [
    Permission.CREATE_APPOINTMENT,
    Permission.VIEW_APPOINTMENT,
    Permission.CREATE_PATIENT,
    Permission.VIEW_PATIENT,
    Permission.UPDATE_PATIENT,
  ],
    RECEPTIONIST: [
    Permission.CREATE_APPOINTMENT,
    Permission.VIEW_APPOINTMENT,
    Permission.CREATE_PATIENT,
    Permission.VIEW_PATIENT,
    Permission.UPDATE_PATIENT,
  ],
};