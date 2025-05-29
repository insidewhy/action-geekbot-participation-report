import { getInput } from '@actions/core'

export interface Options {
  geekbotToken: string
  slackToken: string
  slackChannel: string
  heading: string
  days: number
  hours: number
  minutes: number
  workDays: Set<number>
}

function parseOptions(): Options {
  const geekbotToken = getInput('geekbot-token', { required: true })
  const slackToken = getInput('slack-token', { required: true })
  const slackChannel = getInput('slack-channel', { required: true })
  const heading = getInput('heading') || '**Geekbot Participation Summary**'

  const daysRaw = getInput('days')
  const days = daysRaw ? parseInt(daysRaw) : 7

  const timeRaw = getInput('time')
  let hours = 9
  let minutes = 0
  if (timeRaw) {
    if (!/^\d\d:\d\d$/.test(timeRaw)) throw new Error('time should be in hh:mm format')
    const [hoursRaw, minutesRaw] = timeRaw.split(':')
    hours = parseInt(hoursRaw)
    if (hours > 23) throw new Error('there are only 24 hours in a day')
    minutes = parseInt(minutesRaw)
    if (minutes > 59) throw new Error('there are only 60 minutes in an hour')
  }

  const workDaysRaw = getInput('work-days')
  let workDays = new Set([1, 2, 3, 4, 5])
  if (workDaysRaw) {
    workDays = new Set(workDaysRaw.split('').map((v) => parseInt(v)))
  }

  return { geekbotToken, slackToken, slackChannel, heading, days, hours, minutes, workDays }
}

function countWeekdays(startDate: Date, totalDays: number, workDays: Set<number>) {
  let weekdays = 0
  const date = new Date(startDate)

  for (let i = 0; i < totalDays; i++) {
    const day = date.getDay()
    if (workDays.has(day)) {
      ++weekdays
    }
    date.setDate(date.getDate() + 1)
  }

  return weekdays
}

export async function runGeekbotReport(options: Options): Promise<void> {
  const dayFrom = new Date()
  // include the current day so subtract (days - 1)
  dayFrom.setDate(dayFrom.getDate() - options.days + 1)
  dayFrom.setHours(options.hours)
  dayFrom.setMinutes(options.minutes)
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
  const reports = (await response.json()) as Array<{ member: { realname: string } }>
  const responseCountByName = new Map<string, number>()
  for (const report of reports) {
    responseCountByName.set(
      report.member.realname,
      (responseCountByName.get(report.member.realname) ?? 0) + 1,
    )
  }
  const weekDays = countWeekdays(dayFrom, options.days, options.workDays)

  const participants = Array.from(responseCountByName.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  )
  const namePadding = Math.max(...participants.map(([name]) => name.length + 1))

  let reportContent = `${options.heading}\n`
  reportContent += '```\n'

  for (const [name, count] of participants) {
    const percentage = Math.round((count / weekDays) * 100)
    reportContent += `${`${name}:`.padEnd(namePadding)} ${percentage}%\n`
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
