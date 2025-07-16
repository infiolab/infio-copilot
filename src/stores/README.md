# 状态管理 (State Management)

本项目使用 [zustand](https://github.com/pmndrs/zustand) 进行全局状态管理。

## 目录结构

```
src/stores/
├── chat-store.ts    # 聊天页面状态管理
├── index.ts         # 导出所有 stores
└── README.md        # 本文档
```

## 已实现的 Store

### ChatStore (`chat-store.ts`)

管理聊天页面的状态，包括：

- **currentConversationId**: 当前聊天会话ID
- **currentTab**: 当前活动的tab ('chat' | 'commands' | 'custom-mode' | 'mcp' | 'search' | 'history' | 'workspace' | 'insights')
- **shouldAutoLoadLastChat**: 是否需要自动加载上次的聊天记录

#### 功能特性

1. **持久化存储**: 使用 `zustand/middleware` 的 `persist` 功能，数据自动保存到 localStorage
2. **自动加载**: 用户重新打开应用时，会自动加载上次的聊天记录
3. **智能管理**: 新建对话时会清除存储的对话ID，避免重复加载

#### 使用方法

```typescript
import useChatStore from '../../stores/chat-store'

function ChatComponent() {
  const {
    currentConversationId,
    setCurrentConversationId,
    currentTab,
    setCurrentTab,
    shouldAutoLoadLastChat,
    setShouldAutoLoadLastChat,
    reset,
  } = useChatStore()

  // 使用状态...
}
```

#### 工作流程

1. **初始化**: 组件挂载时检查是否有存储的对话ID
2. **自动加载**: 如果有存储的对话ID且当前聊天为空，自动加载历史对话
3. **状态同步**: 用户发送消息时，将当前对话ID保存到 store
4. **重置状态**: 用户新建对话时，清除store中的对话ID

## 添加新的 Store

1. 在 `src/stores/` 目录下创建新的 store 文件
2. 使用 zustand 的 `create` 函数创建 store
3. 如果需要持久化，使用 `persist` 中间件
4. 在 `index.ts` 中导出新的 store

### 示例模板

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MyStore {
  // 状态定义
  value: string
  setValue: (value: string) => void
  
  // 重置方法
  reset: () => void
}

const useMyStore = create<MyStore>()(
  persist(
    (set) => ({
      value: '',
      setValue: (value) => set({ value }),
      reset: () => set({ value: '' }),
    }),
    {
      name: 'my-store-name',
      partialize: (state) => ({
        value: state.value,
      }),
    }
  )
)

export default useMyStore
```

## 最佳实践

1. **最小化状态**: 只存储必要的状态，避免冗余
2. **类型安全**: 使用 TypeScript 定义 store 接口
3. **持久化选择**: 使用 `partialize` 只持久化需要的状态
4. **重置方法**: 提供 `reset` 方法用于清理状态
5. **命名规范**: store 文件使用 `kebab-case`，hook 使用 `camelCase`

## 注意事项

- 持久化的状态会自动保存到 localStorage
- 组件卸载时不会自动清理状态，需要手动调用 `reset` 方法
- 避免在 store 中存储大量数据，影响性能
- 状态更新是同步的，复杂的副作用应该在组件中处理 
