export interface Time {
  hours: number
  minutes: number
}

export const hoursDifference = (date: Date, referenceTime: Time): number =>
  date.getHours() - referenceTime.hours + (date.getMinutes() - referenceTime.minutes) / 60

const getPreviousWorkDay = (date: Date, workDays: Set<number>): Date => {
  const nextDate = new Date(date)
  do {
    nextDate.setDate(nextDate.getDate() - 1)
  } while (!workDays.has(nextDate.getDay()))
  return nextDate
}

export const subtractWorkDays = (date: Date, workDays: Set<number>, dayCount: number): Date => {
  let nextDate = new Date(date)
  for (let i = 0; i < dayCount; ++i) {
    nextDate = getPreviousWorkDay(nextDate, workDays)
  }
  return nextDate
}
