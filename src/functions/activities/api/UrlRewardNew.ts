import type { AxiosRequestConfig } from 'axios'
import type { BasePromotion } from '../../../interface/DashboardData'
import { Workers } from '../../Workers'

export class UrlRewardNew extends Workers {
    private cookieHeader: string = ''

    private gainedPoints: number = 0

    private oldBalance: number = this.bot.userData.currentPoints

    public async doUrlRewardNew(promotion: BasePromotion, hashUrl: string): Promise<void> {
        this.bot.logger.info(
            this.bot.isMobile,
            'URL-REWARD-NEW',
            `Starting UrlReward | offerId=${promotion.offerId} | geo=${this.bot.userData.geoLocale} | oldBalance=${this.oldBalance}`
        )

        try {
            this.cookieHeader = this.bot.browser.func.buildCookieHeader(
                this.bot.isMobile ? this.bot.cookies.mobile : this.bot.cookies.desktop, [
                    'bing.com',
                    'live.com',
                    'microsoftonline.com'
                ]
            )

            const earnPageRequest: AxiosRequestConfig = {
                url: hashUrl,
                method: 'GET',
                headers: {
                    ...(this.bot.fingerprint?.headers ?? {}),
                    Cookie: this.cookieHeader,
                    Referer: 'https://rewards.bing.com/dashboard?ref=rewardspanel',
                    Origin: 'https://rewards.bing.com'
                },
            } 

            const earnPageResponse = await this.bot.axios.request(earnPageRequest)

            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD-NEW',
                `Received earn page response | status=${earnPageResponse.status}`
            )

            if (earnPageResponse.status !== 200) {
                this.bot.logger.error(
                    this.bot.isMobile,
                    'URL-REWARD-NEW',
                    `Failed to perform UrlRewardNew | status=${earnPageResponse.status}`
                )
            }
            const html = earnPageResponse.data

            const offerId = promotion.offerId

            const hash = this.findHash(html, offerId)

            if (hash.length === 0) {
                this.bot.logger.error(
                    this.bot.isMobile,
                    'URL-REWARD-NEW',
                    `Failed to find hash for offerId=${offerId}`
                )
                return
            }

            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD-NEW',
                `Found hash=${hash} for offerId=${offerId}`
            )

            const paramStr = JSON.stringify([hash, 11, {
                'offerid': offerId, 
                'isPromotional': '$undefined', 
                'timezoneOffset': '-480'
            }])

            const request: AxiosRequestConfig = {
                url: hashUrl,
                method: 'POST',
                headers: {
                    ...(this.bot.fingerprint?.headers ?? {}),
                    Cookie: this.cookieHeader,
                    Referer: hashUrl,
                    Origin: 'https://rewards.bing.com',
                    'Content-Type': 'text/plain;charset=UTF-8',
                    'next-action': '70babbc81d2724f60d29a95c03b3d739cba77cea92'
                },
                data: paramStr
            } 

            const response = await this.bot.axios.request(request)

            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD-NEW',
                `Response: ${JSON.stringify(response.data)}`
            )

            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD-NEW',
                `Received UrlReward response | offerId=${offerId} | status=${response.status}`
            )

            const newBalance = await this.bot.browser.func.getCurrentPoints()
            this.gainedPoints = newBalance - this.oldBalance

            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD-NEW',
                `Balance delta after UrlReward | offerId=${offerId} | oldBalance=${this.oldBalance} | newBalance=${newBalance} | gainedPoints=${this.gainedPoints}`
            )

            if (this.gainedPoints > 0) {
                this.bot.userData.currentPoints = newBalance
                this.bot.userData.gainedPoints = (this.bot.userData.gainedPoints ?? 0) + this.gainedPoints

                this.bot.logger.info(
                    this.bot.isMobile,
                    'URL-REWARD-NEW',
                    `Completed UrlReward | offerId=${offerId} | status=${response.status} | gainedPoints=${this.gainedPoints} | newBalance=${newBalance}`,
                    'green'
                )
            } else {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'URL-REWARD-NEW',
                    `Failed UrlReward with no points | offerId=${offerId} | status=${response.status} | oldBalance=${this.oldBalance} | newBalance=${newBalance}`
                )
            }

            this.bot.logger.debug(this.bot.isMobile, 'URL-REWARD-NEW', `Waiting after UrlReward | offerId=${offerId}`)

            await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 10000))

        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'URL-REWARD-NEW',
                `Failed to perform UrlRewardNew | error=${error}`
            )
        }
    }

    public async getHashHtml(url: string): Promise<string> {
        try {
            this.cookieHeader = this.bot.browser.func.buildCookieHeader(
                this.bot.isMobile ? this.bot.cookies.mobile : this.bot.cookies.desktop, [
                    'bing.com',
                    'live.com',
                    'microsoftonline.com'
                ]
            )

            const earnPageRequest: AxiosRequestConfig = {
                url: url,
                method: 'GET',
                headers: {
                    ...(this.bot.fingerprint?.headers ?? {}),
                    Cookie: this.cookieHeader,
                    Referer: 'https://rewards.bing.com',
                    Origin: 'https://rewards.bing.com'
                },
            } 

            const earnPageResponse = await this.bot.axios.request(earnPageRequest)

            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD-NEW',
                `Received page response | status=${earnPageResponse.status}`
            )

            if (earnPageResponse.status !== 200) {
                this.bot.logger.error(
                    this.bot.isMobile,
                    'URL-REWARD-NEW',
                    `Failed to get page response | status=${earnPageResponse.status}`
                )
                return ''
            }
            return earnPageResponse.data

        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'URL-REWARD-NEW',
                `Failed to perform UrlRewardNew | error=${error}`
            )
            return ''
        }
    }

    private findHash(html: string, offerId: string): string {
        try {
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD-NEW',
                `开始查找offerId="${offerId}"的hash值...`
            )
            
            // 在HTML中查找offerId的位置
            const offerIdIndex = html.indexOf(offerId)
            if (offerIdIndex === -1) {
                this.bot.logger.debug(
                    this.bot.isMobile,
                    'URL-REWARD-NEW',
                    `未找到offerId="${offerId}"`
                )
                return ''
            }
            
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD-NEW',
                `在位置 ${offerIdIndex} 找到offerId="${offerId}"`
            )
            
            // 向前查找最近的"{"，获取JSON对象的开始位置
            let startIndex = offerIdIndex
            let openBraceCount = 0
            let closeBraceCount = 0
            let foundOpenBrace = false
            
            // 先向前查找最近的"{"
            for (let i = offerIdIndex; i >= 0; i--) {
                if (html[i] === '}') {
                    closeBraceCount++
                } else if (html[i] === '{') {
                    if (closeBraceCount === 0) {
                        startIndex = i
                        foundOpenBrace = true
                        break
                    }
                    closeBraceCount--
                }
            }
            
            if (!foundOpenBrace) {
                this.bot.logger.debug(
                    this.bot.isMobile,
                    'URL-REWARD-NEW',
                    `未找到包含offerId="${offerId}"的JSON对象开始位置`
                )
                return ''
            }
            
            // 向后查找对应的"}"，获取JSON对象的结束位置
            let endIndex = startIndex
            openBraceCount = 1
            
            for (let i = startIndex + 1; i < html.length; i++) {
                if (html[i] === '{') {
                    openBraceCount++
                } else if (html[i] === '}') {
                    openBraceCount--
                    if (openBraceCount === 0) {
                        endIndex = i + 1
                        break
                    }
                }
            }
            
            if (openBraceCount !== 0) {
                this.bot.logger.debug(
                    this.bot.isMobile,
                    'URL-REWARD-NEW',
                    `未找到包含offerId="${offerId}"的JSON对象结束位置`
                )
                return ''
            }
            
            // 提取JSON字符串
            const jsonStr = html.substring(startIndex, endIndex)
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD-NEW',
                `提取的JSON字符串长度: ${jsonStr.length} 字符`
            )
            
            // 尝试解析JSON
            try {
                // 处理转义字符
                let cleanedJsonStr = jsonStr.replace(/\\"/g, '"')
                cleanedJsonStr = cleanedJsonStr.replace(/\\u0026/g, '&')
                
                const jsonObj = JSON.parse(cleanedJsonStr)
                
                // 检查JSON对象是否包含offerId和hash
                if (jsonObj.offerId === offerId && jsonObj.hash) {
                    this.bot.logger.debug(
                        this.bot.isMobile,
                        'URL-REWARD-NEW',
                        `成功找到hash值: ${jsonObj.hash}`
                    )
                    return jsonObj.hash
                } else {
                    this.bot.logger.debug(
                        this.bot.isMobile,
                        'URL-REWARD-NEW',
                        `找到的JSON对象不包含正确的offerId或hash`
                    )
                    return ''
                }
            } catch (jsonError) {
                this.bot.logger.debug(
                    this.bot.isMobile,
                    'URL-REWARD-NEW',
                    `解析JSON失败: ${jsonError}`
                )
                return ''
            }
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'URL-REWARD-NEW',
                `查找hash失败: ${error}`
            )
            return ''
        }
    }
}

