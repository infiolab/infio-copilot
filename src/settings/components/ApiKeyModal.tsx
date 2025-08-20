import { App, Modal } from 'obsidian'
import { createRoot, Root } from 'react-dom/client'

import { INFIO_PLATFORM_URL } from '../../constants'
interface ApiKeyModalContentProps {
  onClose: () => void
  app: App
}

const ApiKeyModalContent: React.FC<ApiKeyModalContentProps> = ({ onClose, app }) => {
  const handleGetApiKeyClick = () => {
    window.open(`${INFIO_PLATFORM_URL}/api-keys`, '_blank')
  }

  const handleUpgradeProClick = () => {
		window.open(`${INFIO_PLATFORM_URL}/billing`, '_blank')
  }

  const handleOpenSettingsClick = () => {
    onClose()
    // 打开设置面板到 Infio Provider 选项卡
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setting = (app as any).setting
    setting.open()
    setting.openTabById('infio-copilot')
  }

  return (
    <div className="api-key-modal-content">
      <div className="api-key-modal-header">
        <h2>配置 API Key</h2>
      </div>
      
      <div className="api-key-modal-body">
        <div className="api-key-message">
          {/* <div className="api-key-icon">🔑</div> */}
          <p>请先在 Infio Provider 设置中配置 Infio API Key</p>
          <p>您可以按照以下步骤获取和配置 API Key：</p>
          
          <div className="api-key-steps">
            <div className="api-key-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>获取 API Key</h4>
                <p>访问 Infio 平台获取您的 API Key</p>
                <button className="step-action-btn" onClick={handleGetApiKeyClick}>
                  获取 API Key
                </button>
              </div>
            </div>
            
            <div className="api-key-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>确保已升级为 Pro 会员</h4>
                <p>升级到 Pro 会员以享受更多高级功能和模型访问权限</p>
                <button className="step-action-btn" onClick={handleUpgradeProClick}>
                  升级到 Pro
                </button>
              </div>
            </div>
            
            <div className="api-key-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h4>配置 Infio API Key</h4>
                <p>在插件设置中的 Infio Provider 部分配置您的 Infio API Key</p>
                <button className="step-action-btn" onClick={handleOpenSettingsClick}>
                  打开设置
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="api-key-modal-footer">
        <button className="api-key-btn-close" onClick={onClose}>
          关闭
        </button>
      </div>

      <style>
        {`
        .api-key-modal-content {
          padding: 0;
        }

        .api-key-modal-header {
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--background-modifier-border);
        }

        .api-key-modal-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: var(--text-normal);
        }

        .api-key-modal-body {
          padding: 24px;
        }

        .api-key-message {
          text-align: center;
        }

        .api-key-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .api-key-message p {
          font-size: 16px;
          line-height: 1.5;
          color: var(--text-normal);
          margin: 0 0 16px 0;
        }

        .api-key-steps {
          margin: 24px 0;
          text-align: left;
        }

        .api-key-step {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
          padding: 16px;
          background: var(--background-secondary);
          border-radius: var(--radius-m);
          border-left: 3px solid var(--interactive-accent);
        }

        .step-number {
          width: 32px;
          height: 32px;
          background: var(--interactive-accent);
          color: var(--text-on-accent);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 16px;
          flex-shrink: 0;
        }

        .step-content {
          flex: 1;
        }

        .step-content h4 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-normal);
        }

        .step-content p {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: var(--text-muted);
          line-height: 1.4;
        }

        .step-action-btn {
          padding: 8px 16px;
          border: 1px solid var(--interactive-accent);
          background: transparent;
          color: var(--interactive-accent);
          border-radius: var(--radius-s);
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .step-action-btn:hover {
          background: var(--interactive-accent);
          color: var(--text-on-accent);
        }

        .api-key-modal-footer {
          padding: 16px 24px 24px;
          display: flex;
          justify-content: center;
        }

        .api-key-btn-close {
          padding: 10px 24px;
          border: 1px solid var(--background-modifier-border);
          background: var(--background-secondary);
          color: var(--text-normal);
          border-radius: var(--radius-s);
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .api-key-btn-close:hover {
          background: var(--background-modifier-hover);
        }
        `}
      </style>
    </div>
  )
}

export class ApiKeyModal extends Modal {
  private root: Root | null = null

  constructor(app: App) {
    super(app)
  }

  onOpen(): void {
    const { contentEl, modalEl } = this

    // 添加特定的CSS类
    modalEl.addClass('mod-api-key')

    // 设置模态框样式
    modalEl.style.width = '520px'
    modalEl.style.maxWidth = '90vw'

    this.root = createRoot(contentEl)

    this.root.render(
      <ApiKeyModalContent
        onClose={() => this.close()}
        app={this.app}
      />
    )
  }

  onClose(): void {
    const { contentEl, modalEl } = this
    modalEl.removeClass('mod-api-key')
    this.root?.unmount()
    this.root = null
    contentEl.empty()
  }
}
