# Ejecutar como Administrador
param()

$rules = @(
  @{ Name = 'Ollantay HTTP (80)';     Port = 80 },
  @{ Name = 'Ollantay HTTPS (443)';   Port = 443 },
  @{ Name = 'Ollantay Frontend (3000)'; Port = 3000 },
  @{ Name = 'Ollantay API (8001)';    Port = 8001 },
  @{ Name = 'Ollantay API (8002)';    Port = 8002 },
  @{ Name = 'Ollantay API (8003)';    Port = 8003 },
  @{ Name = 'Ollantay API (8004)';    Port = 8004 },
  @{ Name = 'Ollantay API (8005)';    Port = 8005 },
  @{ Name = 'Ollantay API (8006)';    Port = 8006 },
  @{ Name = 'Ollantay API (8007)';    Port = 8007 },
  @{ Name = 'Ollantay API (8008)';    Port = 8008 },
  @{ Name = 'Ollantay API (8009)';    Port = 8009 }
)

foreach($r in $rules){
  try{
    if(-not (Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue)){
      New-NetFirewallRule -DisplayName $r.Name -Direction Inbound -LocalPort $r.Port -Protocol TCP -Action Allow -EdgeTraversalPolicy Allow | Out-Null
      Write-Host "Regla creada: $($r.Name)" -ForegroundColor Green
    }else{
      Write-Host "Regla existente: $($r.Name)" -ForegroundColor Yellow
    }
  }catch{
    Write-Host "No se pudo crear: $($r.Name). Ejecuta este script como Administrador." -ForegroundColor Red
  }
}
