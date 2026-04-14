import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ========== 1. CONFIGURACIÓN DE CLÍNICA ==========
  const existingConfig = await prisma.clinicConfig.findFirst();
  
  if (!existingConfig) {
    await prisma.clinicConfig.create({
      data: {
        businessName: 'Clínica Dental Ejemplo',
        commercialName: 'Sonrisa Dental',
        nit: '900000000-1',
        address: 'Calle Principal #123',
        mobile: '+573001234567',
        email: 'info@sonrisadental.com',
        website: 'www.sonrisadental.com',
        legalRepresentative: 'Dr. Juan Pérez',
        footerText: 'Gracias por confiar en nosotros',
        logoUrl: 'http://localhost:3000/assets/logo-default.png',
        faviconUrl: 'http://localhost:3000/assets/favicon-default.ico',
      },
    });
    console.log('✅ Configuración de clínica creada');
  }

  // ========== 2. USUARIOS ==========
  const adminPassword = await bcrypt.hash('admin123', 10);
  const doctorPassword = await bcrypt.hash('doctor123', 10);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@clinica.com' },
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        name: 'Administrador',
        email: 'admin@clinica.com',
        password: adminPassword,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log('✅ Usuario ADMIN creado');
  }

  const existingDoctor = await prisma.user.findUnique({
    where: { email: 'doctor@clinica.com' },
  });

  if (!existingDoctor) {
    await prisma.user.create({
      data: {
        name: 'Dr. Juan Pérez',
        email: 'doctor@clinica.com',
        password: doctorPassword,
        role: 'DOCTOR',
        specialty: 'Odontología General',
        isActive: true,
      },
    });
    console.log('✅ Usuario DOCTOR creado');
  }

  console.log('🎉 Seed completado');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });