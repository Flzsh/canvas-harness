$ErrorActionPreference = 'Stop'
try {
    $address = [Console]::In.ReadToEnd()
    if ($address.Length -gt 16384) { throw 'Input too large' }
    $uri = [Uri]$address
    if ($uri.Scheme -ne 'https' -or $uri.Authority -ne 'auth.openai.com' -or $uri.AbsolutePath -ne '/api/accounts/authorize') { throw 'Unexpected destination' }
    Start-Process -FilePath $uri.AbsoluteUri -WindowStyle Hidden | Out-Null
    exit 0
} catch {
    [Console]::Error.WriteLine('Could not open sign-in browser.')
    exit 1
}
