import { SerializedEditorState } from 'lexical'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SearchInputStore {
  // 输入历史记录数组
  history: SerializedEditorState[]
  // 当前历史索引，-1表示不在历史中（即当前输入）
  currentHistoryIndex: number
  // 临时存储的当前输入内容
  currentInput: SerializedEditorState | null
  
  // 添加历史记录
  addToHistory: (input: SerializedEditorState) => void
  // 获取上一个历史记录
  getPreviousHistory: () => SerializedEditorState | null
  // 获取下一个历史记录
  getNextHistory: () => SerializedEditorState | null
  // 重置历史索引
  resetHistoryIndex: () => void
  // 设置当前输入
  setCurrentInput: (input: SerializedEditorState | null) => void
  // 清空历史记录
  clearHistory: () => void
}

const useSearchInputStore = create<SearchInputStore>()(
  persist(
    (set, get) => ({
      history: [],
      currentHistoryIndex: -1,
      currentInput: null,
      
      addToHistory: (input: SerializedEditorState) => {
        const { history } = get()
        
        // 检查是否为空输入
        if (!input || !input.root?.children?.length) {
          return
        }
        
        // 检查输入是否与最后一个历史记录相同
        const lastHistory = history[history.length - 1]
        if (lastHistory && JSON.stringify(lastHistory) === JSON.stringify(input)) {
          return
        }
        
        // 添加到历史记录，限制最大数量为50
        const newHistory = [...history, input].slice(-50)
        
        set({
          history: newHistory,
          currentHistoryIndex: -1,
          currentInput: null,
        })
      },
      
      getPreviousHistory: () => {
        const { history, currentHistoryIndex, currentInput } = get()
        
        if (history.length === 0) {
          return null
        }
        
        let newIndex: number
        
        if (currentHistoryIndex === -1) {
          // 第一次按上箭头，从最后一个历史记录开始
          newIndex = history.length - 1
        } else if (currentHistoryIndex > 0) {
          // 继续向上翻找
          newIndex = currentHistoryIndex - 1
        } else {
          // 已经到达最顶端，保持在第一个记录
          return history[0]
        }
        
        set({
          currentHistoryIndex: newIndex,
          currentInput: currentInput, // 保持当前输入
        })
        
        return history[newIndex]
      },
      
      getNextHistory: () => {
        const { history, currentHistoryIndex, currentInput } = get()
        
        if (currentHistoryIndex === -1) {
          // 已经在当前输入状态，返回当前输入
          return currentInput
        }
        
        if (currentHistoryIndex < history.length - 1) {
          // 继续向下翻找
          const newIndex = currentHistoryIndex + 1
          set({ currentHistoryIndex: newIndex })
          return history[newIndex]
        } else {
          // 到达最底端，回到当前输入
          set({ currentHistoryIndex: -1 })
          return currentInput
        }
      },
      
      resetHistoryIndex: () => {
        set({
          currentHistoryIndex: -1,
          currentInput: null,
        })
      },
      
      setCurrentInput: (input: SerializedEditorState | null) => {
        set({ currentInput: input })
      },
      
      clearHistory: () => {
        set({
          history: [],
          currentHistoryIndex: -1,
          currentInput: null,
        })
      },
    }),
    {
      name: 'infio-search-input-store',
      partialize: (state) => ({
        history: state.history,
        // 不持久化当前状态，每次重新加载时重置
      }),
    }
  )
)

export default useSearchInputStore 
