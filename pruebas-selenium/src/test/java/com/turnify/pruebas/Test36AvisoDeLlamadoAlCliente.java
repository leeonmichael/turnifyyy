package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 36 - Aviso de llamado: cuando el empleado llama el turno, el cliente y la pantalla publica lo ven en tiempo real (CP-18)")
class Test36AvisoDeLlamadoAlCliente {

    private WebDriver empleado;
    private WebDriver cliente;
    private WebDriver pantalla;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(pantalla);
        Navegador.cerrar(cliente);
        Navegador.cerrar(empleado);
    }

    @Test
    void cp18_avisoDeLlamado() {
        empleado = Escenario.empleado();
        Escenario.limpiarCola(empleado);

        cliente = Escenario.cliente();
        String turno = Escenario.turnoEnEspera(cliente, "general");
        Acciones.esperaJs(empleado, "document.body.innerText.includes('" + turno + "')", Config.ESPERA_LARGA);

        String enAtencion = Escenario.llamarSiguiente(empleado);
        boolean clienteAvisado = Acciones.esperaEnCliente(cliente, "document.querySelector('.banner-called')");
        Acciones.esperar(1500);
        String estado = Acciones.texto(cliente, By.cssSelector(".turn-status-chip"));
        Evidencia.nota("clienteVeLlamando", clienteAvisado);
        Evidencia.nota("estadoEnTarjetaDelCliente", estado);
        Evidencia.captura(cliente, "em02b_cliente_ve_llamando");

        pantalla = Escenario.navegadorSinSesion();
        Acciones.ir(pantalla, "/screen");
        Acciones.esperar(8000);
        String contenido = Acciones.textoPlano(pantalla, By.cssSelector("body"));
        Evidencia.nota("pantallaPublicaLlamando",
                contenido.length() > 300 ? contenido.substring(0, 300) : contenido);
        Evidencia.captura(pantalla, "em02c_pantalla_publica_llamando");

        assertTrue(clienteAvisado,
                "El cliente debe ver el aviso de que lo estan llamando para el turno " + enAtencion);
        assertTrue(contenido.contains(enAtencion),
                "La pantalla publica debe mostrar el turno en atencion " + enAtencion);
    }
}
