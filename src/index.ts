import { getInput } from '@actions/core'

interface Time {
  hours: number
  minutes: number
}

interface Options {
  geekbotToken: string
  slackToken: string
  slackChannel: string
  heading: string
  duration: number
  startTime: Time
  dueByTime?: Time
  workDays: Set<number>
}

function parseTime(name: string, str: string): Time {
  if (!/^\d\d:\d\d$/.test(str)) throw new Error(`${name} should be in hh:mm format`)
  const [hoursRaw, minutesRaw] = str.split(':')
  const hours = parseInt(hoursRaw)
  if (hours > 23) throw new Error('there are only 24 hours in a day')
  const minutes = parseInt(minutesRaw)
  if (minutes > 59) throw new Error('there are only 60 minutes in an hour')

  return { hours, minutes }
}

function parseOptions(): Options {
  const geekbotToken = getInput('geekbot-token', { required: true })
  const slackToken = getInput('slack-token', { required: true })
  const slackChannel = getInput('slack-channel', { required: true })
  const heading = getInput('heading') || '**Geekbot Participation Summary**'

  const durationRaw = getInput('duration')
  const duration = durationRaw ? parseInt(durationRaw) : 7

  const startTimeRaw = getInput('start-time')
  const startTime = startTimeRaw ? parseTime('start-time', startTimeRaw) : { hours: 6, minutes: 0 }

  const workDaysRaw = getInput('work-days')
  let workDays = new Set([1, 2, 3, 4, 5])
  if (workDaysRaw) {
    workDays = new Set(workDaysRaw.split('').map((v) => parseInt(v)))
  }

  const dueByTimeRaw = getInput('due-by-time')
  const dueByTime = dueByTimeRaw ? parseTime('due-by-time', dueByTimeRaw) : undefined

  return {
    geekbotToken,
    slackToken,
    slackChannel,
    heading,
    duration,
    startTime,
    dueByTime,
    workDays,
  }
}

function countWorkDays(startDate: Date, totalDays: number, workDays: Set<number>) {
  let workDayCount = 0
  const date = new Date(startDate)

  for (let i = 0; i < totalDays; i++) {
    const day = date.getDay()
    if (workDays.has(day)) {
      ++workDayCount
    }
    date.setDate(date.getDate() + 1)
  }

  return workDayCount
}

const hoursDifference = (date: Date, referenceTime: Time): number =>
  date.getHours() - referenceTime.hours + (date.getMinutes() - referenceTime.minutes) / 60

export async function runGeekbotReport(options: Options): Promise<void> {
  const dayFrom = new Date()

  // when there is a "due by time", include the current day in the report if
  // the current time is after the due by time, otherwise include it when
  // the current time is more than twelve hours from the start of the report
  const includeCurrentDay = options.dueByTime
    ? hoursDifference(dayFrom, options.dueByTime) >= 0
    : hoursDifference(dayFrom, options.startTime) >= 12

  dayFrom.setDate(dayFrom.getDate() - options.duration + (includeCurrentDay ? 1 : 0))
  dayFrom.setHours(options.startTime.hours)
  dayFrom.setMinutes(options.startTime.minutes)

  const after = Math.floor(dayFrom.getTime() / 1_000)
  const response = await fetch(`https://api.geekbot.com/v1/reports?after=${after}`, {
    method: 'GET',
    headers: {
      authorization: options.geekbotToken,
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error('Could not fetch geekbot report')
  }
  const reports = (await response.json()) as Array<{
    timestamp: number
    member: { realname: string }
  }>
  const responseCountByName = new Map<string, number>()
  const lateByName = new Map<string, number>()
  for (const report of reports) {
    responseCountByName.set(
      report.member.realname,
      (responseCountByName.get(report.member.realname) ?? 0) + 1,
    )

    if (options.dueByTime) {
      const reportTime = new Date(report.timestamp * 1_000)
      if (
        reportTime.getHours() > options.dueByTime.hours ||
        (reportTime.getHours() === options.dueByTime.hours &&
          reportTime.getMinutes() > options.dueByTime.minutes) ||
        reportTime.getHours() < options.startTime.hours ||
        (reportTime.getHours() === options.startTime.hours &&
          reportTime.getMinutes() < options.startTime.minutes)
      ) {
        lateByName.set(report.member.realname, (lateByName.get(report.member.realname) ?? 0) + 1)
      }
    }
  }

  const workDayCount = countWorkDays(dayFrom, options.duration, options.workDays)

  const metrics = Array.from(responseCountByName.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  metrics.push(['Total', reports.length / responseCountByName.size])
  lateByName.set(
    'Total',
    Array.from(lateByName.values()).reduce((sum, v) => sum + v, 0),
  )

  const namePadding = Math.max(...metrics.map(([name]) => name.length + 1))
  let reportContent = `${options.heading}\n`
  reportContent += '```\n'
  for (const [name, count] of metrics) {
    const percentage = Math.round((count / workDayCount) * 100)
    reportContent += `${`${name}:`.padEnd(namePadding)} ${(percentage + '%').padEnd(4)}`
    const lateCount = lateByName.get(name)
    if (lateCount) {
      reportContent += ` - late: ${lateCount}`
    }
    reportContent += '\n'
  }
  reportContent += '```'

  const sendResponse = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${options.slackToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      channel: options.slackChannel,
      markdown_text: reportContent,
    }).toString(),
  })
  if (!sendResponse.ok) {
    throw new Error('Could not post message to chat')
  }
  const sendJson = (await sendResponse.json()) as { ok: boolean }
  if (!sendJson.ok) {
    throw new Error('Could not post message to chat')
  }
}

export async function run(): Promise<void> {
  const options = parseOptions()
  await runGeekbotReport(options)
}

if (process.env.GITHUB_ACTIONS) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
