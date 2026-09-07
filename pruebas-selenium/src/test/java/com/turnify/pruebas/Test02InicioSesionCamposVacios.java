package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 02 - Campos vacios en el inicio de sesion: la web exige usuario y contrasena antes de llamar al servidor (CP-02)")
class Test02InicioSesionCamposVacios {

    private WebDriver navegador;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(navegador);
    }

    @Test
    void cp02_camposVacios() {
        navegador = Navegador.escritorio();
        Acciones.ir(navegador, "/login");
        Acciones.clic(navegador, By.cssSelector("button[type=submit]"));

        String mensaje = Acciones.texto(navegador, By.cssSelector(".alert-error"));
        Evidencia.nota("loginVacioMensaje", mensaje);
        Evidencia.captura(navegador, "cp02a_login_campos_vacios");

        assertTrue(mensaje.toLowerCase().contains("usuario"),
                "Debe avisar que faltan usuario y contrasena, pero mostro: " + mensaje);
        assertTrue(navegador.getCurrentUrl().contains("/login"),
                "La aplicacion debe permanecer en la pantalla de Iniciar Sesion");
    }
}
