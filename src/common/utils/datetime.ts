const CLINIC_TZ = 'America/La_Paz';

export interface LocalParts {
    date: string; // "YYYY-MM-DD"
    time: string; // "HH:mm"
}

/**
 * Convierte un Date/ISO a { date, time } en la zona horaria de la clínica.
 * Inmune al TZ del servidor (Render = UTC).
 */
export function toClinicDateParts(input: Date | string): LocalParts {
    const d = typeof input === 'string' ? new Date(input) : input;
    if (isNaN(d.getTime())) return { date: '', time: '' };

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: CLINIC_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(d);

    const get = (t: Intl.DateTimeFormatPartTypes) =>
        parts.find(p => p.type === t)?.value ?? '';

    const hour = get('hour') === '24' ? '00' : get('hour');

    return {
        date: `${get('year')}-${get('month')}-${get('day')}`,
        time: `${hour}:${get('minute')}`,
    };
}

/**
 * Rango UTC que corresponde a un día completo en hora clínica (00:00 → 23:59:59.999 Bolivia).
 * Listo para usar en Prisma con `gte: startUtc, lt: endUtc`.
 */
export function getClinicDayRange(dateInput: Date | string): { startUtc: Date; endUtc: Date } {
    const { date } = toClinicDateParts(dateInput);
    const [y, m, d] = date.split('-').map(Number);
    // Bolivia es UTC-4 todo el año (sin DST)
    return {
        startUtc: new Date(Date.UTC(y, m - 1, d, 4, 0, 0, 0)),
        endUtc: new Date(Date.UTC(y, m - 1, d + 1, 3, 59, 59, 999)),
    };
}

/**
 * Rango UTC de la semana (lunes 00:00 → domingo 23:59:59.999 Bolivia).
 */
export function getClinicWeekRange(referenceInput: Date | string): {
    startUtc: Date;
    endUtc: Date;
    weekStart: string; // "YYYY-MM-DD"
    weekEnd: string;   // "YYYY-MM-DD"
} {
    const { date } = toClinicDateParts(referenceInput);
    const [y, m, d] = date.split('-').map(Number);

    // Mediodía UTC del día de referencia para calcular el día de la semana sin bordes raros
    const ref = new Date(Date.UTC(y, m - 1, d, 12));
    const dayOfWeek = ref.getUTCDay(); // 0=dom, 1=lun, ..., 6=sáb
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const mondayUtc = new Date(Date.UTC(y, m - 1, d + diffToMonday, 4, 0, 0, 0));       // lunes 00:00 BOL
    const sundayEndUtc = new Date(Date.UTC(y, m - 1, d + diffToMonday + 7, 3, 59, 59, 999)); // dom 23:59:59.999 BOL

    return {
        startUtc: mondayUtc,
        endUtc: sundayEndUtc,
        weekStart: toClinicDateParts(mondayUtc).date,
        weekEnd: toClinicDateParts(sundayEndUtc).date,
    };
}

/**
 * Rango UTC de un mes completo en hora clínica.
 */
export function getClinicMonthRange(year: number, month: number): {
    startUtc: Date;
    endUtc: Date;
    monthStart: string;
    monthEnd: string;
} {
    const startUtc = new Date(Date.UTC(year, month - 1, 1, 4, 0, 0, 0));
    const endUtc = new Date(Date.UTC(year, month, 1, 3, 59, 59, 999));
    return {
        startUtc,
        endUtc,
        monthStart: toClinicDateParts(startUtc).date,
        monthEnd: toClinicDateParts(new Date(endUtc.getTime() - 1)).date,
    };
}

/**
 * Año/mes actual en hora clínica.
 */
export function getClinicNowParts(): { year: number; month: number; day: number } {
    const { date } = toClinicDateParts(new Date());
    const [y, m, d] = date.split('-').map(Number);
    return { year: y, month: m, day: d };
}