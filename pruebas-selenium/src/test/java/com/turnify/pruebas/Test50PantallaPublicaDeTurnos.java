package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 50 - Pantalla publica de turnos: la vista de sala de espera funciona sin iniciar sesion (CP-50)")
class Test50PantallaPublicaDeTurnos {

    private WebDriver pantalla;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(pantalla);
    }

    @Test
    void cp50_pantallaPublica() {
        pantalla = Escenario.navegadorSinSesion();
        Acciones.ir(pantalla, "/screen");
        Acciones.esperar(8000);

        String contenido = Acciones.textoPlano(pantalla, By.cssSelector("body"));
        String url = pantalla.getCurrentUrl();
        Evidencia.nota("pantallaPublicaUrl", url);
        Evidencia.nota("pantallaPublicaTexto", contenido.length() > 300 ? contenido.substring(0, 300) : contenido);
        Evidencia.captura(pantalla, "cp21_pantalla_turnos_publica");

        assertTrue(url.contains("/screen"), "La pantalla publica debe abrirse sin iniciar sesion");
        assertTrue(contenido.toLowerCase().contains("espera"),
                "La pantalla debe informar cuantos turnos hay en espera");
    }
}
