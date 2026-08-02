import { dayjs } from '@helpers/dayjs'
import { FMPLink } from '@links/fmp/link.fmp'
import { SecurityNewsResult } from '@links/types'
import { logger } from '@logger'
import { NewsType } from '@models/news'

export type FMPNews = {
  symbol: string
  publishedDate: string
  title: string
  image: string
  site: string
  text: string
  url: string
}

export type FMPPressRelease = {
  symbol: string
  date: string
  title: string
  text: string
}

const getDate = (dateString: string): Date => {
  return dayjs
    .tz(dateString, 'YYYY-MM-DD HH:mm:ss', 'America/New_York')
    .toDate()
}

const fmpNewsSecurityNews = (item: FMPNews): SecurityNewsResult => {
  return {
    ticker: item.symbol,
    type: NewsType.standard,
    date: getDate(item.publishedDate),
    title: item.title,
    content: item.text,
    website: item.site,
    url: item.url,
  }
}

const fmpPressReleaseSecurityNews = (
  item: FMPPressRelease
): SecurityNewsResult => {
  return {
    ticker: item.symbol,
    type: NewsType.pressRelease,
    date: getDate(item.date),
    title: item.title,
    content: item.text,
  }
}

async function fmpNews(
  this: FMPLink,
  ticker?: string
): Promise<SecurityNewsResult[]> {
  let newsResponse: FMPNews[] = []
  let pressReleaseResponse: FMPPressRelease[] = []

  try {
    newsResponse = await this.query<FMPNews[]>(
      this.getStableEndpoint('/stable/news/stock', {
        ...(ticker && { symbols: ticker }),
        limit: ticker ? '10' : '200',
      })
    )
  } catch (err) {
    if (!this.isRestrictedError(err)) throw err
    logger.warn('fmp > stock news endpoint is restricted for current plan')
  }

  if (ticker) {
    try {
      pressReleaseResponse = await this.query<FMPPressRelease[]>(
        this.getStableEndpoint('/stable/news/press-releases', {
          symbols: ticker,
          limit: '10',
        })
      )
    } catch (err) {
      if (!this.isRestrictedError(err)) throw err
      logger.warn('fmp > press releases endpoint is restricted for current plan')
    }
  }

  if (!newsResponse.length) {
    logger.warn('fmp > missing news')
    return []
  }
  return [
    ...newsResponse.map(fmpNewsSecurityNews),
    ...pressReleaseResponse.map(fmpPressReleaseSecurityNews),
  ]
}

export { fmpNews }
