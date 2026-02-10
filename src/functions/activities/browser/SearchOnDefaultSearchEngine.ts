import type { Page } from 'patchright'
import type { DashboardData } from '../../../interface/DashboardData'

import { Workers } from '../../Workers'

export class SearchOnDefaultSearchEngine extends Workers {
    private bingHome = 'https://bing.com'

    public async doSearchOnDefaultSearchEngine(data: DashboardData, page: Page, isMobile: boolean): Promise<void> {
        const startDSEDays = data.userStatus.levelInfo.levelUpActivityDefaultSearchEngineDays

        this.bot.logger.info(isMobile, 'SEARCH-ON-DEFAULT-SEARCH-ENGINE', `Starting Default Search Engine searches | currentDays=${startDSEDays}`)  

        try {
            // 从配置中读取默认搜索引擎参数，如果没有则使用默认值
            const defaultSearchEngineparams = this.bot.config.defaultSearchEngineParams || [
                'FORM=ANNTA1&PC=U531',
                'FORM=ANSPA1&PC=CNNDDB',
                'FORM=ANNTH14&PC=U531',
                'FROM=CHROMN&PC=U316'
            ]

            for (const paramOption of defaultSearchEngineparams) {
                const randomParam = paramOption

                const queries = ['MicrosoftRewards', 'BingRewards', 'Microsoft', 'Bing']
                const randomQuery = queries[Math.floor(Math.random() * queries.length)]

                const searchUrl = `${this.bingHome}/search?q=${randomQuery}&${randomParam}`
            
                this.bot.logger.debug(isMobile, 'SEARCH-ON-DEFAULT-SEARCH-ENGINE', `Navigating to search url | url=${searchUrl}`)

                await page.goto(searchUrl)
                await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
                await this.bot.browser.utils.tryDismissAllMessages(page)

                const newDashboardData = await this.bot.browser.func.getDashboardData()
                const finalDSEDays = newDashboardData.userStatus.levelInfo.levelUpActivityDefaultSearchEngineDays

                if (finalDSEDays > startDSEDays) {
                    this.bot.logger.info(
                        isMobile,
                        'SEARCH-ON-DEFAULT-SEARCH-ENGINE',
                        `Completed Default Search Engine searches | startDays=${startDSEDays} | newDays=${finalDSEDays}`
                    )
                    break
                }
                else {
                    this.bot.logger.warn(
                        isMobile,
                        'SEARCH-ON-DEFAULT-SEARCH-ENGINE',
                        `Seem Like Bad ParamOption | paramOption=${randomParam} | startDays=${startDSEDays} | newDays=${finalDSEDays}`
                    )
                }
            }

            

            
 
        } catch (error) {
            this.bot.logger.error(
                isMobile,
                'SEARCH-ON-DEFAULT-SEARCH-ENGINE',
                `Error in doSearch | message=${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

}
