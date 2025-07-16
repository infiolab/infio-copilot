import { ImageUp } from 'lucide-react'
import { TFile } from 'obsidian'

import { useApp } from '../../../contexts/AppContext'
import { getImageMimeType } from '../../../utils/image'
import { ImageSelectorModal } from '../../modals/ImageSelectorModal'

export function ImageUploadButton({
  onUpload,
}: {
  onUpload: (files: File[]) => void
}) {
  const app = useApp()

  const handleClick = () => {
    const handleVaultImages = async (files: TFile[]) => {
      const imageFiles = await Promise.all(
        files.map(async (file) => {
          const arrayBuffer = await app.vault.readBinary(file)
          const mimeType = getImageMimeType(file.extension)
          const blob = new Blob([arrayBuffer], { type: mimeType })
          return new File([blob], file.name, { type: mimeType })
        })
      )
      onUpload(imageFiles)
    }

    new ImageSelectorModal(app, onUpload, handleVaultImages).open()
  }

  return (
    <button 
      className="infio-chat-user-input-submit-button"
      onClick={handleClick}
    >
      <div className="infio-chat-user-input-submit-button-icons">
				<ImageUp size={14} />
      </div>
      {/* <div>{t('chat.input.image')}</div> */}
    </button>
  )
}
