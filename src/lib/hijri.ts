/**
 * Approximate Gregorian-to-Hijri conversion using the Kuwaiti algorithm.
 * Accuracy is within +/- 1 day for most dates — sufficient for display purposes.
 */

const HIJRI_MONTHS_AR = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الثاني',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
] as const

const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Ula',
  'Jumada al-Thani',
  'Rajab',
  'Shaaban',
  'Ramadan',
  'Shawwal',
  'Dhul Qadah',
  'Dhul Hijjah',
] as const

interface HijriDate {
  year: number
  month: number
  day: number
}

function toHijri(date: Date): HijriDate {
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()

  let jd =
    Math.floor((1461 * (y + 4800 + Math.floor((m - 13) / 12))) / 4) +
    Math.floor((367 * (m - 1 - 12 * Math.floor((m - 13) / 12))) / 12) -
    Math.floor((3 * Math.floor((y + 4900 + Math.floor((m - 13) / 12)) / 100)) / 4) +
    d -
    32075

  jd = jd - 1948440 + 10632
  const n = Math.floor((jd - 1) / 10631)
  jd = jd - 10631 * n + 354

  const j =
    Math.floor((10985 - jd) / 5316) *
      Math.floor((50 * jd) / 17719) +
    Math.floor(jd / 5670) *
      Math.floor((43 * jd) / 15238)

  jd =
    jd -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29

  const hijriMonth = Math.floor((24 * jd) / 709)
  const hijriDay = jd - Math.floor((709 * hijriMonth) / 24)
  const hijriYear = 30 * n + j - 30

  return { year: hijriYear, month: hijriMonth, day: hijriDay }
}

function formatHijri(hijri: HijriDate, locale: string): string {
  const months = locale === 'ar' ? HIJRI_MONTHS_AR : HIJRI_MONTHS_EN
  const monthName = months[hijri.month - 1] ?? ''

  if (locale === 'ar') {
    return `${hijri.day} ${monthName} ${hijri.year}`
  }

  return `${hijri.day} ${monthName} ${hijri.year}`
}

export { toHijri, formatHijri, HIJRI_MONTHS_AR, HIJRI_MONTHS_EN }
export type { HijriDate }
