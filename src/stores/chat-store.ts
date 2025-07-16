import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ChatTab = 'chat' | 'commands' | 'custom-mode' | 'mcp' | 'search' | 'history' | 'workspace' | 'insights'

interface ChatStore {
  // 当前聊天会话ID
  currentConversationId: string | null
  setCurrentConversationId: (id: string | null) => void
  
  // 当前活动的tab
  currentTab: ChatTab
  setCurrentTab: (tab: ChatTab) => void
  
  // 是否需要自动加载上次的聊天记录
  shouldAutoLoadLastChat: boolean
  setShouldAutoLoadLastChat: (should: boolean) => void
  
  // 重置所有状态
  reset: () => void
  
  // 重置自动加载标志
  resetAutoLoadFlag: () => void
}

const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      currentConversationId: null,
      setCurrentConversationId: (id) => set({ currentConversationId: id }),
      
      currentTab: 'chat',
      setCurrentTab: (tab) => set({ currentTab: tab }),
      
      shouldAutoLoadLastChat: true,
      setShouldAutoLoadLastChat: (should) => set({ shouldAutoLoadLastChat: should }),
      
      reset: () => set({
        currentConversationId: null,
        currentTab: 'chat',
        shouldAutoLoadLastChat: true,
      }),
      
      resetAutoLoadFlag: () => set({ shouldAutoLoadLastChat: true }),
    }),
    {
      name: 'infio-chat-store',
      partialize: (state) => ({
        currentConversationId: state.currentConversationId,
        currentTab: state.currentTab,
        shouldAutoLoadLastChat: state.shouldAutoLoadLastChat,
      }),
    }
  )
)

export default useChatStore 
