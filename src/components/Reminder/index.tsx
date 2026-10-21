import styles from './index.module.less'

const EXAMPLES = ['帮我把这段需求整理成函数签名', '对比 GPT 与 Claude 在长文写作上的差异', '解释一下什么是向量数据库']

/**
 * 空会话欢迎区
 * 原来是一句宣传语（“畅想无限可能”），既不专业也没有信息量；
 * 改成：品牌标 + 一句说明 + 三个可直接照着问的例子。
 */
function Reminder() {
  return (
    <div className={styles.reminder}>
      <img className={styles.reminderLogo} src="/logo-rabbit.svg" alt="rabbitJ" />
      <h2 className={styles.reminderTitle}>开始新的对话</h2>
      <p className={styles.reminderMessage}>
        支持多轮上下文与长文本，回答以流式逐字返回。也可以从左侧历史会话继续。
      </p>
      <div className={styles.reminderExamples}>
        <span className={styles.reminderExamplesLabel}>可以从这些开始</span>
        <ul>
          {EXAMPLES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default Reminder
