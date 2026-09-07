package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 18 - Solicitud sin conexion: sin internet la web avisa del error y no se bloquea (CP-20)")
class Test18SolicitarTurnoSinConexion {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        if (cliente != null) {
            Acciones.sinConexion(cliente, false);
        }
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp20_sinConexion() {
        cliente = Escenario.cliente();
        Escenario.liberarTurnoDelCliente(cliente);
        Acciones.visible(cliente, By.cssSelector(".request-card"), Config.ESPERA_LARGA);
        Acciones.seleccionar(cliente, Acciones.todos(cliente, By.cssSelector(".request-card select")).get(1), "presencial");
        Acciones.esperar(1000);

        Acciones.sinConexion(cliente, true);
        Acciones.clic(cliente, By.cssSelector(".get-turn-btn"));
        Acciones.esperar(6000);

        String error = Acciones.textoPlano(cliente, By.cssSelector(".error-msg"));
        String boton = Acciones.texto(cliente, By.cssSelector(".get-turn-btn"));
        Evidencia.nota("sinConexionMensaje", error);
        Evidencia.nota("sinConexionBoton", boton);
        Evidencia.captura(cliente, "cp22_sin_conexion_error");

        assertFalse(error.isBlank(),
                "Sin conexion debe mostrarse un mensaje de error, no una pantalla vacia");
        assertTrue(error.toLowerCase().contains("error"),
                "El mensaje debe indicar el problema de conexion, mostro: " + error);
    }
}
