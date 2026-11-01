param([Parameter(Mandatory=$true)][string]$WorkbookPath, [int]$CheckRow=0, [string]$ExpectedComment='')
$ErrorActionPreference = 'Stop'
$validationExcel = $null
$validationBook = $null
$privateInstance = $false
$nativeWorkbookPath = (Resolve-Path -LiteralPath $WorkbookPath).ProviderPath
try {
    $validationExcel = New-Object -ComObject Excel.Application
    if ($validationExcel.Workbooks.Count -ne 0) { throw 'Excel instance is not empty; leaving it untouched' }
    $privateInstance = $true
    $validationExcel.Visible = $false
    $validationExcel.DisplayAlerts = $false
    $validationExcel.EnableEvents = $false
    $validationExcel.AutomationSecurity = 3
    $validationBook = $validationExcel.Workbooks.Open($nativeWorkbookPath, 0, $true)
    $validationSheets = @()
    foreach ($validationSheet in $validationBook.Worksheets) {
        $validationTables = @()
        foreach ($validationTable in $validationSheet.ListObjects) {
            $validationTables += @{name=$validationTable.Name; rows=$validationTable.ListRows.Count; columns=$validationTable.ListColumns.Count; headers=@($validationTable.HeaderRowRange.Value2)}
        }
        $validationSheets += @{name=$validationSheet.Name; tables=$validationTables}
    }
    $checkedComment = $null
    if ($CheckRow -gt 0) {
        $checkedComment = [string]$validationBook.Worksheets.Item(2).Range("L$CheckRow").Value2
        if (-not $checkedComment.Contains($ExpectedComment)) { throw 'Expected comment not found in saved workbook' }
    }
    @{result='PASS'; mode='xlNormalLoad'; readOnly=$validationBook.ReadOnly; sheets=$validationSheets; checkedRow=$CheckRow; checkedComment=$checkedComment} | ConvertTo-Json -Depth 6 -Compress
}
catch {
    @{result='FAIL'; error=$_.Exception.Message} | ConvertTo-Json -Compress
    exit 1
}
finally {
    if ($null -ne $validationBook) { $validationBook.Close($false); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($validationBook) }
    if ($privateInstance) { $validationExcel.Quit() }
    if ($null -ne $validationExcel) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($validationExcel) }
}
