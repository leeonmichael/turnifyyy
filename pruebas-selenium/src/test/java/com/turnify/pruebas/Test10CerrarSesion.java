package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 10 - Cerrar sesion: se borra el token y las pantallas privadas dejan de ser accesibles (CP-10)")
class Test10CerrarSesion {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp10_cerrarSesion() {
        cliente = Escenario.cliente();
        Acciones.ir(cliente, "/home");
        Acciones.visible(cliente, By.cssSelector(".navbar"), Config.ESPERA_LARGA);

        Acciones.clic(cliente, By.cssSelector(".navbar-logout-btn"));
        Acciones.esperaJs(cliente, "location.pathname.endsWith('/login')", Config.ESPERA);
        Acciones.esperar(1200);

        Object token = ((JavascriptExecutor) cliente)
                .executeScript("return localStorage.getItem('turnify_token');");
        Evidencia.nota("tokenTrasCerrarSesion", String.valueOf(token));
        Evidencia.captura(cliente, "cp23a_logout_vuelve_login");

        Acciones.ir(cliente, "/home");
        Acciones.esperar(2500);
        String url = cliente.getCurrentUrl();
        Evidencia.nota("homeSinSesion", url);
        Evidencia.captura(cliente, "cp23b_sin_sesion_redirige_login");

        assertEquals("null", String.valueOf(token), "Al salir se debe borrar el token de la sesion");
        assertTrue(url.contains("/login"), "Sin sesion, /home debe redirigir al Login");
    }
}
