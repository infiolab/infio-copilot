#!/bin/bash

# 构建和打包脚本
# 使用 pnpm run build 编译项目，然后将编译后的文件打包成 zip

set -e  # 遇到错误时退出

echo "🚀 开始构建项目..."

# 运行构建命令
pnpm run build

echo "✅ 构建完成"

# 检查必需的文件是否存在
required_files=("styles.css" "manifest.json" "main.js")
missing_files=()

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -ne 0 ]; then
    echo "❌ 错误：以下必需文件未找到："
    printf '  %s\n' "${missing_files[@]}"
    exit 1
fi

echo "📦 开始打包文件..."

# 创建时间戳用于文件夹和zip文件名
timestamp=$(date +"%Y%m%d_%H%M%S")
package_dir="obsidian-infio-copilot_${timestamp}"
zip_file="${package_dir}.zip"

# 创建临时文件夹
mkdir -p "$package_dir"

# 复制文件到临时文件夹
cp styles.css "$package_dir/"
cp manifest.json "$package_dir/"
cp main.js "$package_dir/"

echo "📁 文件已复制到: $package_dir"

# 创建 zip 文件
zip -r "$zip_file" "$package_dir"

echo "🎉 打包完成！"
echo "📦 ZIP 文件: $zip_file"

# 清理临时文件夹
rm -rf "$package_dir"

echo "🧹 临时文件已清理"
echo "✨ 所有操作完成！"
