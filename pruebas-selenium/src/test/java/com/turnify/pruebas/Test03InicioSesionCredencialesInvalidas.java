package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 03 - Credenciales invalidas: el sistema rechaza el acceso y debe avisarlo en pantalla (CP-03)")
class Test03InicioSesionCredencialesInvalidas {

    private WebDriver navegador;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(navegador);
    }

    @Test
    void cp03_credencialesInvalidas() {
        navegador = Navegador.escritorio();
        Acciones.ir(navegador, "/login");
        Acciones.escribir(navegador, By.cssSelector("input[name=username]"), "usuario_inexistente_qa");
        Acciones.escribir(navegador, By.cssSelector("input[name=password]"), "claveIncorrecta123!");
        Acciones.clic(navegador, By.cssSelector("button[type=submit]"));
        Acciones.esperar(6000);

        String alerta = Acciones.texto(navegador, By.cssSelector(".alert-error"));
        String boton = Acciones.texto(navegador, By.cssSelector("button[type=submit]"));
        Evidencia.nota("loginInvalidoAlerta", alerta);
        Evidencia.nota("loginInvalidoBoton", boton);
        Evidencia.captura(navegador, "cp02b_login_credenciales_invalidas");

        Acciones.clic(navegador, By.cssSelector(".login-card h2"));
        Acciones.esperar(1200);
        Evidencia.nota("loginInvalidoBotonTrasClic",
                Acciones.texto(navegador, By.cssSelector("button[type=submit]")));
        Evidencia.captura(navegador, "cp02c_login_credenciales_invalidas_tras_click");

        String[] respuesta = Acciones.api(navegador, "POST", "/api/login/",
                "{\"username\":\"usuario_inexistente_qa\",\"password\":\"claveIncorrecta123!\"}");
        Evidencia.nota("loginInvalidoHttp", respuesta[0]);
        Evidencia.nota("loginInvalidoCuerpo", respuesta[1]);

        assertEquals("401", respuesta[0], "El servidor debe rechazar las credenciales con 401");
        assertTrue(respuesta[1].contains("Credenciales"),
                "El servidor debe responder 'Credenciales invalidas'");
        assertTrue(navegador.getCurrentUrl().contains("/login"),
                "La aplicacion debe permanecer en la pantalla de Login");
        assertTrue(alerta.contains("Credenciales"),
                "CP-03 FALLIDO: el servidor responde 'Credenciales invalidas' pero la pantalla no lo muestra"
                        + " (el boton quedo en '" + boton + "').");
    }
}
