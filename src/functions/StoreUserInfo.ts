import type { AxiosRequestConfig } from 'axios'
import { Workers } from './Workers'
import { Database } from '../util/Database'

export interface RewardsInfo {
    userInfo: UserInfo
    isError: boolean
    isRewardsUser: boolean
    flyoutResult: FlyoutResult
}

export interface UserInfo {
    balance: number
    errorCode: number
    errorMessage: string
    rewardsCountry: string
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

export interface FlyoutResult {
    levelInfoPromotion: {
        attributes: {
            level: string
            todays_points: string // 今日奖励点数
            hva_dse_days: string // 本月默认搜索引擎天数
            hva_dse_days_max: string // 本月默认搜索引擎目标天数
            pointclaim_progress_dsebonus: string // 上月默认搜索引擎奖励
            program_restructure_monthly_dse_bonus_max: string // 上月默认搜索引擎奖励最大值
            program_restructure_monthly_dse_bonus_state: string // 上月默认搜索引擎奖励状态
            pointclaim_progress_gooduserbonus: string // 上月star奖励
            program_restructure_good_user_bonus_max: string // 上月star奖励最大值
            program_restructure_good_user_bonus_state: string // 上月star奖励状态
            program_restructure_good_user_bonus_progress: string // 本月star奖励进度
            pointclaim_progress_levelbonus: string // 上月升级奖励
            program_restructure_monthly_level_bonus_max: string // 上月升级奖励最大值
            program_restructure_monthly_level_bonus_state: string // 上月升级奖励状态
        }
    }
}

export interface UserInfoStore {
    balance: number;
    isRewardsUser: boolean;
    isError: boolean;
    errorCode: number;
    errorMessage: string;
    level: string;
    todaysPoints: string;
    dseDays: string;
    dseDaysMax: string;
    dseBonus: string;
    dseBonusMax: string;
    dseBonusClaimed: string;
    levelBonus: string;
    levelBonusMax: string;
    levelBonusClaimed: string;
    starBonus: string;
    starBonusMax: string;
    starBonusClaimed: string;
    starBonusProgress: string;
    orders: Order[];
}

export class StoreUserInfo extends Workers {
    private cookieHeader: string = ''
    private fingerprintHeader: { [x: string]: string } = {}
    private localDatabase: Database | null = null

    public async doStoreUserInfo() {
        this.bot.logger.info(
            'main',
            'STORE-USER-INFO',
            'Starting Store User Info'  
        )

        try {
            // 初始化数据库连接
            await this.initializeDatabase()
            
            // 构建请求头
            this.buildRequestHeaders()
            
            // 获取用户信息
            const rewardsInfo = await this.fetchRewardsInfo()
            
            // 处理用户信息
            await this.processRewardsInfo(rewardsInfo)
            
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

    private async fetchRewardsInfo(): Promise<RewardsInfo> {
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

        let rewardsUserInfo: RewardsInfo = response.data
        rewardsUserInfo.userInfo.errorMessage = rewardsUserInfo.userInfo.errorMessage || 'N/A'

        return rewardsUserInfo
    }

    private async processRewardsInfo(rewardsUserInfo: RewardsInfo): Promise<void> {
        const { errorCode, errorMessage, balance } = rewardsUserInfo.userInfo
        const { isRewardsUser, isError } = rewardsUserInfo

        // 用户等级
        const level = rewardsUserInfo.flyoutResult.levelInfoPromotion?.attributes?.level
        // 今日奖励点数
        const todaysPoints = rewardsUserInfo.flyoutResult.levelInfoPromotion?.attributes?.todays_points

        this.bot.logger.info(
            'main',
            'STORE-USER-INFO',
            `User Info | level=${level} | todaysPoints=${todaysPoints} | currentBalance=${balance} | isRewardsUser=${isRewardsUser} | isError=${isError}`
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

        const levelInfoPromotion = rewardsUserInfo.flyoutResult.levelInfoPromotion?.attributes

        // 默认浏览器搜索天数
        const dseDays = levelInfoPromotion?.hva_dse_days
        // 默认浏览器搜索每月目标天数
        const dseDaysMax = levelInfoPromotion?.hva_dse_days_max

        // 上月默认浏览器搜索奖励分数
        const dseBonus = levelInfoPromotion?.pointclaim_progress_dsebonus
        // 上月默认浏览器搜索奖励分数上限 210
        const dseBonusMax = levelInfoPromotion?.program_restructure_monthly_dse_bonus_max
        // 上月默认浏览器搜索奖励分数领取状态
        const dseBonusClaimed = levelInfoPromotion?.program_restructure_monthly_dse_bonus_state

        // 上月等级奖励分数
        const levelBonus = levelInfoPromotion?.pointclaim_progress_levelbonus
        // 上月等级奖励分数上限 420
        const levelBonusMax = levelInfoPromotion?.program_restructure_monthly_level_bonus_max
        // 上月等级奖励分数领取状态
        const levelBonusClaimed = levelInfoPromotion?.program_restructure_good_user_bonus_state

        // 上月必应Star奖励分数
        const starBonus = levelInfoPromotion?.pointclaim_progress_gooduserbonus
        // 上月必应Star奖励分数上限 2100
        const starBonusMax = levelInfoPromotion?.program_restructure_good_user_bonus_max
        // 上月必应Star奖励分数领取状态
        const starBonusClaimed = levelInfoPromotion?.program_restructure_good_user_bonus_state
        // 本月必应Star奖励分数进度
        const starBonusProgress = levelInfoPromotion?.program_restructure_good_user_bonus_progress

        this.bot.logger.info(
            'main',
            'STORE-USER-INFO',
            `User Daily Rewards | dseDays=${dseDays}/${dseDaysMax}`
        )

        this.bot.logger.info(
            'main',
            'STORE-USER-INFO',
            `User Last Month Bonus | dseBonus=${dseBonus}/${dseBonusMax} dseBonusClaimed=${dseBonusClaimed} | levelBonus=${levelBonus}/${levelBonusMax} levelBonusClaimed=${levelBonusClaimed} | starBonus=${starBonus}/${starBonusMax} starBonusClaimed=${starBonusClaimed} starBonusProgress=${starBonusProgress}`
        )

        const orders = rewardsUserInfo.userInfo.orders || []
        
        const storeInfo: UserInfoStore = {
            balance,
            isRewardsUser,
            isError,
            errorCode,
            errorMessage,
            orders,
            level,
            todaysPoints,
            dseDays,
            dseDaysMax,
            dseBonus,
            dseBonusMax,
            dseBonusClaimed,
            levelBonus,
            levelBonusMax,
            levelBonusClaimed,
            starBonus,
            starBonusMax,
            starBonusClaimed,
            starBonusProgress,
        }
        // 保存数据到数据库
        await this.saveRewardsUserInfoToDatabase(storeInfo)
    }

    private async saveRewardsUserInfoToDatabase(userInfo: UserInfoStore): Promise<void> {
        if (!this.localDatabase) return

        try {
            const email = this.bot.userData.email
            
            // 保存订单信息
            if (userInfo.orders && userInfo.orders.length > 0) {
                await this.localDatabase.saveOrders(email, userInfo.orders)
            }
            
            // 保存奖励用户信息
            await this.localDatabase.saveRewardInfo(
                email, 
                userInfo.balance,
                userInfo.isRewardsUser, 
                userInfo.isError, 
                userInfo.errorCode, 
                userInfo.errorMessage,
                userInfo.level,
                userInfo.todaysPoints,
                userInfo.dseDays,
                userInfo.dseDaysMax,
                userInfo.dseBonus,
                userInfo.dseBonusMax,
                userInfo.dseBonusClaimed,
                userInfo.levelBonus,
                userInfo.levelBonusMax,
                userInfo.levelBonusClaimed,
                userInfo.starBonus,
                userInfo.starBonusMax,
                userInfo.starBonusClaimed,
                userInfo.starBonusProgress,
            )
            
            this.bot.logger.info(
                'main',
                'STORE-USER-INFO',
                `Successfully Saved Rewards User Info To Database`
            )
        } catch (error) {
            this.bot.logger.error(
                'main',
                'STORE-USER-INFO',
                `Failed To Save Rewards User Info To Database: ${error instanceof Error ? error.message : String(error)}`
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
