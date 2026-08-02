import { FMPLink } from '@links/fmp/link.fmp'
import { FMPQuote } from '@links/fmp/link.fmp.quote'
import { SecuritySearchResult, SecurityListResult } from '@links/types'
import { logger } from '@logger'

export interface FMPSearch {
  symbol: string
  name: string
  currency: string
  stockExchange: string
  exchangeShortName: string
}

export interface FMPList {
  symbol: string
  name: string
}

const toSearchResult = (item: FMPSearch | FMPQuote): SecuritySearchResult => {
  return {
    ticker: item.symbol,
    name: item.name,
    securityType: FMPLink.getSecurityType(item),
  }
}

const toListResult = (item: FMPList): SecurityListResult => {
  return {
    ticker: item.symbol,
    name: item.name,
  }
}

async function fmpSearch(this: FMPLink, input: string) {
  const response = await this.query<FMPSearch[]>(
    this.getStableEndpoint('/stable/search-symbol', {
      query: input,
    })
  )

  if (!response?.length) {
    return []
  }

  return response
    .filter((r) => r.symbol?.replace('^', '') === input)
    .map(toSearchResult)
}

async function fmpGet(this: FMPLink, ticker: string) {
  const response = await this.query<FMPQuote[]>(
    this.getStableEndpoint('/stable/quote', {
      symbol: ticker,
    })
  )
  if (!response?.length) {
    logger.warn('fmp > could not get security', { ticker })
    return
  }
  const item = response.shift()
  if (!item) {
    return
  }
  return toSearchResult(item)
}

async function fmpList(this: FMPLink) {
  let response: FMPQuote[] = []
  try {
    response = await this.query<FMPQuote[]>(
      this.getStableEndpoint('/stable/stock-list')
    )
  } catch (err) {
    if (this.isRestrictedError(err)) {
      logger.warn('fmp > stock list endpoint is restricted for current plan')
      return []
    }
    throw err
  }

  if (!response?.length) {
    return []
  }
  return response.map(toListResult)
}

export { fmpSearch, fmpGet, fmpList }
