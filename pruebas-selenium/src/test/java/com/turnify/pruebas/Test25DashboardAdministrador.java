package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 25 - Dashboard del administrador: entra al panel administrativo y se dibujan las graficas de estadisticas (CP-41)")
class Test25DashboardAdministrador {

    private WebDriver administrador;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(administrador);
    }

    @Test
    void cp41_dashboard() {
        administrador = Escenario.administrador();
        Acciones.ir(administrador, "/dashboard");
        Acciones.visible(administrador, By.cssSelector(".employee-section"), Config.ESPERA_LARGA);
        Acciones.esperar(5000);

        String url = administrador.getCurrentUrl();
        List<String> graficas = new ArrayList<>();
        Acciones.todos(administrador, By.cssSelector("canvas")).forEach(c -> graficas.add(c.getAttribute("id")));
        Evidencia.nota("dashboardUrl", url);
        Evidencia.nota("dashboardGraficas", graficas);
        Evidencia.captura(administrador, "ad01_login_admin_dashboard");
        Evidencia.capturaCompleta(administrador, "ad01b_dashboard_completo");
        Evidencia.capturaElemento(Acciones.visible(administrador, By.cssSelector(".navbar")), "ad01c_navbar_admin");

        assertTrue(url.contains("/dashboard"), "El administrador debe entrar al Panel Administrativo");
        assertEquals(6, graficas.size(), "El dashboard debe mostrar las seis graficas de estadisticas");
    }
}
