package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 05 - Inicio de sesion con el correo: el campo Usuario o Correo acepta tambien el correo registrado (CP-05)")
class Test05InicioSesionConCorreo {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp05_inicioConCorreo() {
        cliente = Navegador.escritorio();
        Acciones.ir(cliente, "/login");
        Cuentas.asegurarCliente(cliente);
        String correo = Cuentas.clienteCorreo();

        Acciones.escribir(cliente, By.cssSelector("input[name=username]"), correo);
        Acciones.escribir(cliente, By.cssSelector("input[name=password]"), Config.CLIENTE_CLAVE);
        Acciones.clic(cliente, By.cssSelector("button[type=submit]"));
        boolean entro = Acciones.esperaJs(cliente, "location.pathname.endsWith('/home')", Config.ESPERA_LARGA);
        Acciones.esperarInicioCliente(cliente);

        Evidencia.nota("loginConCorreo", entro);
        Evidencia.captura(cliente, "cp07d_login_con_correo");

        assertTrue(entro, "El campo 'Usuario o Correo' debe aceptar el correo registrado: " + correo);
    }
}
