# 自动推送.ps1
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Git 自动检测并推送" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[错误] 未检测到 git 命令。" -ForegroundColor Red
    Write-Host "请先安装 Git for Windows: https://git-scm.com/download/win"
    Read-Host "按回车退出"
    exit 1
}

$isRepo = git rev-parse --is-inside-work-tree 2>$null
if ($LASTEXITCODE -ne 0 -or $isRepo -ne 'true') {
    Write-Host "[错误] 当前目录不是 Git 仓库。" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

Write-Host "[路径] $PWD" -ForegroundColor Yellow
Write-Host ""

$status = git status --porcelain
$changes = ($status | Measure-Object).Count

if ($changes -eq 0) {
    Write-Host "[信息] 没有检测到任何文件改动。" -ForegroundColor Green
    Write-Host ""
    $pushNow = Read-Host "是否仍要推送到远程？(Y/N)"
    if ($pushNow -match '^[Yy]') {
        Write-Host "[执行] git push"
        git push
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[警告] 推送失败。" -ForegroundColor Red
            Read-Host "按回车退出"
            exit 1
        }
        Write-Host "[完成] 已推送到远程。" -ForegroundColor Green
    } else {
        Write-Host "[跳过] 已取消。"
    }
    Read-Host "按回车退出"
    exit 0
}

Write-Host "[检测] 共发现 $changes 处改动：" -ForegroundColor Yellow
Write-Host ""
git status --short
Write-Host ""

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$commitMsg = Read-Host "请输入提交信息（直接回车使用默认）"
if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    $commitMsg = "auto update $timestamp"
}

Write-Host ""
Write-Host "[执行] git add ."
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] git add 失败。" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

Write-Host "[执行] git commit"
git commit -m $commitMsg
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] git commit 失败。" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

Write-Host ""
Write-Host "[执行] git push"
git push
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[警告] 推送失败。可能原因：" -ForegroundColor Red
    Write-Host "  - 首次推送需要完成 GitHub 登录验证"
    Write-Host "  - 远程仓库有新的提交，需要先 git pull"
    Write-Host "  - 未设置远程仓库（用 git remote -v 检查）"
    Read-Host "按回车退出"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   [成功] 已提交并推送到远程" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Read-Host "按回车退出"