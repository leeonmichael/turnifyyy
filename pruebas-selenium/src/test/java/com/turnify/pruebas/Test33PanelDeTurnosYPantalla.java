package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 33 - Panel de turnos y Pantalla del administrador: las opciones Turnos y Pantalla abren sus vistas (CP-49)")
class Test33PanelDeTurnosYPantalla {

    private WebDriver administrador;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(administrador);
    }

    @Test
    void cp49_panelYPantalla() {
        administrador = Escenario.administrador();

        Acciones.ir(administrador, "/home");
        Acciones.esperar(6000);
        String panel = Acciones.textoPlano(administrador, By.cssSelector(".welcome-section"));
        Evidencia.nota("panelTurnosAdmin", panel);
        Evidencia.capturaCompleta(administrador, "ad09_panel_turnos_admin");

        Acciones.ir(administrador, "/screen");
        Acciones.esperar(6000);
        String pantalla = Acciones.textoPlano(administrador, By.cssSelector("body"));
        Evidencia.nota("pantallaDesdeAdmin", pantalla.length() > 200 ? pantalla.substring(0, 200) : pantalla);
        Evidencia.captura(administrador, "ad10_pantalla_desde_admin");

        assertTrue(panel.toLowerCase().contains("administrador"),
                "El panel de turnos debe identificar al administrador, mostro: " + panel);
        assertTrue(pantalla.toLowerCase().contains("espera"),
                "La pantalla publica debe informar los turnos en espera");
    }
}
