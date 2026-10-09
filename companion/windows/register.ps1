$ErrorActionPreference = 'Stop'
try {
    $inputText = [Console]::In.ReadToEnd()
    if ($inputText.Length -gt 16384) { throw 'Input too large' }
    $config = $inputText | ConvertFrom-Json
    if ($config.mode -notin @('Prepare','Register')) { throw 'Invalid operation' }
    if ($config.host -ne 'org.flzsh.canvas_harness_ai') { throw 'Unexpected host' }
    $directory = [IO.Path]::GetFullPath($config.installDir)
    $expectedManifest = Join-Path $directory 'org.flzsh.canvas_harness_ai.json'
    if ([IO.Path]::GetFullPath($config.manifestPath) -ne $expectedManifest) { throw 'Unexpected manifest path' }
    if ($config.mode -eq 'Prepare') {
        [IO.Directory]::CreateDirectory($directory) | Out-Null
        $item = Get-Item -LiteralPath $directory
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse points are not allowed' }
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $acl = New-Object Security.AccessControl.DirectorySecurity
        $acl.SetAccessRuleProtection($true, $false)
        $acl.SetOwner($sid)
        $inherit = [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
        foreach ($principal in @($sid, (New-Object Security.Principal.SecurityIdentifier('S-1-5-18')))) {
            $rule = New-Object Security.AccessControl.FileSystemAccessRule($principal, 'FullControl', $inherit, 'None', 'Allow')
            $acl.AddAccessRule($rule)
        }
        Set-Acl -LiteralPath $directory -AclObject $acl
    } else {
        if (-not (Test-Path -LiteralPath $expectedManifest -PathType Leaf)) { throw 'Manifest missing' }
        foreach ($browser in @('Google\Chrome', 'Microsoft\Edge')) {
            $key = "HKCU:\Software\$browser\NativeMessagingHosts\org.flzsh.canvas_harness_ai"
            New-Item -Path $key -Force | Out-Null
            Set-Item -LiteralPath $key -Value $expectedManifest
        }
    }
    exit 0
} catch {
    [Console]::Error.WriteLine('Native-host registration failed. No account credentials were used.')
    exit 1
}
