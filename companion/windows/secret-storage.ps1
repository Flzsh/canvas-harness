$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.Security
    $inputText = [Console]::In.ReadToEnd()
    if ($inputText.Length -gt 262144) { throw 'Input too large' }
    $request = $inputText | ConvertFrom-Json
    if ($request.mode -notin @('Protect','Unprotect')) { throw 'Invalid operation' }
    $bytes = [Convert]::FromBase64String($request.data)
    $entropy = [Text.Encoding]::UTF8.GetBytes('org.flzsh.canvas_harness_ai/v1')
    if ($request.mode -eq 'Protect') {
        $result = [Security.Cryptography.ProtectedData]::Protect($bytes, $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    } else {
        $result = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    }
    [Console]::Out.Write([Convert]::ToBase64String($result))
    exit 0
} catch {
    [Console]::Error.WriteLine('Protected storage failed.')
    exit 1
}
