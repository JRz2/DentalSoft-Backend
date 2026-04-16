// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1. Crear SUPER_ADMIN (sin clínica asociada)
  const superAdminPassword = await bcrypt.hash('super123', 10);
  
  const superAdmin = await prisma.user.upsert({
    where: { email: 'super@admin.com' },
    update: {},
    create: {
      name: 'Super Administrador',
      email: 'super@admin.com',
      password: superAdminPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  console.log('✅ SUPER_ADMIN creado');

  // 2. Crear una clínica de ejemplo
  const clinic = await prisma.clinic.upsert({
    where: { subdomain: 'sonrisadental' },
    update: {},
    create: {
      name: 'Clínica Dental Sonrisa',
      subdomain: 'sonrisadental',
      phone: '+573001234567',
      email: 'info@sonrisadental.com',
      address: 'Calle 45 #23-12, Bogotá',
      createdBy: superAdmin.id,
    },
  });
  console.log('✅ Clínica creada');

  // 3. Crear ADMIN de la clínica
  const adminPassword = await bcrypt.hash('admin123', 10);
  
  await prisma.user.upsert({
    where: { email: 'admin@sonrisadental.com' },
    update: {},
    create: {
      name: 'Administrador Clínica',
      email: 'admin@sonrisadental.com',
      password: adminPassword,
      role: 'ADMIN',
      clinicId: clinic.id,
      isActive: true,
    },
  });
  console.log('✅ ADMIN de clínica creado');

  // 4. Crear DOCTOR de la clínica
  const doctorPassword = await bcrypt.hash('doctor123', 10);
  
  await prisma.user.upsert({
    where: { email: 'doctor@sonrisadental.com' },
    update: {},
    create: {
      name: 'Dr. Juan Pérez',
      email: 'doctor@sonrisadental.com',
      password: doctorPassword,
      role: 'DOCTOR',
      clinicId: clinic.id,
      specialty: 'Odontología General',
      isActive: true,
    },
  });
  console.log('✅ DOCTOR creado');

  console.log('🎉 Seed completado');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });