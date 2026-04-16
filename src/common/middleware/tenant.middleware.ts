import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    console.log('🔵 [TenantMiddleware] Path:', req.path); // Debug
    console.log('🔵 [TenantMiddleware] Method:', req.method); // Debug
     console.log('🔵 [TenantMiddleware] IP:', req.ip);

    // ✅ Ignorar completamente las rutas de autenticación
    const authPaths = ['/api/auth/login', '/api/auth/register'];
    if (authPaths.some(path => req.path === path)) {
      console.log('🟢 [TenantMiddleware] Ruta de auth, ignorando'); // Debug
      return next();
    }

    // ✅ Ignorar rutas públicas de clinic-config
    if (req.path === '/api/clinic-config/public') {
      console.log('🟢 [TenantMiddleware] Ruta pública, ignorando'); // Debug
      return next();
    }

    // Obtener el usuario del request (solo si está autenticado)
    const user = (req as any).user;
    console.log('🟡 [TenantMiddleware] User:', user); // Debug
    
    // Si no hay usuario, continuar (para rutas públicas)
    if (!user) {
      console.log('🟢 [TenantMiddleware] No user, continuando'); // Debug
      return next();
    }
    
    // SUPER_ADMIN puede acceder a cualquier clínica
    if (user.role === 'SUPER_ADMIN') {
      console.log('🟢 [TenantMiddleware] SUPER_ADMIN detectado'); // Debug
      const subdomain = this.getSubdomain(req);
      
      if (subdomain) {
        const clinic = await this.prisma.clinic.findUnique({
          where: { subdomain },
        });
        
        if (clinic) {
          (req as any).clinicId = clinic.id;
          (req as any).clinic = clinic;
        }
      }
      return next();
    }
    
    // Usuarios normales solo ven su propia clínica
    if (!user.clinicId) {
      console.log('🟡 [TenantMiddleware] Usuario sin clinicId'); // Debug
      return next();
    }
    
    (req as any).clinicId = user.clinicId;
    console.log('🟢 [TenantMiddleware] clinicId asignado:', user.clinicId); // Debug
    next();
  }

  private getSubdomain(req: Request): string | null {
    const host = req.headers.host;
    
    if (!host) {
      return null;
    }
    
    const parts = host.split('.');
    
    if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'localhost') {
      return parts[0];
    }
    
    return null;
  }
}