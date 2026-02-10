import { MicrosoftRewardsBot } from '../index'

/**
 * 通知工具类
 */
export class Notify {
    private bot: MicrosoftRewardsBot

    /**
     * 构造函数
     * @param bot MicrosoftRewardsBot实例
     */
    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    /**
     * 发送消息到 Bark 服务器
     * @param title 消息标题
     * @param body 消息正文
     * @param group 消息分组
     * @returns 发送结果
     */
    public async bark(title: string, body: string, group: string): Promise<string> {
        try {
            const enabled = this.bot.config.notify?.enabled
            const url = this.bot.config.notify?.url
            const deviceKey = this.bot.config.notify?.device_key

            if (!enabled) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'NOTIFY-BARK',
                    '通知功能未启用，跳过消息发送'
                )
                return '通知功能未启用'
            }

            if (!url || !deviceKey) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'NOTIFY-BARK',
                    '通知配置未设置，跳过消息发送'
                )
                return '通知配置未设置'
            }

            const params = {
                title,
                body,
                group
            }

            const requestConfig = {
                url: `${url}/${deviceKey}`,
                method: 'GET' as const,
                params,
                timeout: 10000
            }

            const response = await this.bot.axios.request(requestConfig)

            const responseData = response.data

            if (responseData.code === 200) {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'NOTIFY-BARK',
                    `Bark 消息推送成功: ${title}`
                )
                return 'Bark 消息推送成功'
            }

            this.bot.logger.error(
                this.bot.isMobile,
                'NOTIFY-BARK',
                `Bark 消息推送失败: ${JSON.stringify(responseData)}`
            )
            return `Bark 消息推送失败: ${JSON.stringify(responseData)}`
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'NOTIFY-BARK',
                `发送通知时出错: ${error instanceof Error ? error.message : String(error)}`
            )
            return `发送通知时出错: ${error instanceof Error ? error.message : String(error)}`
        }
    }
}