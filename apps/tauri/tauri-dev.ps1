$cargoBin = "$env:USERPROFILE\.cargo\bin"
if (Test-Path "$cargoBin\cargo.exe") {
    $env:Path = "$cargoBin;$env:Path"
}
tauri dev
