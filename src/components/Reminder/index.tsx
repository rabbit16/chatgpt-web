import styles from './index.module.less'

function Reminder() {
  return (
    <div className={styles.reminder}>
      <h2 className={styles.reminder_title}>欢迎来到 {document.title}</h2>
      <p className={styles.reminder_message}>
        与AI智能聊天，畅想无限可能！基于先进的AI引擎，让你的交流更加智能、高效、便捷！
      </p>
    </div>
  )
}

export default Reminder
