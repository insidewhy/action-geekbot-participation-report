import { getInput } from '@actions/core'

import { Time } from './time'

export interface Options {
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

export function parseOptions(): Options {
  const geekbotToken = getInput('geekbot-token', { required: true })
  const slackToken = getInput('slack-token', { required: true })
  const slackChannel = getInput('slack-channel', { required: true })
  const heading = getInput('heading') || '**Geekbot Participation Summary**'

  const startTimeRaw = getInput('start-time')
  const startTime = startTimeRaw ? parseTime('start-time', startTimeRaw) : { hours: 6, minutes: 0 }

  const workDaysRaw = getInput('work-days')
  let workDays = new Set([1, 2, 3, 4, 5])
  if (workDaysRaw) {
    workDays = new Set(workDaysRaw.split('').map((v) => parseInt(v)))
  }

  const durationRaw = getInput('duration')
  const duration = durationRaw ? parseInt(durationRaw) : workDays.size

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
