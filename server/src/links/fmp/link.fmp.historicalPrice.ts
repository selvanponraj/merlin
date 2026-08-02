import { FMPLink } from '@links/fmp/link.fmp'
import { SecurityHistoricalPriceResult } from '@links/types'
import { logger } from '@logger'

export type FMPHistoricalPrice = {
  symbol?: string
  date: string
  open: number
  high: number
  low: number
  close: number
  adjClose?: number
  volume: number
  unadjustedVolume?: number
  change: number
  changePercent: number
  vwap: number
  label?: string
  changeOverTime: number
}

const toSecurityHistoricalPrice = (
  fmpHistoricalPrice: FMPHistoricalPrice
): SecurityHistoricalPriceResult => {
  const volume = fmpHistoricalPrice.volume / 1e6 // Convert to millions
  const unadjustedVolume =
    (fmpHistoricalPrice.unadjustedVolume ?? fmpHistoricalPrice.volume) / 1e6 // Convert to millions
  return {
    date: fmpHistoricalPrice.date,
    open: fmpHistoricalPrice.open,
    high: fmpHistoricalPrice.high,
    low: fmpHistoricalPrice.low,
    close: fmpHistoricalPrice.close,
    adjustedClose: fmpHistoricalPrice.adjClose ?? fmpHistoricalPrice.close,
    volume: Number.isFinite(volume) ? volume : 0, // Convert to millions
    unadjustedVolume: Number.isFinite(unadjustedVolume) ? volume : 0, // Convert to millions
    change: fmpHistoricalPrice.change,
    changePercent: fmpHistoricalPrice.changePercent,
    volumeWeightedAveragePrice: fmpHistoricalPrice.vwap,
    label: fmpHistoricalPrice.label ?? fmpHistoricalPrice.date,
  }
}

async function fmpHistoricalPrices(
  this: FMPLink,
  ticker: string
): Promise<SecurityHistoricalPriceResult[]> {
  const response = await this.query<FMPHistoricalPrice[]>(
    this.getStableEndpoint('/stable/historical-price-eod/full', {
      symbol: ticker,
      from: '1980-01-01',
    })
  )
  if (!response?.length) {
    logger.warn('fmp > could not get historical prices', { ticker })
    return []
  }
  return response.map(toSecurityHistoricalPrice)
}

export { fmpHistoricalPrices }
