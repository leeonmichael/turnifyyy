package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 07 - Registro exitoso: se crea una cuenta de cliente con datos validos y la web lleva a Iniciar Sesion (CP-07)")
class Test07RegistroExitoso {

    private WebDriver navegador;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(navegador);
    }

    @Test
    void cp07_registroExitoso() {
        navegador = Navegador.escritorio();
        Acciones.ir(navegador, "/register");
        Acciones.visible(navegador, By.cssSelector("input[name=full_name]"), Config.ESPERA);

        Map<String, String> datos = Escenario.datosNuevoCliente();
        Escenario.diligenciarRegistro(navegador, datos);
        Evidencia.captura(navegador, "cp05a_registro_datos_validos");

        Acciones.clic(navegador, By.cssSelector("button[type=submit]"));
        Acciones.esperar(1500);
        Evidencia.captura(navegador, "cp05b_registro_enviado");

        boolean redirigio = Acciones.esperaJs(navegador,
                "location.pathname.endsWith('/login')", Config.ESPERA_LARGA);
        Acciones.esperar(1500);
        Evidencia.nota("registroRedirigioALogin", redirigio);
        Evidencia.nota("registroUrlFinal", navegador.getCurrentUrl());
        Evidencia.captura(navegador, "cp05c_registro_exitoso_redirige_login");

        Evidencia.nota("clienteUsuario", datos.get("username"));
        Evidencia.nota("clienteCorreo", datos.get("email"));
        Evidencia.nota("clienteCedula", datos.get("cedula"));
        Evidencia.nota("clienteTelefono", datos.get("phone"));

        Acciones.escribir(navegador, By.cssSelector("input[name=username]"), datos.get("username"));
        Acciones.escribir(navegador, By.cssSelector("input[name=password]"), Config.CLIENTE_CLAVE);
        Acciones.clic(navegador, By.cssSelector("button[type=submit]"));
        boolean puedeEntrar = Acciones.esperaJs(navegador,
                "location.pathname.endsWith('/home')", Config.ESPERA_LARGA);
        Evidencia.nota("cuentaNuevaPuedeEntrar", puedeEntrar);

        assertTrue(redirigio, "Tras crear la cuenta la web debe llevar a la pantalla de Iniciar Sesion");
        assertTrue(puedeEntrar, "La cuenta recien creada debe poder iniciar sesion");
    }
}
