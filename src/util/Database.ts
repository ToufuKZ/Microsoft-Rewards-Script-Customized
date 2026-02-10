import mysql, { Pool } from 'mysql2/promise'
import type { ConfigDatabase } from '../interface/Config'
import type { MicrosoftRewardsBot } from '../index'

export class Database {
    private pool: Pool | null = null
    private config: ConfigDatabase
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot, config: ConfigDatabase) {
        this.bot = bot
        this.config = config
    }

    /**
     * 初始化数据库连接
     */
    async initialize(): Promise<void> {
        try {
            this.pool = mysql.createPool({
                host: this.config.host,
                port: this.config.port,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            })

            // 测试连接
            const connection = await this.pool.getConnection()
            connection.release()

            // 初始化表结构
            await this.initializeTables()

            this.bot.logger.info('main', 'DATABASE', 'Database connection established successfully')
        } catch (error) {
            this.bot.logger.error(
                'main',
                'DATABASE',
                `Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`
            )
            throw error
        }
    }

    /**
     * 初始化表结构
     */
    private async initializeTables(): Promise<void> {
        if (!this.pool) {
            throw new Error('Database pool not initialized')
        }

        try {
            // 创建 orders 表
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS orders (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) NOT NULL,
                    order_id VARCHAR(255) NOT NULL,
                    reward_name VARCHAR(255),
                    status VARCHAR(100),
                    created_at DATETIME,
                    group_name VARCHAR(100),
                    UNIQUE KEY unique_order_id (order_id)
                )
            `)

            // 创建 reward_info 表
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS reward_info (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) NOT NULL,
                    is_rewards_user BOOLEAN,
                    is_error BOOLEAN,
                    error_code INT,
                    error_message VARCHAR(255),
                    date DATE NOT NULL,
                    group_name VARCHAR(100),
                    points INT,
                    level VARCHAR(50),
                    todays_points INT,
                    dse_days INT,
                    dse_days_max INT,
                    dse_bonus INT,
                    dse_bonus_max INT,
                    dse_bonus_claimed VARCHAR(50),
                    level_bonus INT,
                    level_bonus_max INT,
                    level_bonus_claimed VARCHAR(50),
                    star_bonus INT,
                    star_bonus_max INT,
                    star_bonus_claimed VARCHAR(50),
                    star_bonus_progress INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_username_date (username, date)
                )
            `)

            this.bot.logger.info('main', 'DATABASE', 'Tables initialized successfully')
        } catch (error) {
            this.bot.logger.error(
                'main',
                'DATABASE',
                `Failed to initialize tables: ${error instanceof Error ? error.message : String(error)}`
            )
            throw error
        }
    }

    /**
     * 保存订单信息
     */
    async saveOrders(
        account: string,
        orders: Array<{ id: string; s: string; a: { rewardName?: string; createdAt?: string } }>
    ): Promise<void> {
        if (!this.pool) {
            throw new Error('Database pool not initialized')
        }

        try {
            for (const order of orders) {
                const orderId = order.id
                const rewardName = order.a.rewardName
                const status = order.s || 'N/A'
                let createdAt = order.a.createdAt

                if (!orderId || !rewardName || !createdAt) {
                    continue
                }

                if (createdAt.includes('T')) {
                    createdAt = createdAt.replace('Z', '').split('.')[0]
                }

                await this.pool.execute(
                    `INSERT INTO orders (username, order_id, reward_name, status, created_at, group_name) 
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE 
                     username = VALUES(username),
                     reward_name = VALUES(reward_name),
                     status = VALUES(status),
                     created_at = VALUES(created_at),
                     group_name = VALUES(group_name)`,
                    [account, orderId, rewardName, status, createdAt, this.config.groupName]
                )
            }

            this.bot.logger.debug('main', 'DATABASE', `Saved ${orders.length} orders for ${account}`)
        } catch (error) {
            this.bot.logger.error(
                'main',
                'DATABASE',
                `Failed to save orders: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    /**
     * 保存奖励用户信息
     */
    async saveRewardInfo(account: string, points: number, isRewardsUser: boolean, isError: boolean, errorCode: number, errorMessage: string, 
        level?: string, todaysPoints?: string | number, dseDays?: string | number, dseDaysMax?: string | number, 
        dseBonus?: string | number, dseBonusMax?: string | number, dseBonusClaimed?: string, 
        levelBonus?: string | number, levelBonusMax?: string | number, levelBonusClaimed?: string, 
        starBonus?: string | number, starBonusMax?: string | number, starBonusClaimed?: string, starBonusProgress?: string): Promise<void> {
        if (!this.pool) {
            throw new Error('Database pool not initialized')
        }

        try {
            const now = new Date()
            const year = now.getFullYear()
            const month = String(now.getMonth() + 1).padStart(2, '0')
            const day = String(now.getDate()).padStart(2, '0')
            const date = `${year}-${month}-${day}`

            // 转换字符串为整数
            const parseToInt = (value: string | number | undefined): number | null => {
                if (value === undefined || value === null) return null
                if (typeof value === 'number') return value
                if (typeof value === 'string') {
                    const parsed = parseInt(value, 10)
                    return isNaN(parsed) ? null : parsed
                }
                return null
            }

            const todaysPointsInt = parseToInt(todaysPoints)
            const dseDaysInt = parseToInt(dseDays)
            const dseDaysMaxInt = parseToInt(dseDaysMax)
            const dseBonusInt = parseToInt(dseBonus)
            const dseBonusMaxInt = parseToInt(dseBonusMax)
            const levelBonusInt = parseToInt(levelBonus)
            const levelBonusMaxInt = parseToInt(levelBonusMax)
            const starBonusInt = parseToInt(starBonus)
            const starBonusMaxInt = parseToInt(starBonusMax)
            const starBonusProgressInt = parseToInt(starBonusProgress)

            await this.pool.execute(
                `INSERT INTO reward_info (username, points, is_rewards_user, is_error, error_code, error_message, date, group_name, 
                 level, todays_points, dse_days, dse_days_max, 
                 dse_bonus, dse_bonus_max, dse_bonus_claimed, 
                 level_bonus, level_bonus_max, level_bonus_claimed, 
                 star_bonus, star_bonus_max, star_bonus_claimed, star_bonus_progress) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE 
                 points = VALUES(points),
                 is_rewards_user = VALUES(is_rewards_user), 
                 is_error = VALUES(is_error), 
                 error_code = VALUES(error_code), 
                 error_message = VALUES(error_message), 
                 level = VALUES(level),
                 todays_points = VALUES(todays_points),
                 dse_days = VALUES(dse_days),
                 dse_days_max = VALUES(dse_days_max),
                 dse_bonus = VALUES(dse_bonus),
                 dse_bonus_max = VALUES(dse_bonus_max),
                 dse_bonus_claimed = VALUES(dse_bonus_claimed),
                 level_bonus = VALUES(level_bonus),
                 level_bonus_max = VALUES(level_bonus_max),
                 level_bonus_claimed = VALUES(level_bonus_claimed),
                 star_bonus = VALUES(star_bonus),
                 star_bonus_max = VALUES(star_bonus_max),
                 star_bonus_claimed = VALUES(star_bonus_claimed),
                 star_bonus_progress = VALUES(star_bonus_progress),
                 updated_at = CURRENT_TIMESTAMP`,
                [account, points, isRewardsUser, isError, errorCode, errorMessage, date, this.config.groupName, 
                 level, todaysPointsInt, dseDaysInt, dseDaysMaxInt, 
                 dseBonusInt, dseBonusMaxInt, dseBonusClaimed, 
                 levelBonusInt, levelBonusMaxInt, levelBonusClaimed, 
                 starBonusInt, starBonusMaxInt, starBonusClaimed, starBonusProgressInt]
            )

            this.bot.logger.debug('main', 'DATABASE', `Saved reward info for ${account} with points: ${points}`)
        } catch (error) {
            this.bot.logger.error(
                'main',
                'DATABASE',
                `Failed to save reward info: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    /**
     * 关闭数据库连接
     */
    async close(): Promise<void> {
        if (this.pool) {
            try {
                await this.pool.end()
                this.bot.logger.info('main', 'DATABASE', 'Database connection closed successfully')
            } catch (error) {
                this.bot.logger.error(
                    'main',
                    'DATABASE',
                    `Failed to close database connection: ${error instanceof Error ? error.message : String(error)}`
                )
            } finally {
                this.pool = null
            }
        }
    }
}

export default Database
