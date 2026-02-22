import type { AxiosRequestConfig } from 'axios'
import { Workers } from '../../Workers'
import { PromotionalItem } from '../../../interface/DashboardData'

export class ClaimPointsNew extends Workers {
    private cookieHeader: string = ''

    private gainedPoints: number = 0

    private oldBalance: number = this.bot.userData.currentPoints

    public async doClaimPointsNew(promotion: PromotionalItem) {
        const offerId = promotion.offerId
        const claimablePoints = (promotion.attributes as any).claimable_points

        this.bot.logger.info(
            this.bot.isMobile,
            'CLAIM-POINTS-NEW',
            `Starting Claim Points | offerId=${offerId}| claimablePoints=${claimablePoints} | oldBalance=${this.oldBalance}`
        )

        try {
            this.cookieHeader = this.bot.browser.func.buildCookieHeader(
                this.bot.isMobile ? this.bot.cookies.mobile : this.bot.cookies.desktop, [
                    'bing.com',
                    'live.com',
                    'microsoftonline.com'
                ]
            )

            const request: AxiosRequestConfig = {
                url: 'https://rewards.bing.com/dashboard',
                method: 'POST',
                headers: {
                    ...(this.bot.fingerprint?.headers ?? {}),
                    Cookie: this.cookieHeader,
                    Referer: 'https://rewards.bing.com/dashboard',
                    Origin: 'https://rewards.bing.com',
                    'Content-Type': 'text/plain;charset=UTF-8',
                    'next-action': '00cf5ba7699f0e920ffcff223f9e48fea78fd49784'
                },
                data: []
            } 

            this.bot.logger.debug(
                this.bot.isMobile,
                'CLAIM-POINTS-NEW',
                `Sending Claim Points request | offerId=${offerId} | url=${request.url}`
            )

            const response = await this.bot.axios.request(request)

            this.bot.logger.debug(
                this.bot.isMobile,
                'CLAIM-POINTS-NEW',
                `Received Claim Points response | offerId=${offerId} | status=${response.status}`
            )

            const newBalance = await this.bot.browser.func.getCurrentPoints()
            this.gainedPoints = newBalance - this.oldBalance

            this.bot.logger.debug(
                this.bot.isMobile,
                'CLAIM-POINTS-NEW',
                `Balance delta after Claim Points | offerId=${offerId} | oldBalance=${this.oldBalance} | newBalance=${newBalance} | gainedPoints=${this.gainedPoints}`
            )

            if (this.gainedPoints > 0) {
                this.bot.userData.currentPoints = newBalance
                this.bot.userData.gainedPoints = (this.bot.userData.gainedPoints ?? 0) + this.gainedPoints

                this.bot.logger.info(
                    this.bot.isMobile,
                    'CLAIM-POINTS-NEW',
                    `Completed Claim Points | offerId=${offerId} | status=${response.status} | gainedPoints=${this.gainedPoints} | newBalance=${newBalance}`,
                    'green'
                )
            } else {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'CLAIM-POINTS-NEW',
                    `Failed Claim Points with no points | offerId=${offerId} | status=${response.status} | oldBalance=${this.oldBalance} | newBalance=${newBalance}`
                )
            }

            this.bot.logger.debug(
                this.bot.isMobile,
                'CLAIM-POINTS-NEW',
                `Waiting after Claim Points | offerId=${offerId}`
            )

            await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 10000))
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'CLAIM-POINTS-NEW',
                `Error in doClaimPoints | claimablePoints=${claimablePoints} | offerId=${offerId} | message=${error instanceof Error ? error.message : String(error)}`
            )
        }
    }
}
