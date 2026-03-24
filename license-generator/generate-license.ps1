$ErrorActionPreference = 'Stop'

function New-Zh([int[]]$codes) {
  return -join ($codes | ForEach-Object { [char]$_ })
}

$title = "[{0}] {1}" -f (New-Zh @(0x4EA4,0x4E92,0x6A21,0x5F0F)), (New-Zh @(0x56DE,0x8F66,0x4F7F,0x7528,0x9ED8,0x8BA4,0x503C))
$pMachine = "{0} default *" -f (New-Zh @(0x673A,0x5668,0x7801))
$pDays = "{0} default 365" -f (New-Zh @(0x6388,0x6743,0x5929,0x6570))
$pMaxTasks = "{0} default 100" -f (New-Zh @(0x4EFB,0x52A1,0x4E0A,0x9650))
$pFeatures = "{0} default TASK_MANAGEMENT,FLOW_DESIGN,TASK_EXECUTION,DEBUG" -f (New-Zh @(0x529F,0x80FD,0x5217,0x8868))
$pCustomer = "{0} default UNKNOWN" -f (New-Zh @(0x5BA2,0x6237,0x6807,0x8BC6))

Write-Host $title
Write-Host ""

$machine = Read-Host $pMachine
if ([string]::IsNullOrWhiteSpace($machine)) { $machine = "*" }

$days = Read-Host $pDays
if ([string]::IsNullOrWhiteSpace($days)) { $days = "365" }

$maxTasks = Read-Host $pMaxTasks
if ([string]::IsNullOrWhiteSpace($maxTasks)) { $maxTasks = "100" }

$features = Read-Host $pFeatures
if ([string]::IsNullOrWhiteSpace($features)) { $features = "TASK_MANAGEMENT,FLOW_DESIGN,TASK_EXECUTION,DEBUG" }

$customer = Read-Host $pCustomer
if ([string]::IsNullOrWhiteSpace($customer)) { $customer = "UNKNOWN" }

$nodeScript = Join-Path $PSScriptRoot "license-generator.cjs"
& node $nodeScript "--machine=$machine" "--days=$days" "--maxTasks=$maxTasks" "--features=$features" "--customer=$customer"
exit $LASTEXITCODE
