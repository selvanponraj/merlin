import { FMPLink } from '@links/fmp/link.fmp'
import { FMPQuote } from '@links/fmp/link.fmp.quote'
import { ForexExchangeRateResult } from '@links/types'
import { logger } from '@logger'

const toForexExchangeRateResult = (
  item: FMPQuote
): ForexExchangeRateResult => ({
  from: item.name.split('/')[0],
  to: item.name.split('/')[1],
  price: item.price,
})

async function fmpExchangeRates(
  this: FMPLink
): Promise<ForexExchangeRateResult[]> {
  let quotes: FMPQuote[] = []
  try {
    quotes = await this.query<FMPQuote[]>(
      this.getStableEndpoint('/stable/batch-forex-quotes')
    )
  } catch (err) {
    if (this.isRestrictedError(err)) {
      logger.warn('fmp > forex quotes endpoint is restricted for current plan')
      return []
    }
    throw err
  }

  if (!quotes?.length) {
    logger.warn('fmp > exchangeRate > could not find forex quotes')
    return []
  }
  return quotes.map(toForexExchangeRateResult)
}

export { fmpExchangeRates }
