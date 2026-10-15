param([string]$Serial)

$ErrorActionPreference = 'Stop'
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
if (!(Test-Path -LiteralPath $adb)) { throw '找不到 adb，請設定 ANDROID_HOME。' }
$apk = Join-Path $PSScriptRoot 'Sorti-usb-test-arm64.apk'
if (!(Test-Path -LiteralPath $apk)) { throw '找不到測試 APK，請先完成打包。' }

$deviceLines = & $adb devices
if ($LASTEXITCODE -ne 0) { throw '無法取得 USB 裝置。' }
$devices = @($deviceLines | Where-Object { $_ -match '^\S+\s+device$' } | ForEach-Object { ($_ -split '\s+')[0] })
if (!$Serial) {
    if ($devices.Count -ne 1) { throw '請接上一台手機並允許 USB 偵錯；多台裝置時請使用 -Serial 指定。' }
    $Serial = $devices[0]
}
if ($devices -notcontains $Serial) { throw '指定裝置尚未連線或未允許 USB 偵錯。' }

& $adb -s $Serial shell getprop ro.product.cpu.abilist
if ($LASTEXITCODE -ne 0) { throw '無法讀取手機架構。' }
& $adb -s $Serial install -r $apk
if ($LASTEXITCODE -ne 0) { throw 'APK 安裝失敗。' }
& $adb -s $Serial reverse tcp:8000 tcp:8000
if ($LASTEXITCODE -ne 0) { throw 'AI 後端 USB 轉接失敗。' }
& $adb -s $Serial shell am start -n com.sorti/.MainActivity
if ($LASTEXITCODE -ne 0) { throw '無法啟動 SORTI。' }
Write-Host 'SORTI 已安裝並啟動；AI 測試請保持 USB 連線及電腦後端執行。'

