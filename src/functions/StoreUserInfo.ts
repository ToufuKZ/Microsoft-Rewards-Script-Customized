import type { AxiosRequestConfig } from 'axios'
import { Workers } from './Workers'
import { Database } from '../util/Database'

export interface RewardsUserInfo {
    userInfo: UserInfo
    isError: boolean
    errorMessage: null
    isRewardsUser: boolean
}

export interface UserInfo {
    isRewardsUser: boolean
    balance: number
    errorCode: number
    errorMessage: null
    rewardsCountry: string
    autoRedeemItem: null
    orders: Order[]
}

export interface Order {
    id: string
    p: number
    sku: string
    s: string
    ts: string
    a: OrderDetail
}

export interface OrderDetail {
    OrderId: string
    CorrelationId: string
    Channel: string
    Language: string
    Country: string
    EvaluationId: string
    bal_before_deduct: string
    bal_after_deduct: string
    provider: string
    rewardName: string
    status: string
    createdAt: string
}

export class StoreUserInfo extends Workers {
    private cookieHeader: string = ''
    private fingerprintHeader: { [x: string]: string } = {}
    private localDatabase: Database | null = null

    public async doStoreUserInfo() {
        this.bot.logger.info(
            this.bot.isMobile,
            'STORE-USER-INFO',
            'Starting Store User Info'  
        )

        try {
            // 初始化数据库连接
            await this.initializeDatabase()
            
            // 构建请求头
            this.buildRequestHeaders()
            
            // 获取用户信息
            const userInfo = await this.fetchUserInfo()
            
            // 处理用户信息
            await this.processUserInfo(userInfo)
            
            await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 10000))
        } catch (error) {
            this.bot.logger.error(
                'main',
                'STORE-USER-INFO',
                `Error in doStoreUserInfo | message=${error instanceof Error ? error.message : String(error)}`
            )
        } finally {
            // 确保关闭数据库连接
            await this.closeDatabaseConnection()
        }
    }

    private async initializeDatabase(): Promise<void> {
        if (this.bot.config.database?.enabled) {
            try {
                this.localDatabase = new Database(this.bot, this.bot.config.database)
                await this.localDatabase.initialize()
                this.bot.logger.info(
                    'main',
                    'STORE-USER-INFO',
                    'Database connection established successfully'
                )
            } catch (error) {
                this.bot.logger.error(
                    'main',
                    'STORE-USER-INFO',
                    `Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`
                )
                this.localDatabase = null
            }
        }
    }

    private buildRequestHeaders(): void {
        this.cookieHeader = this.bot.browser.func.buildCookieHeader(
            this.bot.cookies.mobile, [
                'bing.com',
                'live.com',
                'microsoftonline.com'
            ]
        )

        const fingerprintHeaders = { ...this.bot.fingerprint.headers }
        delete fingerprintHeaders['Cookie']
        delete fingerprintHeaders['cookie']
        this.fingerprintHeader = fingerprintHeaders

        this.bot.logger.debug(
            'main',
            'STORE-USER-INFO',  
            `Prepared headers | cookieLength=${this.cookieHeader.length} | fingerprintHeaderKeys=${Object.keys(this.fingerprintHeader).length}`
        )
    }

    private async fetchUserInfo(): Promise<{
        currentBalance: number;
        isRewardsUser: boolean;
        isError: boolean;
        errorCode: number;
        errorMessage: string;
        orders: Order[];
    }> {
        const request: AxiosRequestConfig = {
            url: 'https://cn.bing.com/rewards/panelflyout/getuserinfo?channel=BingFlyout&partnerId=BingRewards',
            method: 'GET',
            headers: {
                ...(this.bot.fingerprint?.headers ?? {}),
                Cookie: this.cookieHeader,
                Referer: 'https://cn.bing.com/rewards/',
                Origin: 'https://cn.bing.com'
            }
        }

        this.bot.logger.debug(
            'main',
            'STORE-USER-INFO',
            `Sending Get User Info request | url=${request.url}`
        )

        const response = await this.bot.axios.request(request)

        this.bot.logger.debug(
            'main',
            'STORE-USER-INFO',
            `Received Get User Info response | status=${response.status}`
        )

        const rewardsUserInfo: RewardsUserInfo = response.data

        return {
            currentBalance: rewardsUserInfo.userInfo.balance,
            isRewardsUser: rewardsUserInfo.userInfo.isRewardsUser,
            isError: rewardsUserInfo.isError,
            errorCode: rewardsUserInfo.userInfo.errorCode,
            errorMessage: rewardsUserInfo.userInfo.errorMessage || 'N/A',
            orders: rewardsUserInfo.userInfo.orders
        }
    }

    private async processUserInfo(userInfo: {
        currentBalance: number;
        isRewardsUser: boolean;
        isError: boolean;
        errorCode: number;
        errorMessage: string;
        orders: Order[];
    }): Promise<void> {
        const { currentBalance, isRewardsUser, isError, errorCode, errorMessage } = userInfo

        this.bot.logger.info(
            'main',
            'STORE-USER-INFO',
            `User Info | currentBalance=${currentBalance} | isRewardsUser=${isRewardsUser} | isError=${isError}`
        )

        if (!isRewardsUser) {
            this.bot.logger.warn(
                'main',
                'STORE-USER-INFO',
                `User Has Being Blocked ! | isRewardsUser=${isRewardsUser}`
            )
        }

        if (isError) {
            this.bot.logger.warn(
                'main',
                'STORE-USER-INFO',
                `User Has Being Warned |  isError=${isError} | errorCode=${errorCode} | errorMessage=${errorMessage}`
            )
        }
        
        // 保存数据到数据库
        await this.saveUserInfoToDatabase(userInfo)
    }

    private async saveUserInfoToDatabase(userInfo: {
        currentBalance: number;
        isRewardsUser: boolean;
        isError: boolean;
        errorCode: number;
        errorMessage: string;
        orders: Order[];
    }): Promise<void> {
        if (!this.localDatabase) return

        try {
            const email = this.bot.userData.email
            const { currentBalance, isRewardsUser, isError, errorCode, errorMessage, orders } = userInfo
            
            // 保存积分信息
            await this.localDatabase.savePoints(email, currentBalance)
            
            // 保存订单信息
            if (orders && orders.length > 0) {
                await this.localDatabase.saveOrders(email, orders)
            }
            
            // 保存奖励用户信息
            await this.localDatabase.saveRewardInfo(email, isRewardsUser, isError, errorCode, errorMessage)
            
            this.bot.logger.info(
                'main',
                'STORE-USER-INFO',
                `Successfully Saved User Info To Database`
            )
        } catch (error) {
            this.bot.logger.error(
                'main',
                'STORE-USER-INFO',
                `Failed To Save User Info To Database: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    private async closeDatabaseConnection(): Promise<void> {
        if (!this.localDatabase) return

        try {
            await this.localDatabase.close()
            this.bot.logger.info(
                'main',
                'STORE-USER-INFO',
                'Database Connection Closed Successfully'
            )
        } catch (error) {
            this.bot.logger.error(
                'main',
                'STORE-USER-INFO',
                `Failed To Close Database Connection: ${error instanceof Error ? error.message : String(error)}`
            )
        } finally {
            this.localDatabase = null
        }
    }
}
