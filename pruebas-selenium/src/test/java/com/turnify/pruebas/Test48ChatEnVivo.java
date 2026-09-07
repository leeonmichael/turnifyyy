package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 48 - Chat en vivo: los mensajes entre el cliente y el especialista llegan en ambos sentidos (CP-39)")
class Test48ChatEnVivo {

    private WebDriver especialista;
    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
        Navegador.cerrar(especialista);
    }

    @Test
    void cp39_chatEnVivo() {
        cliente = Escenario.cliente();
        String turno = Escenario.turnoVirtualEnEspera(cliente);
        Escenario.adjuntarDocumento(cliente, 0);

        especialista = Escenario.especialistaVirtual();
        Escenario.atenderTurnoVirtual(especialista, turno);
        Acciones.esperaEnCliente(cliente, "document.querySelector('.client-chat-input')");

        Acciones.escribir(especialista, By.cssSelector(".chat-input"),
                "Hola, buenos dias. ¿Ya tiene su documento a la mano?");
        Acciones.clic(especialista, By.cssSelector(".btn-send"));
        boolean visibleEnEspecialista = Acciones.esperaJs(especialista,
                "document.body.innerText.includes('documento a la mano')", Config.ESPERA_LARGA);
        boolean llegoAlCliente = Acciones.esperaEnCliente(cliente,
                "document.body.innerText.includes('documento a la mano')");

        Acciones.escribir(cliente, By.cssSelector(".client-chat-input"), "Si, ya lo tengo listo. Gracias.");
        Acciones.clic(cliente, By.cssSelector(".client-chat-send"));
        boolean visibleEnCliente = Acciones.esperaJs(cliente,
                "document.body.innerText.includes('lo tengo listo')", Config.ESPERA_LARGA);
        boolean llegoAlEspecialista = Acciones.esperaJs(especialista,
                "document.body.innerText.includes('lo tengo listo')", Config.ESPERA_LARGA);

        Acciones.esperar(1500);
        Acciones.desplazarA(especialista, By.cssSelector(".chat-messages"));
        Evidencia.captura(especialista, "vi05a_chat_empleado");
        Acciones.desplazarA(cliente, By.cssSelector(".client-chat-card"));
        Evidencia.captura(cliente, "vi05b_chat_cliente");
        Evidencia.nota("chatMensajeEmpleadoVisible", visibleEnEspecialista && llegoAlCliente);
        Evidencia.nota("chatMensajeClienteVisible", visibleEnCliente && llegoAlEspecialista);

        assertTrue(llegoAlCliente, "El mensaje del especialista debe llegar al cliente");
        assertTrue(llegoAlEspecialista, "La respuesta del cliente debe llegar al especialista");
    }
}
