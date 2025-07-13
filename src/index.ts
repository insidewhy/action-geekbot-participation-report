import { Options, parseOptions } from './options'
import { hoursDifference, subtractWorkDays } from './time'

export async function runGeekbotReport(options: Options): Promise<void> {
  const now = new Date()

  // include the current day in the report if the current day is a work day and either:
  //  - there is a due by time configured and the current time is after it
  //  - there is no due by time configured and the current time is more than twelve hours
  //    from the start time
  const includeCurrentDay =
    options.workDays.has(now.getDay()) &&
    (options.dueByTime
      ? hoursDifference(now, options.dueByTime) >= 0
      : hoursDifference(now, options.startTime) >= 12)

  const afterDate = subtractWorkDays(
    now,
    options.workDays,
    options.duration - (includeCurrentDay ? 1 : 0),
  )

  afterDate.setHours(options.startTime.hours)
  afterDate.setMinutes(options.startTime.minutes)

  const after = Math.floor(afterDate.getTime() / 1_000)
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
    const percentage = Math.round((count / options.duration) * 100)
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
