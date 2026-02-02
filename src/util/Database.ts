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
            this.bot.logger.error('main', 'DATABASE', `Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`)
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
            // 创建 points 表
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS points (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) NOT NULL,
                    points INT NOT NULL,
                    date DATE NOT NULL,
                    group_name VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_username_date (username, date)
                )
            `)

            // 创建 orders 表
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS orders (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) NOT NULL,
                    order_id VARCHAR(255) NOT NULL,
                    reward_name VARCHAR(255) NOT NULL,
                    status VARCHAR(100) NOT NULL,
                    created_at DATETIME NOT NULL,
                    group_name VARCHAR(100) NOT NULL,
                    UNIQUE KEY unique_order_id (order_id)
                )
            `)

            // 创建 reward_info 表
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS reward_info (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) NOT NULL,
                    is_rewards_user BOOLEAN NOT NULL,
                    is_error BOOLEAN NOT NULL,
                    error_code INT NOT NULL,
                    error_message VARCHAR(255) NOT NULL,
                    date DATE NOT NULL,
                    group_name VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_username_date (username, date)
                )
            `)

            this.bot.logger.info('main', 'DATABASE', 'Tables initialized successfully')
        } catch (error) {
            this.bot.logger.error('main', 'DATABASE', `Failed to initialize tables: ${error instanceof Error ? error.message : String(error)}`)
            throw error
        }
    }

    /**
     * 保存积分信息
     */
    async savePoints(account: string, points: number): Promise<void> {
        if (!this.pool) {
            throw new Error('Database pool not initialized')
        }

        try {
            const date = new Date().toISOString().split('T')[0]
            
            await this.pool.execute(
                `INSERT INTO points (username, points, date, group_name) 
                 VALUES (?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE 
                 points = VALUES(points), 
                 group_name = VALUES(group_name),
                 updated_at = CURRENT_TIMESTAMP`,
                [account, points, date, this.config.groupName]
            )

            this.bot.logger.debug('main', 'DATABASE', `Saved points for ${account}: ${points}`)
        } catch (error) {
            this.bot.logger.error('main', 'DATABASE', `Failed to save points: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 保存订单信息
     */
    async saveOrders(account: string, orders: Array<{ id: string; s:string, a: { rewardName?: string, createdAt?: string } }>): Promise<void> {
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
            this.bot.logger.error('main', 'DATABASE', `Failed to save orders: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 保存奖励用户信息
     */
    async saveRewardInfo(account: string, isRewardsUser: boolean, isError: boolean, errorCode: number, errorMessage: string): Promise<void> {
        if (!this.pool) {
            throw new Error('Database pool not initialized')
        }

        try {
            const date = new Date().toISOString().split('T')[0]

            await this.pool.execute(
                `INSERT INTO reward_info (username, is_rewards_user, is_error, error_code, error_message, date, group_name) 
                 VALUES (?, ?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE 
                 is_rewards_user = VALUES(is_rewards_user), 
                 is_error = VALUES(is_error), 
                 error_code = VALUES(error_code), 
                 error_message = VALUES(error_message), 
                 updated_at = CURRENT_TIMESTAMP`,
                [account, isRewardsUser, isError, errorCode, errorMessage, date, this.config.groupName]
            )

            this.bot.logger.debug('main', 'DATABASE', `Saved reward info for ${account}`)
        } catch (error) {
            this.bot.logger.error('main', 'DATABASE', `Failed to save reward info: ${error instanceof Error ? error.message : String(error)}`)
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
                this.bot.logger.error('main', 'DATABASE', `Failed to close database connection: ${error instanceof Error ? error.message : String(error)}`)
            } finally {
                this.pool = null
            }
        }
    }
}

export default Database
