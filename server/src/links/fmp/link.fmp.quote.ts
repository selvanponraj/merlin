import { FMPLink } from '@links/fmp/link.fmp'
import { SecurityQuoteResult } from '@links/types'
import { logger } from '@logger'
import { SecurityType } from '@models/security'

export interface FMPQuote {
  symbol: string
  name: string
  price: number
  changesPercentage?: number
  changePercentage?: number
  change: number
  dayLow: number
  dayHigh: number
  yearHigh: number
  yearLow: number
  marketCap: number
  priceAvg50: number
  priceAvg200: number
  volume: number
  avgVolume?: number
  averageVolume?: number
  exchange: string
  open: number
  previousClose: number
  eps: number
  pe: number
  earningsAnnouncement: number
  sharesOutstanding?: number
  timestamp: number
  securityType: SecurityType
}

const toSecurityQuoteResult = (quote: FMPQuote): SecurityQuoteResult => ({
  symbol: quote.symbol,
  price: quote.price,
  open: quote.open,
  dayLow: quote.dayLow,
  dayHigh: quote.dayHigh,
  volume: quote.volume,
  dayChange: quote.change,
  dayChangePercent: quote.changePercentage ?? quote.changesPercentage ?? 0,
  high52w: quote.yearHigh,
  low52w: quote.yearLow,
  marketCap: quote.marketCap,
  sharesOutstanding: quote.sharesOutstanding,
  securityType: FMPLink.getSecurityType(quote),
})

async function fmpQuote(
  this: FMPLink,
  ticker: string
): Promise<SecurityQuoteResult | undefined> {
  const response = await this.batchQuotes([ticker])
  return response?.shift()
}

async function fmpBatchQuotes(
  this: FMPLink,
  tickers: string[]
): Promise<SecurityQuoteResult[]> {
  const response = (
    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const items = await this.query<FMPQuote[]>(
            this.getStableEndpoint('/stable/quote', {
              symbol: ticker,
            })
          )
          const item = items?.shift()
          if (!item) return undefined

          // Fetch sharesOutstanding separately as it's no longer in /stable/quote
          try {
            const sharesArray = await this.query<{ outstandingShares?: number }[]>(
              this.getStableEndpoint('/stable/shares-float', {
                symbol: ticker,
              })
            )
            const sharesData = sharesArray?.[0]
            if (sharesData && sharesData.outstandingShares) {
              item.sharesOutstanding = sharesData.outstandingShares
            }
          } catch {
            // non-critical: ignore if shares-float fails
          }

          return item
        } catch (err) {
          if (this.isRestrictedError(err)) {
            logger.warn('fmp > security quote endpoint is restricted', {
              ticker,
            })
            return undefined
          }
          throw err
        }
      })
    )
  ).filter(Boolean) as FMPQuote[]

  if (!response?.length) {
    logger.warn('fmp > could not fetch security quote', { tickers })
    return []
  }
  return response.map(toSecurityQuoteResult)
}

export { fmpQuote, fmpBatchQuotes }
