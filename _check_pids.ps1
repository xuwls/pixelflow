$pids = 8240, 23548, 26024, 23280
foreach ($id in $pids) {
    $p = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($p) {
        $cim = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue
        Write-Host ("PID {0} : {1}" -f $p.Id, $p.ProcessName)
        if ($cim) { Write-Host ("    cmd: " + $cim.CommandLine) }
    } else {
        Write-Host ("PID {0} : not found" -f $id)
    }
}
