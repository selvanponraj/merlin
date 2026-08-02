import { minBy, min } from 'lodash'

import { dayjs } from '@helpers/dayjs'
import { FMPLink } from '@links/fmp/link.fmp'
import { SecurityEarningResult } from '@links/types'
import { logger } from '@logger'
import { EarningTime } from '@models/earning'

type FMPEarning = {
  date: string
  symbol: string
  eps?: number
  epsActual?: number
  epsEstimated: number
  time: 'bmo' | 'amc'
  revenue?: number
  revenueActual?: number
  revenueEstimated: number
}

type FMPEarningCall = [number, number, string]

type FMPEarningCallTranscript = {
  date: string
  symbol: string
  quarter: number
  year: number
  content: string
}

const formatTime = (time: string) => {
  if (time === 'bmo') return EarningTime.beforeMarketOpen
  if (time === 'amc') return EarningTime.afterMarketClose
  return null
}

const computeFiscalPeriod = (
  closestEarningCall: FMPEarningCall,
  daysDiff: number
) => {
  const quarterDuration = daysDiff > 0 ? -90 : 90
  const [quarter, year] = closestEarningCall
  const nQuarterToAdd = min([-daysDiff, quarterDuration]) as number
  const callDate = dayjs().year(year).quarter(quarter).add(nQuarterToAdd, 'day')
  return { year: callDate.year(), quarter: callDate.quarter() }
}

const getEarningCall = (
  item: FMPEarning,
  earningCallItems: FMPEarningCall[]
): FMPEarningCall | undefined => {
  const earningDate = dayjs(item.date)
  const earningCallDaysDiffs = earningCallItems.map((earningCall) => {
    const [_, __, callDate] = earningCall
    return {
      call: earningCall,
      diff: dayjs(callDate).diff(earningDate, 'day', true),
    }
  })

  const closest = minBy(earningCallDaysDiffs, (earning) =>
    Math.abs(earning.diff)
  )
  if (!closest) return

  const closestDistance = Math.abs(closest.diff)
  if (closestDistance <= 7) {
    return closest.call
  }

  const { quarter, year } = computeFiscalPeriod(closest.call, closest.diff)
  return [quarter, year, item.date]
}

const toEarningResult = (
  item: FMPEarning,
  earningCall?: FMPEarningCall
): SecurityEarningResult => {
  const [fiscalQuarter, fiscalYear] = earningCall ?? []
  const epsSurprisePercent =
    item.epsEstimated && (item.epsActual ?? item.eps)
      ? (((item.epsActual ?? item.eps ?? 0) - item.epsEstimated) /
          Math.abs(item.epsEstimated)) *
        100
      : null
  const revenueSurprisePercent =
    item.revenueEstimated && (item.revenueActual ?? item.revenue)
      ? (((item.revenueActual ?? item.revenue ?? 0) - item.revenueEstimated) /
          Math.abs(item.revenueEstimated)) *
        100
      : null
  return {
    date: item.date,
    fiscalYear: fiscalYear ?? null,
    fiscalQuarter: fiscalQuarter ?? null,
    time: item.time ? formatTime(item.time) : null,
    eps: item.epsActual ?? item.eps ?? null,
    epsEstimate: item.epsEstimated ?? null,
    revenue: (item.revenueActual ?? item.revenue) ? (item.revenueActual ?? item.revenue ?? 0) / 1e6 : null,
    revenueEstimate: item.revenueEstimated ? item.revenueEstimated / 1e6 : null,
    epsSurprisePercent,
    revenueSurprisePercent,
  }
}

async function fmpEarnings(
  this: FMPLink,
  ticker: string
): Promise<SecurityEarningResult[]> {
  const earningDatesResponse = await this.query<FMPEarning[]>(
    this.getStableEndpoint('/stable/earnings', {
      symbol: ticker,
    })
  )
  const earningCallsResponse: FMPEarningCall[] = []
  if (!earningDatesResponse.length) {
    logger.warn('fmp > missing earning dates', { ticker })
    return []
  }
  return earningDatesResponse.map((i) =>
    toEarningResult(i, getEarningCall(i, earningCallsResponse))
  )
}

async function fmpEarningCallTranscript(
  this: FMPLink,
  ticker: string,
  fiscalYear: number,
  fiscalQuarter: number
): Promise<string | undefined> {
  let response: FMPEarningCallTranscript[] = []
  try {
    response = await this.query<FMPEarningCallTranscript[]>(
      this.getStableEndpoint('/stable/earning-call-transcript', {
        symbol: ticker,
        quarter: fiscalQuarter.toString(),
        year: fiscalYear.toString(),
      })
    )
  } catch (err) {
    if (this.isRestrictedError(err)) {
      logger.warn('fmp > earning call transcript endpoint is restricted', {
        ticker,
        fiscalYear,
        fiscalQuarter,
      })
      return
    }
    throw err
  }

  if (!response?.length) {
    logger.warn('fmp > missing earning call transcript', {
      ticker,
      fiscalYear,
      fiscalQuarter,
    })
    return
  }
  return response?.shift()?.content
}

export { fmpEarnings, fmpEarningCallTranscript }
