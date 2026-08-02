import 'reflect-metadata'

import { knexDriver } from '../src/drivers/knex'
import { Sector } from '../src/models/sector'
import { Financial } from '../src/models/financial'
import { FinancialService } from '../src/services/financial'

const syncAllSectors = async () => {
  console.log('Connecting to database...')
  await knexDriver.connect()

  const sectors = await Sector.query()
  console.log(`Found ${sectors.length} sectors.`)

  const financialService = new FinancialService({})

  for (const sector of sectors) {
    console.log(`Syncing sector: ${sector.name}...`)

    // Find all years and periods available for financials in this sector
    const periods = await Financial.query()
      .select('year', 'period')
      .where('sectorId', sector.id)
      .orWhereIn('securityId', function() {
        this.select('id').from('securities').whereIn('companyId', function() {
          this.select('id').from('companies').where('sectorId', sector.id)
        })
      })
      .groupBy('year', 'period')

    if (periods.length === 0) {
      console.log(`No financials found for sector: ${sector.name}`)
      continue
    }

    try {
      await financialService.syncSector({
        name: sector.name,
        periods: periods as any[]
      })
      console.log(`Successfully synced sector: ${sector.name} with ${periods.length} periods.`)
    } catch (error) {
      console.error(`Error syncing sector ${sector.name}:`, error)
    }
  }

  console.log('Disconnecting database...')
  await knexDriver.disconnect()
  console.log('Done!')
}

syncAllSectors().catch(console.error)
