package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DisplayName("Test 04 - Mostrar y ocultar la contrasena: el boton del ojo cambia la visibilidad del campo (CP-04)")
class Test04MostrarContrasena {

    private WebDriver navegador;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(navegador);
    }

    @Test
    void cp04_mostrarContrasena() {
        navegador = Navegador.escritorio();
        Acciones.ir(navegador, "/login");
        Acciones.escribir(navegador, By.cssSelector("input[name=password]"), "ClaveDePrueba2026!");

        String antes = navegador.findElement(By.cssSelector("input[name=password]")).getAttribute("type");
        Acciones.clic(navegador, By.cssSelector(".input-icon-toggle"));
        Acciones.esperar(600);
        String despues = navegador.findElement(By.cssSelector("input[name=password]")).getAttribute("type");

        Evidencia.nota("passwordTipoAntes", antes);
        Evidencia.nota("passwordTipoDespues", despues);
        Evidencia.captura(navegador, "cp02d_login_mostrar_password");

        assertEquals("password", antes, "El campo debe empezar oculto");
        assertEquals("text", despues, "Al pulsar el ojo la contrasena debe verse");
    }
}
