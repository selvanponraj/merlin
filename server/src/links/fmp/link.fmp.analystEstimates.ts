import { get } from 'lodash'

import { dayjs } from '@helpers/dayjs'
import { FMPLink } from '@links/fmp/link.fmp'
import { SecurityFinancialResult } from '@links/types'
import { logger } from '@logger'
import { FinancialFreq, FinancialPeriod } from '@models/financial'
import { FinancialBaseStatement, FinancialUnit } from '@models/financialItem'
import {
  IncomeStatementKeys,
  FinancialStatementConfig,
} from '@typings/financial/financialStatement'

export interface FMPAnalystEstimates {
  symbol: string
  date: string
  revenueLow: number
  revenueHigh: number
  revenueAvg: number
  ebitdaLow: number
  ebitdaHigh: number
  ebitdaAvg: number
  ebitLow: number
  ebitHigh: number
  ebitAvg: number
  netIncomeLow: number
  netIncomeHigh: number
  netIncomeAvg: number
  sgaExpenseLow: number
  sgaExpenseHigh: number
  sgaExpenseAvg: number
  epsAvg: number
  epsHigh: number
  epsLow: number
  numAnalystsRevenue: number
  numAnalystsEps: number
}

const statementMap: Record<string, IncomeStatementKeys> = {
  revenueAvg: 'revenue',
  ebitdaAvg: 'ebitda',
  ebitAvg: 'ebit',
  netIncomeAvg: 'netIncome',
  sgaExpenseAvg: 'generalAndAdministrativeExpenses',
  epsAvg: 'eps',
}

const defaultUnit: FinancialUnit = FinancialUnit.millions

const toSecurityFinancialResult = (
  item: FMPAnalystEstimates,
  freq: FinancialFreq
): SecurityFinancialResult[] => {
  const reportDate = dayjs(item.date)
  return Object.keys(item)
    .filter((k) => statementMap[k])
    .map((k) => {
      const financialSlug = statementMap[k]
      const baseSecurityItem =
        FinancialStatementConfig[FinancialBaseStatement.incomeStatement][
          financialSlug
        ]
      const period =
        freq === FinancialFreq.Y
          ? FinancialPeriod.Y
          : (`Q${reportDate.quarter()}` as FinancialPeriod)

      const result = {
        slug: financialSlug,
        statement: FinancialBaseStatement.incomeStatement,
        reportDate: item.date,
        unit: defaultUnit,
        isEstimate: true,
        value: get(item, k),
        period,
        ...baseSecurityItem,
      }

      if (result.unit === FinancialUnit.millions) {
        result.value /= 1e6
      }

      return result
    })
}

async function fmpAnalystEstimates(
  this: FMPLink,
  ticker: string,
  freq: FinancialFreq
): Promise<SecurityFinancialResult[]> {
  const periodComponents: Partial<Record<FinancialFreq, string>> = {
    [FinancialFreq.Y]: 'annual',
    [FinancialFreq.Q]: 'quarter',
  }
  try {
    const response = await this.query<FMPAnalystEstimates[]>(
      this.getStableEndpoint('/stable/analyst-estimates', {
        symbol: ticker,
        period: periodComponents[freq],
      })
    )
    if (!Array.isArray(response)) {
      return []
    }
    return response.flatMap((item) => toSecurityFinancialResult(item, freq))
  } catch (err) {
    if (this.isRestrictedError(err)) {
      logger.warn('fmp > analyst estimates endpoint/period is restricted', {
        ticker,
        freq,
      })
      return []
    }
    throw err
  }
}

export { fmpAnalystEstimates }
