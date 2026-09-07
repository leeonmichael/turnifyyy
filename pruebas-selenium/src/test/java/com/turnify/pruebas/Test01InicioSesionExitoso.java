package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 01 - Inicio de sesion exitoso: un cliente registrado entra con sus credenciales y llega a la pantalla de Inicio (CP-01)")
class Test01InicioSesionExitoso {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp01_inicioDeSesionExitoso() {
        cliente = Navegador.escritorio();
        Acciones.ir(cliente, "/login");
        String usuario = Cuentas.asegurarCliente(cliente);

        Acciones.escribir(cliente, By.cssSelector("input[name=username]"), usuario);
        Acciones.escribir(cliente, By.cssSelector("input[name=password]"), Config.CLIENTE_CLAVE);
        Evidencia.captura(cliente, "cp07a_login_datos_validos");

        Acciones.clic(cliente, By.cssSelector("button[type=submit]"));
        boolean entro = Acciones.esperaJs(cliente, "location.pathname.endsWith('/home')", Config.ESPERA_LARGA);
        Acciones.esperarInicioCliente(cliente);

        String saludo = Acciones.texto(cliente, By.cssSelector(".welcome-user"));
        Evidencia.nota("saludoInicio", saludo);
        Evidencia.captura(cliente, "cp07b_login_exitoso_home_cliente");
        Evidencia.capturaCompleta(cliente, "cp07c_home_cliente_completo");
        Evidencia.capturaElemento(Acciones.visible(cliente, By.cssSelector(".navbar")), "cp20_navbar_cliente");

        assertTrue(entro, "Con credenciales validas la web debe llevar a la pantalla de Inicio");
        assertTrue(saludo.toLowerCase().contains("bienvenido"),
                "La pantalla de Inicio debe saludar al cliente, mostro: " + saludo);
    }
}
