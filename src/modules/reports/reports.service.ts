// src/modules/reports/reports.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('ReportsService');

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN DE PDFMAKE
// ═══════════════════════════════════════════════════════════════
let pdfMake: any = null;
let pdfReady = false;
let pdfInitError: string | null = null;

(function initPdfMake() {
  try {
    const loadedModule = require('pdfmake/build/pdfmake');
    pdfMake = loadedModule && loadedModule.default ? loadedModule.default : loadedModule;

    const pdfFonts: any = require('pdfmake/build/vfs_fonts');
    const vfs =
      (pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) ||
      (pdfFonts && pdfFonts.vfs) ||
      pdfFonts;

    if (!vfs) throw new Error('vfs es nulo');
    pdfMake.vfs = vfs;

    if (typeof pdfMake.createPdf !== 'function') {
      throw new Error(`pdfMake.createPdf NO es función`);
    }
    pdfReady = true;
  } catch (err: any) {
    pdfInitError = err?.message || String(err);
    logger.error(`[PDFMAKE INIT] ❌ FALLÓ: ${pdfInitError}`);
  }
})();

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) { }

  private async renderPdf(docDefinition: any): Promise<Buffer> {
    if (!pdfReady) throw new Error(`pdfmake no está inicializado.`);
    const pdfDoc = pdfMake.createPdf(docDefinition);
    const maybePromise: any = pdfDoc.getBuffer();

    if (maybePromise && typeof maybePromise.then === 'function') {
      const result: any = await maybePromise;
      return Buffer.isBuffer(result) ? result : Buffer.from(result);
    }

    return new Promise<Buffer>((resolve, reject) => {
      pdfDoc.getBuffer((buffer: Buffer) => {
        if (!buffer || buffer.length === 0) return reject(new Error('Buffer vacío'));
        resolve(buffer);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPER: Obtener datos de la clínica + LOGO
  // ═══════════════════════════════════════════════════════════════
  private async getClinicData(clinicId: number) {
    try {
      const clinic = await this.prisma.clinic.findUnique({
        where: { id: clinicId },
        select: {
          name: true,
          address: true,
          phone: true,
          logoUrl: true
        },
      });

      let logoBase64: string | null = null;

      if (clinic?.logoUrl && typeof clinic.logoUrl === 'string') {
        logoBase64 = await this.processLogo(clinic.logoUrl);
      }

      return {
        name: clinic?.name || 'CLÍNICA DENTAL',
        address: clinic?.address || 'Dirección no registrada',
        phone: clinic?.phone || 'Tel: No registrado',
        logoBase64: logoBase64,
      };
    } catch (e) {
      logger.error(`Error obteniendo clínica: ${e}`);
      return { name: 'CLÍNICA DENTAL', address: '', phone: '', logoBase64: null };
    }
  }

  private async processLogo(logoUrl: string): Promise<string | null> {
    try {
      if (!logoUrl || logoUrl.trim() === '') return null;
      if (logoUrl.startsWith('data:image')) return logoUrl;
      if (logoUrl.startsWith('http')) {
        const response = await fetch(logoUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return `data:image/png;base64,${buffer.toString('base64')}`;
      }

      const cleanPath = logoUrl.startsWith('/') ? logoUrl.slice(1) : logoUrl;
      const absolutePath = path.join(process.cwd(), cleanPath);

      if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
        const buffer = fs.readFileSync(absolutePath);
        const ext = path.extname(absolutePath).replace('.', '') || 'png';
        return `data:image/${ext};base64,${buffer.toString('base64')}`;
      }

      logger.warn(`⚠️ No se encontró el archivo del logo en la ruta: ${absolutePath}`);
      return null;
    } catch (error) {
      logger.warn(`No se pudo procesar el logo (${logoUrl}): ${error}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. CIERRE DIARIO
  // ═══════════════════════════════════════════════════════════════
  async generateDailyClosure(dateStr: string, clinicId: number): Promise<Buffer> {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      if (!year || !month || !day) throw new Error(`Fecha inválida: "${dateStr}"`);

      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

      const [payments, clinic] = await Promise.all([
        this.prisma.payment.findMany({
          where: { clinicId, status: 'ACTIVE', paymentDate: { gte: startOfDay, lte: endOfDay } },
          include: { treatment: { include: { clinicalHistory: { include: { patient: true } } } } },
          orderBy: { paymentDate: 'asc' },
        }),
        this.getClinicData(clinicId)
      ]);

      const total = payments.reduce((acc, p) => acc + Number(p.amount), 0);
      const cashTotal = payments.filter(p => p.paymentMethod === 'CASH').reduce((a, p) => a + Number(p.amount), 0);
      const transferTotal = payments.filter(p => p.paymentMethod === 'TRANSFER').reduce((a, p) => a + Number(p.amount), 0);

      const tableBody: any[] = [
        [
          { text: 'Hora', style: 'tableHeader' },
          { text: 'Paciente', style: 'tableHeader' },
          { text: 'Tratamiento', style: 'tableHeader' },
          { text: 'Método', style: 'tableHeader' },
          { text: 'Monto', style: 'tableHeader', alignment: 'right' },
        ],
        ...payments.map((p, index) => {
          const bgColor = index % 2 === 0 ? '#f8fafc' : null;
          return [
            { text: new Date(p.paymentDate).toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit' }), fillColor: bgColor },
            { text: p.treatment?.clinicalHistory?.patient?.fullName || 'N/A', fillColor: bgColor },
            { text: p.treatment?.name || 'N/A', fillColor: bgColor },
            { text: p.paymentMethod === 'CASH' ? 'Efectivo' : 'Transferencia', fillColor: bgColor },
            { text: `Bs ${Number(p.amount).toFixed(2)}`, alignment: 'right', fillColor: bgColor },
          ];
        }),
      ];

      return await this.buildPdf({
        title: 'Cierre de Caja Diario',
        subtitle: `Fecha: ${startOfDay.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' })}`,
        tableBody,
        stats: [
          { label: 'Total Ingresos', value: total, color: '#0d9488' },
          { label: 'Efectivo', value: cashTotal, color: '#0f172a' },
          { label: 'Transferencias', value: transferTotal, color: '#0284c7' },
        ],
        emptyMessage: 'No se registraron ingresos en esta fecha.',
        clinic,
        tableWidths: ['auto', '*', '*', 'auto', 'auto']
      });
    } catch (err: any) {
      logger.error(`[generateDailyClosure] ❌ ${err?.message}`);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. INGRESOS POR MES
  // ═══════════════════════════════════════════════════════════════
  async generateMonthlyIncome(monthStr: string, clinicId: number): Promise<Buffer> {
    try {
      const [year, month] = monthStr.split('-').map(Number);
      if (!year || !month) throw new Error(`Formato de mes inválido: "${monthStr}"`);

      const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      const [payments, clinic] = await Promise.all([
        this.prisma.payment.findMany({
          where: { clinicId, status: 'ACTIVE', paymentDate: { gte: startDate, lte: endDate } },
          include: { treatment: { include: { clinicalHistory: { include: { patient: true } } } } },
          orderBy: { paymentDate: 'asc' },
        }),
        this.getClinicData(clinicId)
      ]);

      const total = payments.reduce((acc, p) => acc + Number(p.amount), 0);
      const cashTotal = payments.filter(p => p.paymentMethod === 'CASH').reduce((a, p) => a + Number(p.amount), 0);
      const transferTotal = payments.filter(p => p.paymentMethod === 'TRANSFER').reduce((a, p) => a + Number(p.amount), 0);

      const tableBody: any[] = [
        [
          { text: 'Fecha', style: 'tableHeader' },
          { text: 'Paciente', style: 'tableHeader' },
          { text: 'Tratamiento', style: 'tableHeader' },
          { text: 'Método', style: 'tableHeader' },
          { text: 'Monto', style: 'tableHeader', alignment: 'right' },
        ],
        ...payments.map((p, index) => {
          const bgColor = index % 2 === 0 ? '#f8fafc' : null;
          return [
            { text: new Date(p.paymentDate).toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' }), fillColor: bgColor },
            { text: p.treatment?.clinicalHistory?.patient?.fullName || 'N/A', fillColor: bgColor },
            { text: p.treatment?.name || 'N/A', fillColor: bgColor },
            { text: p.paymentMethod === 'CASH' ? 'Efectivo' : 'Transferencia', fillColor: bgColor },
            { text: `Bs ${Number(p.amount).toFixed(2)}`, alignment: 'right', fillColor: bgColor },
          ];
        }),
      ];

      return await this.buildPdf({
        title: 'Resumen de Ingresos Mensuales',
        subtitle: `Mes: ${startDate.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz', month: 'long', year: 'numeric' })}`,
        tableBody,
        stats: [
          { label: 'Total Ingresos', value: total, color: '#0d9488' },
          { label: 'Efectivo', value: cashTotal, color: '#0f172a' },
          { label: 'Transferencias', value: transferTotal, color: '#0284c7' },
        ],
        emptyMessage: 'No se registraron ingresos en este mes.',
        clinic,
        tableWidths: ['auto', '*', '*', 'auto', 'auto']
      });
    } catch (err: any) {
      logger.error(`[generateMonthlyIncome] ❌ ${err?.message}`);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. HISTORIAL DE PACIENTE
  // ═══════════════════════════════════════════════════════════════
  async generatePatientHistory(patientId: number, clinicId: number): Promise<Buffer> {
    try {
      const [patient, clinic] = await Promise.all([
        this.prisma.patient.findUnique({
          where: { id: patientId },
          include: { clinicalHistory: { include: { treatments: { include: { sessions: true }, orderBy: { startDate: 'desc' } } } } },
        }),
        this.getClinicData(clinicId)
      ]);

      if (!patient) throw new NotFoundException('Paciente no encontrado');
      const treatments = patient.clinicalHistory?.treatments || [];

      const tableBody: any[] = [
        [
          { text: 'Fecha', style: 'tableHeader' },
          { text: 'Tratamiento', style: 'tableHeader' },
          { text: 'Estado', style: 'tableHeader' },
          { text: 'Sesiones', style: 'tableHeader' },
          { text: 'Costo Total', style: 'tableHeader', alignment: 'right' },
        ],
        ...treatments.map((t, index) => {
          const bgColor = index % 2 === 0 ? '#f8fafc' : null;
          return [
            { text: new Date(t.startDate).toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' }), fillColor: bgColor },
            { text: t.name, fillColor: bgColor },
            { text: t.status === 'COMPLETED' ? 'Completado' : t.status === 'IN_PROGRESS' ? 'En Progreso' : 'Planificado', fillColor: bgColor },
            { text: `${t.sessions.length} / ${t.estimatedSessions}`, fillColor: bgColor },
            { text: `Bs ${Number(t.totalCost || 0).toFixed(2)}`, alignment: 'right', fillColor: bgColor },
          ];
        }),
      ];

      return await this.buildPdf({
        title: 'Historial Clínico del Paciente',
        subtitle: `${patient.fullName} - Historia #${patient.medicalRecordNum}`,
        tableBody,
        stats: null,
        emptyMessage: 'El paciente no tiene tratamientos registrados.',
        clinic,
        tableWidths: ['auto', '*', 'auto', 'auto', 'auto']
      });
    } catch (err: any) {
      logger.error(`[generatePatientHistory] ❌ ${err?.message}`);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. CUENTAS POR COBRAR (DEUDAS)
  // ═══════════════════════════════════════════════════════════════
  async generateDebtsReport(clinicId: number): Promise<Buffer> {
    try {
      const [treatments, clinic] = await Promise.all([
        this.prisma.treatment.findMany({
          where: {
            clinicId,
            status: { not: 'CANCELLED' },
            totalCost: { gt: 0 }
          },
          include: {
            clinicalHistory: { include: { patient: true } },
            payments: { where: { status: 'ACTIVE' } },
          },
          orderBy: { startDate: 'asc' },
        }),
        this.getClinicData(clinicId)
      ]);

      let totalDebt = 0;
      let patientsWithDebt = new Set();
      const tableBody: any[] = [
        [
          { text: 'Paciente', style: 'tableHeader' },
          { text: 'Teléfono', style: 'tableHeader' },
          { text: 'Tratamiento', style: 'tableHeader' },
          { text: 'Costo Final', style: 'tableHeader', alignment: 'right' }, // 🔥 Cambiado
          { text: 'Pagado', style: 'tableHeader', alignment: 'right' },
          { text: 'Saldo', style: 'tableHeader', alignment: 'right' },
        ]
      ];

      treatments.forEach((t, index) => {
        // 🔥 FIX: Usamos el costo final (que ya incluye el descuento)
        const originalCost = Number(t.totalCost || 0);
        const discount = Number(t.discount || 0);
        // Si tienes el campo finalAmount en BD, úsalo; si no, lo calculamos:
        const finalCost = Number(t.finalAmount || (originalCost - discount));

        const paid = t.payments.reduce((acc, p) => acc + Number(p.amount), 0);
        const balance = finalCost - paid;

        if (balance > 0.1) { // Si hay deuda
          totalDebt += balance;
          patientsWithDebt.add(t.clinicalHistory?.patient?.id);

          const bgColor = index % 2 === 0 ? '#f8fafc' : null;
          tableBody.push([
            { text: t.clinicalHistory?.patient?.fullName || 'N/A', fillColor: bgColor },
            { text: t.clinicalHistory?.patient?.phoneNumber || 'N/A', fillColor: bgColor },
            { text: t.name, fillColor: bgColor },
            { text: `Bs ${finalCost.toFixed(2)}`, alignment: 'right', fillColor: bgColor },
            { text: `Bs ${paid.toFixed(2)}`, alignment: 'right', fillColor: bgColor },
            { text: `Bs ${balance.toFixed(2)}`, alignment: 'right', bold: true, color: '#e11d48', fillColor: bgColor },
          ]);
        }
      });

      return await this.buildPdf({
        title: 'Cuentas por Cobrar',
        subtitle: `Reporte de saldos pendientes - Generado el ${new Date().toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' })}`,
        tableBody,
        stats: [
          { label: 'Total por Cobrar', value: totalDebt, color: '#e11d48' },
          { label: 'Pacientes con Deuda', value: patientsWithDebt.size, color: '#0f172a', isCurrency: false },
        ],
        emptyMessage: '¡Excelente! No hay cuentas pendientes de cobro.',
        clinic,
        tableWidths: ['*', 'auto', '*', 'auto', 'auto', 'auto']
      });
    } catch (err: any) {
      logger.error(`[generateDebtsReport] ❌ ${err?.message}`);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. PAGOS ANULADOS
  // ═══════════════════════════════════════════════════════════════
  async generateVoidedPaymentsReport(clinicId: number): Promise<Buffer> {
    try {
      const [payments, clinic] = await Promise.all([
        this.prisma.payment.findMany({
          // 🔥 FIX: Usamos 'VOIDED' que es el valor real de tu Enum
          where: { clinicId, status: 'VOIDED' },
          include: {
            treatment: { include: { clinicalHistory: { include: { patient: true } } } },
            // 🔥 BONUS: Traemos al usuario que anuló el pago
            voidedByUser: true,
          },
          orderBy: { voidedAt: 'desc' },
        }),
        this.getClinicData(clinicId)
      ]);

      const totalVoided = payments.reduce((acc, p) => acc + Number(p.amount), 0);

      const tableBody: any[] = [
        [
          { text: 'Fecha Anulación', style: 'tableHeader' },
          { text: 'Paciente', style: 'tableHeader' },
          { text: 'Monto', style: 'tableHeader', alignment: 'right' },
          { text: 'Motivo', style: 'tableHeader' },
          { text: 'Anulado por', style: 'tableHeader' },
        ],
        ...payments.map((p, index) => {
          const bgColor = index % 2 === 0 ? '#f8fafc' : null;
          return [
            { text: p.voidedAt ? new Date(p.voidedAt).toLocaleString('es-BO', { timeZone: 'America/La_Paz' }) : 'N/A', fillColor: bgColor },
            { text: p.treatment?.clinicalHistory?.patient?.fullName || 'N/A', fillColor: bgColor },
            { text: `Bs ${Number(p.amount).toFixed(2)}`, alignment: 'right', bold: true, color: '#e11d48', fillColor: bgColor },
            { text: p.voidReason || 'No especificado', fillColor: bgColor },
            // 🔥 BONUS: Mostramos el nombre del usuario, o el ID si no se encontró
            { text: p.voidedByUser?.name || (p.voidedBy ? `ID: ${p.voidedBy}` : 'Sistema'), fillColor: bgColor },
          ];
        }),
      ];

      return await this.buildPdf({
        title: 'Auditoría: Pagos Anulados',
        subtitle: `Registro de devoluciones y cancelaciones`,
        tableBody,
        stats: [
          { label: 'Total Anulado', value: totalVoided, color: '#e11d48' },
          { label: 'Cant. Anulaciones', value: payments.length, color: '#0f172a', isCurrency: false },
        ],
        emptyMessage: 'No se registran pagos anulados.',
        clinic,
        tableWidths: ['auto', '*', 'auto', '*', 'auto']
      });
    } catch (err: any) {
      logger.error(`[generateVoidedPaymentsReport] ❌ ${err?.message}`);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Helper: Documento Unificado (Soporta Tarjetas + Tabla)
  // ═══════════════════════════════════════════════════════════════
  private async buildPdf({ title, subtitle, tableBody, stats, emptyMessage, clinic, tableWidths }: any): Promise<Buffer> {
    const tableLayout = {
      hLineWidth: function (i: number, node: any) { return (i === 0 || i === node.table.body.length) ? 0 : 1; },
      vLineWidth: function () { return 0; },
      hLineColor: function () { return '#e2e8f0'; },
      paddingLeft: function () { return 10; },
      paddingRight: function () { return 10; },
      paddingTop: function () { return 8; },
      paddingBottom: function () { return 8; },
    };

    const topMargin = clinic.logoBase64 ? 110 : 60;

    const docDefinition: any = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [40, topMargin, 40, 60],

      header: {
        margin: [40, 30, 40, 0],
        table: {
          widths: [110, '*', 110],
          body: [
            [
              clinic.logoBase64 ? { image: clinic.logoBase64, fit: [80, 80], alignment: 'left' } : { text: '' },
              {
                alignment: 'center',
                stack: [
                  { text: clinic.name.toUpperCase(), style: 'brand', fontSize: 16, margin: [0, 5, 0, 0] },
                  { text: clinic.address, fontSize: 9, color: '#64748b', margin: [0, 4, 0, 0] },
                  { text: clinic.phone, fontSize: 9, color: '#64748b', margin: [0, 2, 0, 0] },
                ],
                margin: clinic.logoBase64 ? [0, 15, 0, 0] : [0, 5, 0, 0]
              },
              {
                alignment: 'right',
                stack: [
                  { text: 'REPORTE OFICIAL', fontSize: 9, bold: true, color: '#0d9488' },
                  { text: new Date().toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' }), style: 'date', margin: [0, 2, 0, 0] },
                ],
                margin: clinic.logoBase64 ? [0, 15, 0, 0] : [0, 5, 0, 0]
              }
            ]
          ]
        },
        layout: 'noBorders'
      },

      footer: (currentPage: number, pageCount: number) => ({
        margin: [40, 0],
        columns: [
          { text: 'Generado por el Sistema', style: 'footer' },
          { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', style: 'footer' },
        ],
      }),

      content: [
        { text: title, style: 'header' },
        { text: subtitle, style: 'subheader' },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1, lineColor: '#e2e8f0' }] },

        // 🔥 RENDERIZAR TARJETAS (Si las hay)
        stats ? {
          margin: [0, 20, 0, 30],
          columns: stats.map((s: any) => ({
            width: '*',
            table: {
              body: [
                [{ text: s.label, fontSize: 11, bold: true, color: '#64748b', fillColor: '#f8fafc', border: [true, true, true, false], borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', 'transparent'], margin: [15, 15, 15, 5] }],
                [{
                  text: s.isCurrency === false ? s.value.toString() : `Bs ${s.value.toFixed(2)}`,
                  fontSize: 20,
                  bold: true,
                  color: s.color,
                  fillColor: '#f8fafc',
                  border: [true, false, true, true],
                  borderColor: ['#e2e8f0', 'transparent', '#e2e8f0', '#e2e8f0'],
                  margin: [15, 5, 15, 15]
                }],
              ],
            },
            layout: 'noBorders',
          })),
          columnGap: 15,
        } : {},

        // 🔥 RENDERIZAR TABLA
        tableBody.length > 1
          ? {
            table: {
              headerRows: 1,
              widths: tableWidths || ['auto', '*', '*', 'auto', 'auto'],
              body: tableBody
            },
            layout: tableLayout,
            margin: [0, 10, 0, 20],
          }
          : { text: emptyMessage, style: 'italic', margin: [0, 20, 0, 20] },
      ],

      styles: {
        brand: { bold: true, color: '#0d9488' },
        date: { fontSize: 10, color: '#64748b' },
        header: { fontSize: 22, bold: true, color: '#0f172a', margin: [0, 0, 0, 5] },
        subheader: { fontSize: 12, color: '#64748b', margin: [0, 0, 0, 15] },
        footer: { fontSize: 9, color: '#94a3b8' },
        italic: { italics: true, color: '#64748b', alignment: 'center' },
        tableHeader: { bold: true, fontSize: 10, color: '#334155', fillColor: '#f1f5f9' },
      },
      defaultStyle: { fontSize: 10, color: '#334155' },
    };

    return await this.renderPdf(docDefinition);
  }

  // ═══════════════════════════════════════════════════════════════
  // SCRIPT TEMPORAL PARA ENCONTRAR LA DISCREPANCIA
  // ═══════════════════════════════════════════════════════════════
  async debugDebtDiscrepancy(clinicId: number) {
    const treatments = await this.prisma.treatment.findMany({
      where: { clinicId, status: { not: 'CANCELLED' } },
      include: {
        payments: true, // Traemos TODOS los pagos (incluyendo VOIDED)
        clinicalHistory: { include: { patient: true } }
      }
    });

    let totalPdfLogic = 0;
    let totalDbLogic = 0;

    console.log('--- ANÁLISIS DE DISCREPANCIAS ---');

    treatments.forEach(t => {
      const cost = Number(t.totalCost || 0);

      // Lógica del PDF (solo pagos ACTIVE)
      const activePaid = t.payments.filter(p => p.status === 'ACTIVE').reduce((acc, p) => acc + Number(p.amount), 0);
      const pdfBalance = cost - activePaid;

      // Lógica de la UI (usando el campo de la BD)
      const dbBalance = Number(t.remainingBalance || 0);

      if (pdfBalance > 0.1 || dbBalance > 0.1) {
        totalPdfLogic += pdfBalance > 0.1 ? pdfBalance : 0;
        totalDbLogic += dbBalance > 0.1 ? dbBalance : 0;

        // Si la diferencia entre ambas lógicas es mayor a 1 centavo, imprimimos la alerta
        if (Math.abs(pdfBalance - dbBalance) > 0.01) {
          console.log(`⚠️ DISCREPANCIA EN TRATAMIENTO ID: ${t.id}`);
          console.log(`Paciente: ${t.clinicalHistory?.patient?.fullName}`);
          console.log(`Costo Total: ${cost}`);
          console.log(`Saldo en BD (UI): ${dbBalance}`);
          console.log(`Saldo Calculado (PDF): ${pdfBalance}`);
          console.log(`Pagos Totales: ${t.payments.length} (Activos: ${t.payments.filter(p => p.status === 'ACTIVE').length}, Anulados: ${t.payments.filter(p => p.status === 'VOIDED').length})`);
          console.log('---------------------------------');
        }
      }
    });

    console.log(`TOTAL DB (UI): ${totalDbLogic}`);
    console.log(`TOTAL PDF: ${totalPdfLogic}`);
  }

}