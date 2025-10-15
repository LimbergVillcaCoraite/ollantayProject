import pytest
from main import create_empresa, EmpresaIn
from fastapi import HTTPException


def test_create_empresa_validation_empty():
    payload = EmpresaIn(nombre_empresa='  ', direccion_empresa='   ', estado_empresa=1, id_persona=1)
    with pytest.raises(HTTPException) as ei:
        create_empresa(payload, x_user_role='admin')
    assert ei.value.status_code == 400


def test_create_empresa_permission_denied():
    payload = EmpresaIn(nombre_empresa='Test', direccion_empresa='Dir', estado_empresa=1, id_persona=1)
    with pytest.raises(HTTPException) as ei:
        create_empresa(payload, x_user_role='viewer')
    assert ei.value.status_code == 403
