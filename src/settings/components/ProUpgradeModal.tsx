import { App, Modal } from 'obsidian'
import { createRoot, Root } from 'react-dom/client'

interface ProUpgradeModalContentProps {
  onClose: () => void
}

const ProUpgradeModalContent: React.FC<ProUpgradeModalContentProps> = ({ onClose }) => {
  const handleUpgradeClick = () => {
    window.open('https://platform.infio.com/billing', '_blank')
  }

  return (
    <div className="pro-upgrade-modal-content">
      <div className="pro-upgrade-modal-header">
        <h2>升级到 Pro 会员</h2>
      </div>
      
      <div className="pro-upgrade-modal-body">
        <div className="pro-upgrade-message">
          <div className="pro-upgrade-icon">⭐</div>
          <p>您的账户不是Pro会员，无法升级到Pro版本。</p>
          <p>请先升级到Pro，享受更多高级功能：</p>
          <ul className="pro-upgrade-features">
            <li>✨ 全新的UI界面</li>
            <li>🚀 在线市场使用权限</li>
						<li>💎 专注任务模型访问权限</li>
            <li>🎯 专业技术支持</li>
					</ul>
        </div>
      </div>
      
      <div className="pro-upgrade-modal-footer">
        <button className="pro-upgrade-btn-cancel" onClick={onClose}>
          关闭
        </button>
        <button className="pro-upgrade-btn-upgrade" onClick={handleUpgradeClick}>
          立即升级 Pro
        </button>
      </div>

      <style>
        {`
        .pro-upgrade-modal-content {
          padding: 0;
        }

        .pro-upgrade-modal-header {
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--background-modifier-border);
        }

        .pro-upgrade-modal-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: var(--text-normal);
        }

        .pro-upgrade-modal-body {
          padding: 24px;
        }

        .pro-upgrade-message {
          text-align: center;
        }

        .pro-upgrade-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .pro-upgrade-message p {
          font-size: 16px;
          line-height: 1.5;
          color: var(--text-normal);
          margin: 0 0 16px 0;
        }

        .pro-upgrade-features {
          list-style: none;
          padding: 0;
          margin: 20px 0;
          text-align: left;
          background: var(--background-secondary);
          border-radius: var(--radius-m);
          padding: 16px 20px;
        }

        .pro-upgrade-features li {
          padding: 8px 0;
          font-size: 14px;
          color: var(--text-normal);
          display: flex;
          align-items: center;
        }

        .pro-upgrade-modal-footer {
          padding: 16px 24px 24px;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .pro-upgrade-btn-cancel {
          padding: 10px 20px;
          border: 1px solid var(--background-modifier-border);
          background: var(--background-secondary);
          color: var(--text-normal);
          border-radius: var(--radius-s);
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .pro-upgrade-btn-cancel:hover {
          background: var(--background-modifier-hover);
        }

        .pro-upgrade-btn-upgrade {
          padding: 10px 20px;
          border: none;
          background: linear-gradient(135deg, var(--interactive-accent), var(--interactive-accent-hover));
          color: var(--text-on-accent);
          border-radius: var(--radius-s);
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .pro-upgrade-btn-upgrade:hover {
          background: linear-gradient(135deg, var(--interactive-accent-hover), var(--interactive-accent));
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .pro-upgrade-btn-upgrade:active {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
        `}
      </style>
    </div>
  )
}

export class ProUpgradeModal extends Modal {
  private root: Root | null = null

  constructor(app: App) {
    super(app)
  }

  onOpen(): void {
    const { contentEl, modalEl } = this

    // 添加特定的CSS类
    modalEl.addClass('mod-pro-upgrade')

    // 设置模态框样式
    modalEl.style.width = '480px'
    modalEl.style.maxWidth = '90vw'

    this.root = createRoot(contentEl)

    this.root.render(
      <ProUpgradeModalContent
        onClose={() => this.close()}
      />
    )
  }

  onClose(): void {
    const { contentEl, modalEl } = this
    modalEl.removeClass('mod-pro-upgrade')
    this.root?.unmount()
    this.root = null
    contentEl.empty()
  }
}
